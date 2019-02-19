// API
import { getTokensAPI } from './Tokens'
import { getWeb3API } from './ProviderWeb3'
import { getDxPoolAPI } from './DxPool'
import { getAppContracts } from './Contracts'
import { fromWei, toBN } from '../api/utils'

import { BN_4_PERCENT } from '../globals'

// API singleton
let appAPI

// API initialiser
export const getAPI = async () => {
  if (appAPI) return appAPI

  appAPI = await init()
  return appAPI
}

// ============
// WEB3
// ============

export const getCurrentAccount = async () => {
  const { Web3 } = await getAPI()

  return Web3.getCurrentAccount()
}

export const getCurrentNetwork = async () => {
  const { getNetwork } = await getWeb3API()

  return getNetwork()
}

export const getCurrentNetworkId = async () => {
  const { getNetworkId } = await getWeb3API()

  return getNetworkId()
}

// TODO: possibly remove - testing only
export const getBlockTime = async (blockNumber = 'latest') => {
  const { Web3 } = await getAPI()

  const blockInfo = await Web3.getBlockInfo(blockNumber)
  return blockInfo.timestamp
}

export const getAccountAndTimestamp = async () => {
  const [account, timestamp] = await Promise.all([
    getCurrentAccount(),
    getBlockTime(),
  ])

  return {
    account,
    timestamp,
  }
}

export const fillDefaultAccount = account => (!account ? getCurrentAccount() : account)

export const fillNetworkId = netId => (!netId ? getCurrentNetworkId() : netId)

// ============
// DX MGN POOL
// ============

export const getPoolContracts = async () => {
  const { getDxPool, getPoolAddresses } = await getDxPoolAPI()
  
  const [pool1Address, pool2Address] = await getPoolAddresses()
  
  return Promise.all([getDxPool(pool1Address), getDxPool(pool2Address)])
}

/**
 * getTotalPoolShares
 * @returns { BN[] } - [<totalPoolShare1>, <totalPoolShare2>]
 */
export const getTotalPoolShares = async () => {
  const [dxPool1, dxPool2] = await getPoolContracts()

  const [totalPoolShare1, totalPoolShare2] = await Promise.all([
    dxPool1.totalPoolShares.call(),
    dxPool2.totalPoolShares.call(),
  ])

  return [totalPoolShare1, totalPoolShare2]
}

export const getMGNTokenAddress = async () => {
  const { getMGNAddress, getPoolAddresses } = await getDxPoolAPI()
  const [pool1Address] = await getPoolAddresses()

  return getMGNAddress(pool1Address)
}

export const getMGNTokenBalance = async (userAddress) => {
  userAddress = await fillDefaultAccount(userAddress)
  
  const { getMGNAddress, getMGNBalance, getPoolAddresses } = await getDxPoolAPI()
  const [pool1Address] = await getPoolAddresses()
  const mgnAddress = await getMGNAddress(pool1Address)

  return getMGNBalance(mgnAddress, userAddress)
}

export const getPoolTokensInfo = async () => {
  const [{ hft }, [dxPool1]] = await Promise.all([
    getAppContracts(),
    getPoolContracts(),
  ])

  const [dtAddress, stAddress] = await Promise.all([
    dxPool1.depositToken.call(),
    dxPool1.secondaryToken.call(),
  ])

  const [depositToken, secondaryToken] = await Promise.all([
    hft.at(dtAddress),
    hft.at(stAddress),
  ])

  return [
    {
      title: 'Deposit Token',
      name: await depositToken.name.call() || 'Unknown token name',
      symbol: await depositToken.symbol.call() || 'Unknown token symbol',
      decimals: (await depositToken.decimals.call()).toNumber() || 18,
    },
    {
      title: 'Secondary Token',
      name: await secondaryToken.name.call() || 'Unknown token name',
      symbol: await secondaryToken.symbol.call() || 'Unknown token symbol',
      decimals: (await secondaryToken.decimals.call()).toNumber() || 18,
    },
  ]
}

export const calculateUserParticipation = async (address) => {
  address = await fillDefaultAccount(address)
  const [dxPool1, dxPool2] = await getPoolContracts()

  const [participationsByAddress1, participationsByAddress2] = await Promise.all([
    dxPool1.poolSharesByAddress.call(address),
    dxPool2.poolSharesByAddress.call(address),
  ])
  
  // Accum all indices
  const totalUserParticipation1 = participationsByAddress1.reduce((accum, item) => accum.add(item), toBN(0))
  const totalUserParticipation2 = participationsByAddress2.reduce((accum, item) => accum.add(item), toBN(0))
  
  return [totalUserParticipation1, totalUserParticipation2]
}

export const approveAndDepositIntoDxMgnPool = async (pool, depositAmount, userAccount) => {
  userAccount = await fillDefaultAccount(userAccount)
  const {
    dxMP1Address,
    dxMP2Address,
    dxMP1DepositTokenAddress, 
    dxMP1SecondaryTokenAddress, 
    depositIntoPool1, 
    depositIntoPool2, 
  } = await getDxPoolAPI()

  console.debug('approveAndDeposit = ', {
    dxMP1Address,
    dxMP2Address,
    dxMP1DepositTokenAddress, 
    dxMP1SecondaryTokenAddress, 
    depositIntoPool1, 
    depositIntoPool2, 
  })

  const tokenAddress = (pool === 1 ? dxMP1DepositTokenAddress : dxMP1SecondaryTokenAddress)
  const poolAddress = (pool === 1 ? dxMP1Address : dxMP2Address)
  
  // Check token allowance - do we need to approve?
  const tokenAllowance = await allowance(tokenAddress, userAccount, poolAddress)
  // Approve deposit amount if necessary
  if (tokenAllowance.lt(toBN(depositAmount))) await approve(tokenAddress, poolAddress, depositAmount, userAccount)

  // Check if token = WETH and make deposits if necessary
  await depositIfETH(tokenAddress, depositAmount, userAccount)

  return pool === 1 ? depositIntoPool1(depositAmount, userAccount) : depositIntoPool2(depositAmount, userAccount)
}

/* export const withdrawMGN = async (userAccount) => {
  userAccount = await fillDefaultAccount(userAccount)


} */

/**
 * calculateDxMgnPoolState
 * @description Grabs all relevant DxMgnPool state as a batch
 * @param { string } userAccount - Address
 */
export const calculateDxMgnPoolState = async (userAccount) => {
  userAccount = await fillDefaultAccount(userAccount)

  const [
    mgnAddress, 
    mgnBalance, 
    [totalShare1, totalShare2], 
    [totalContribution1, totalContribution2],
    [depositTokenObj, secondaryTokenObj],
  ] = await Promise.all([
    getMGNTokenAddress(),
    getMGNTokenBalance(userAccount),
    getTotalPoolShares(),
    calculateUserParticipation(userAccount),
    getPoolTokensInfo(),
  ])

  return [
    mgnAddress,
    mgnBalance,
    totalShare1,
    totalShare2,
    totalContribution1,
    totalContribution2,
    depositTokenObj,
    secondaryTokenObj,
  ]
}

// ============
// MISC
// ============

/**
 * checkIfAccount
 * @param [string} account
 * @returns {string} accountAddress as string
 */
export const checkIfAccount = account => account || getCurrentAccount()


/**
 * checkIfFalseAllowance
 * WARNING - APPROVES MAX AMOUNT
 * @param {BigNumber} amount
 * @param {*} account
 * @param {*} address
 * @type {BigNumber | boolean}
 * @returns {BigNumber | boolean}
 */
// eslint-disable-next-line
export const checkIfFalseAllowance = async (amount, account, address) => {
  const { Tokens } = await getAPI()
  try {
    /**
     * Checklist
        * 1. check Allowance in Token
        * 2a. Allowance > amount
            * return false
        * 2b. Allowance < amount
            * amtLeft = amount - Allowance
            * const amtToApprove = (2 ** 255) -  amtLeft
            * return amtToApprove
     */

    const amountApprovedRemaining = await Tokens.allowance('gno', account, address)

    console.info('Amount Approved Remaining = ', amountApprovedRemaining)

    // IF there is NOT ENOUGH Allowance, RETURN amount needed to Approve
    if (amountApprovedRemaining.lt(amount)) {
      // BigNumber convert here
      // toApprove = (2^255) - amountAlreadyAllowed
      const toApprove = (toBN(2).pow(toBN(255))).sub(toBN(amountApprovedRemaining))

      console.info('Approved amount = ', toApprove)

      return toApprove
    }
    return false
  } catch (e) {
    console.error(e)
  }
}

// ================
// ERC20 TOKENS
// ================

export async function allowance(tokenName, account, spender) {
  const { Tokens } = await getAPI()
  account = await checkIfAccount(account)

  return Tokens.allowance(tokenName, account, spender)
}

export async function approve(tokenAddress, spender, amount, account) {
  const { Tokens } = await getAPI()
  account = await checkIfAccount(account)

  return Tokens.approve(tokenAddress, spender, amount, { from: account })
}

export async function getTokenBalance(tokenName, formatFromWei, account) {
  const { Tokens } = await getAPI()
  account = await checkIfAccount(account)

  const bal = await Tokens.getTokenBalance(tokenName, account)

  return formatFromWei ? fromWei(bal) : bal
}

export const transfer = async (tokenName, amount, to, account) => {
  const { Tokens } = await getAPI()
  account = await checkIfAccount(account)

  return Tokens.transfer(tokenName, to, amount, { from: account })
}

export async function depositETH(tokenAddress, depositAmount, userAccount) {
  const { Tokens } = await getAPI()
  userAccount = await checkIfAccount(userAccount)

  return Tokens.depositETH(tokenAddress, { from: userAccount, value: depositAmount })
}

export const getState = async ({ account, timestamp: time } = {}) => {
  const statePromises = Promise.all([
    time || getBlockTime(),
    getCurrentNetwork(),
  ])

  account = await checkIfAccount(account)

  const [timestamp, network] = await statePromises

  const refreshedState = {
    account,
    timestamp,
    network,
  }

  console.info('Refreshed STATE = ', refreshedState)

  return refreshedState
}

async function init() {
  const [Web3, Tokens, DxPool] = await Promise.all([
    getWeb3API(),
    getTokensAPI(),
    getDxPoolAPI(),
  ])

  console.debug('​API init -> ', { Web3, Tokens, DxPool })
  return { Web3, Tokens, DxPool }
}

/* 
 * HELPERS
 */

 /**
 * checkEthTokenBalance > returns false or EtherToken Balance
 * @param token
 * @param weiAmount
 * @param account
 * @returns boolean | BigNumber <false, amt>
 */
async function checkEthTokenBalance(
  tokenAddress,
  weiAmount,
  account,
) {
  // BYPASS[return false] => if token is not ETHER
  const ethAddress = await isETH(tokenAddress)

  if (!ethAddress) return false

  const wrappedETH = await getTokenBalance(ethAddress, false, account)
  
  // BYPASS[return false] => if wrapped Eth is enough
  // wrappedETH must be GREATER THAN OR EQUAL to WEI_AMOUNT * 1.1 (10% added for gas costs)
  if (wrappedETH.gte((weiAmount.mul(BN_4_PERCENT).div(toBN(100))))) return (console.debug('Enough WETH balance, skipping deposit.'), false)

  // Else return amount needed to wrap to make tx happen
  return weiAmount.sub(wrappedETH)
}

/**
 * isEth
 * @param {string} tokenAddress 
 * @param {string} netId 
 * @returns {boolean} - is token passed in WETH?
 */
async function isETH(tokenAddress, netId) {
  netId = await fillNetworkId(netId)

  let ETH_ADDRESS
  
  if (netId === '1') {
    // Mainnet
    const { MAINNET_WETH } = require('../globals')
    ETH_ADDRESS = MAINNET_WETH
  } else {
    // Rinkeby
    const { RINKEBY_WETH } = require('../globals')
    ETH_ADDRESS = RINKEBY_WETH
  }
  
  return tokenAddress.toUpperCase() === ETH_ADDRESS.toUpperCase() ? ETH_ADDRESS : false
}

async function depositIfETH(tokenAddress, weiAmount, userAccount) {
  const wethBalance = await checkEthTokenBalance(tokenAddress, weiAmount, userAccount)
	console.debug('TCL: depositIfETH -> wethBalance', wethBalance)

  // WETH
  if (wethBalance) return depositETH(tokenAddress, wethBalance, userAccount)

  return false
}
