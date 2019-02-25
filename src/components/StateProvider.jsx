import React, { useReducer, useEffect } from 'react'
import { 
  getAPI,
  getPoolTokensInfo, 
  approveAndDepositIntoDxMgnPool,
  calculateDxMgnPoolState,
} from '../api'

import { toBN, toWei } from '../api/utils'

const defaultState = {
  USER: {
    ACCOUNT: 'CONNECTION ERROR',
    BALANCE: undefined,
  },
  PROVIDER: {
    ACTIVE_PROVIDER: null,
    NETWORK: 'NETWORK NOT SUPPORTED',
    PROVIDERS: [],
  },
  DX_MGN_POOL: {
    POOL1: {
      YOUR_SHARE: 0,
      TOTAL_SHARE: 0,
      DEPOSIT_TOKEN: '...',
      DEPOSIT_SYMBOL: '...',
      DEPOSIT_DECIMALS: '...',
      SECONDARY_TOKEN: '...',
      SECONDARY_SYMBOL: '...',
      SECONDARY_DECIMALS: '...',
      TOKEN_BALANCE: '...',
    },
    POOL2: {
      YOUR_SHARE: 0,
      TOTAL_SHARE: 0,
      POSIT_TOKEN: '...',
      DEPOSIT_SYMBOL: '...',
      DEPOSIT_DECIMALS: '...',
      SECONDARY_TOKEN: '...',
      SECONDARY_SYMBOL: '...',
      SECONDARY_DECIMALS: '...',
      TOKEN_BALANCE: '...',
    },
  },
  TOKEN_MGN: {
    ADDRESS: undefined,
    BALANCE: undefined,
    LOCKED_BALANCE: undefined,
    UNLOCKED_BALANCE: undefined,
  },
  CONTRACTS: {},
  SHOW_MODAL: undefined,
  LOADING: false,
  INPUT_AMOUNT: 0,
}

const { Provider, Consumer } = React.createContext(defaultState)

const setToContext = new WeakMap()
const memoizedContextValue = ({
  state,
  // Dispatchers
  appLoading,
  setDxMgnPoolState,
  setUserState,
  registerProviders,
  saveContract,
  setActiveProvider,
  saveTotalPoolShares,
  saveMGNAddressAndBalance,
  setUserParticipation,
  showModal,
  setDepositAmount,
  setInputAmount,
  setPoolTokenInfo,
}) => {
  // console.error(state)
  if (setToContext.has(state)) return setToContext.get(state)

  const contextValue = { 
    state, 
    appLoading, 
    setUserState, 
    setDxMgnPoolState, 
    registerProviders, 
    setActiveProvider, 
    saveTotalPoolShares, 
    saveContract, 
    saveMGNAddressAndBalance, 
    setUserParticipation,
    showModal,
    setDepositAmount,
    setInputAmount,
    setPoolTokenInfo,
  }

  setToContext.set(state, contextValue)
  return contextValue
}

// CONSTANTS
const SET_ACTIVE_PROVIDER = 'SET_ACTIVE_PROVIDER'
const REGISTER_PROVIDERS = 'REGISTER_PROVIDERS'
const SET_APP_LOADING = 'SET_APP_LOADING'
const SHOW_MODAL = 'SHOW_MODAL'
const SET_INPUT_AMOUNT = 'SET_INPUT_AMOUNT'
const SET_USER_STATE = 'SET_USER_STATE'
const SET_POOL_TOKEN_INFO = 'SET_POOL_TOKEN_INFO'
const SET_USER_ACCOUNT = 'SET_USER_ACCOUNT'
const SET_USER_BALANCE = 'SET_USER_BALANCE'
const SET_MGN_BALANCES = 'SET_MGN_BALANCES'
const SET_DX_MGN_POOL_STATE = 'SET_DX_MGN_POOL_STATE'

function reducer(state, action) {
  switch (action.type) {
    /* 
     * DX-MGN-POOL SPECIFIC REDUCERS
     */

    case SET_INPUT_AMOUNT:
      return {
        ...state,
        INPUT_AMOUNT: action.payload,
      }

    case SET_MGN_BALANCES:
      console.error(action)
      return {
        ...state,
        TOKEN_MGN: {
          ...state.TOKEN_MGN,
          ...action.payload,
        },
      }

    case SET_POOL_TOKEN_INFO:
      return {
        ...state,
        DX_MGN_POOL: {
          ...state.DX_MGN_POOL,
          POOL1: {
            ...state.DX_MGN_POOL.POOL1,
            DEPOSIT_TOKEN: action.payload.name,
            DEPOSIT_SYMBOL: action.payload.symbol,
            SECONDARY_TOKEN: action.payload.name2,
            SECONDARY_SYMBOL: action.payload.symbol2,
            TOKEN_BALANCE: action.payload.balance,
          },
          POOL2: {
            ...state.DX_MGN_POOL.POOL2,
            DEPOSIT_TOKEN: action.payload.name2,
            DEPOSIT_SYMBOL: action.payload.symbol2,
            SECONDARY_TOKEN: action.payload.name,
            SECONDARY_SYMBOL: action.payload.symbol,
            TOKEN_BALANCE: action.payload.balance2,
          },
        },
      }

    case SET_DX_MGN_POOL_STATE:
      return {
        ...state,
        DX_MGN_POOL: {
          ...state.DX_MGN_POOL,
          POOL1: {
            ...state.DX_MGN_POOL.POOL1,
            ...action.payload.POOL1,
          },
          POOL2: {
            ...state.DX_MGN_POOL.POOL2,
            ...action.payload.POOL2,
          },
        },
      }

    /*
     * USER STATE SPECIFIC REDUCERS 
     */

    case SET_USER_ACCOUNT:
      return {
        ...state,
        USER: {
          ...state.USER,
          ACCOUNT: action.payload,
        },
      }

    case SET_USER_BALANCE:
      return {
        ...state,
        USER: {
          ...state.USER,
          BALANCE: action.payload,
        },
      }

    case SET_USER_STATE:
      return {
        ...state,
        USER: {
          ...state.USER,
          ...action.payload.USER,
        },
        PROVIDER: {
          ...state.PROVIDER,
          ...action.payload.PROVIDER,
        },
      }

    /* 
     * PROVIDER SPECIFIC REDUCERS
     */

    case SET_ACTIVE_PROVIDER:
      return {
        ...state,
        PROVIDER: {
          ...state.PROVIDER,
          ACTIVE_PROVIDER: action.payload,
        },
       }

    case REGISTER_PROVIDERS:
       return { 
        ...state,
         PROVIDER: {
           ...state.PROVIDER,
           PROVIDERS: [action.payload, ...state.PROVIDER.PROVIDERS],
         },
        }

    /* 
     * APP SPECIFIC REDUCERS
     */
      
    case SET_APP_LOADING:
      return {
        ...state,
        LOADING: action.payload,
      }

    case SHOW_MODAL:
      return {
        ...state,
        SHOW_MODAL: action.payload,
      }

    default:
       return state
  }
}

function AppProvider(props) {
  const {
    children,
    subState: [{ account }, { timestamp }, { balance: ETHBalance }, { MGN_BALANCE, LOCKED_MGN_BALANCE, UNLOCKED_MGN_BALANCE }, poolState, { network }],
  } = props
  // console.warn([{ account }, { timestamp }, { balance: ETHBalance }, MGN_BALANCE, LOCKED_MGN_BALANCE, UNLOCKED_MGN_BALANCE, poolState])
  const [state, dispatch] = useReducer(reducer, defaultState)
  
  // useEffect - only update State when subscriber user Account changes
  useEffect(() => {
    dispatch({ 
      type: SET_USER_STATE,
      payload: {
        USER: {
          ACCOUNT: account,
          BALANCE: ETHBalance,
        },
        PROVIDER: {
          NETWORK: network,
        },
      },
    }) 
  }, [account, ETHBalance, network])

  // useEffect - only update State when subscriber user Account changes
  useEffect(() => {
    dispatch({ 
      type: SET_MGN_BALANCES,
      payload: {
        MGN_BALANCE,
        LOCKED_MGN_BALANCE,
        UNLOCKED_MGN_BALANCE,
      },
    }) 
  }, [MGN_BALANCE, LOCKED_MGN_BALANCE, UNLOCKED_MGN_BALANCE])

  const dispatchers = {
    // DX-MGN DISPATCHERS
    setInputAmount: INPUT_AMOUNT =>
      dispatch({
        type: SET_INPUT_AMOUNT,
        payload: INPUT_AMOUNT,
      }),

    setDepositAmount: async (poolNumber) => {
      const { 
        USER: { ACCOUNT },
        INPUT_AMOUNT,
      } = state

      const receipt = await approveAndDepositIntoDxMgnPool(poolNumber, toBN(toWei(INPUT_AMOUNT)), ACCOUNT)
      console.debug('TCL: AppProvider -> setDepositAmount -> RECEIPT= ', receipt)
    },

    setDxMgnPoolState: async () => {
      const [
        ,,,,
        totalShare1,
        totalShare2,
        totalContribution1,
        totalContribution2,
        // TODO: can be cleaned up to used derived object names instead of duping logic
        // Deposit Token
        { name: name1, symbol: symbol1, decimals: decimals1, balance: balance1 },
        // Secondary Token
        { name: name2, symbol: symbol2, decimals: decimals2, balance: balance2 },
       ] = await calculateDxMgnPoolState(state.USER.account)
      
       return dispatch({
        type: SET_DX_MGN_POOL_STATE,
        payload: {
          POOL1: {
            YOUR_SHARE: totalContribution1,
            TOTAL_SHARE: totalShare1,
            DEPOSIT_TOKEN: name1,
            DEPOSIT_SYMBOL: symbol1,
            DEPOSIT_DECIMALS: decimals1,
            SECONDARY_TOKEN: name2,
            SECONDARY_SYMBOL: symbol2,
            SECONDARY_DECIMALS: decimals2,
            TOKEN_BALANCE: balance1,
          },
          POOL2: {
            YOUR_SHARE: totalContribution2,
            TOTAL_SHARE: totalShare2,
            DEPOSIT_TOKEN: name2,
            DEPOSIT_SYMBOL: symbol2,
            // dtDecimals: decimals2,
            SECONDARY_TOKEN: name1,
            // stSymbol: symbol1,
            // stDecimals: decimals1,
            TOKEN_BALANCE: balance2,
          },
        },
      })
    },

    setPoolTokenInfo: async () => {
      const [
        {
          name,
          symbol,
          balance,
        },
        {
          name: name2,
          symbol: symbol2,
          balance: balance2,
        },
      ] = await getPoolTokensInfo()
      
      return dispatch({
        type: SET_POOL_TOKEN_INFO,
        payload: {
          name,
          symbol,
          balance,
          name2,
          symbol2,
          balance2,
        },
      })
    },

    // USER STATE SPECIFIC DISPATCHERS
    setUserState: async () => {
      const { Web3: { getCurrentAccount, getNetwork, getCurrentBalance } } = await getAPI()
      const [ACCOUNT, BALANCE, NETWORK] = await Promise.all([
        getCurrentAccount(),
        getCurrentBalance(),
        getNetwork(),
      ])
      return dispatch({
        type: SET_USER_STATE,
        payload: { 
          ACCOUNT,
          BALANCE,
          NETWORK,
        },
      })
    },
    
    // APP SPECIFIC DISPATCHERS
    appLoading: loadingState => dispatch({
      type: SET_APP_LOADING,
      payload: loadingState, 
    }),
    showModal: message => dispatch({ 
      type: SHOW_MODAL,
      payload: message, 
    }),

    // PROVIDER DISPATCHERS
    setActiveProvider: providerName =>
      dispatch({
        type: SET_ACTIVE_PROVIDER,
        payload: providerName,
      }),

    registerProviders: provider =>
      dispatch({
        type: REGISTER_PROVIDERS,
        payload: provider,
      }),
  }
  
  console.debug({ ...state, ...dispatchers })
  return (
    <Provider value={memoizedContextValue({ state, ...dispatchers })}>
        {children}
    </Provider>
  )
}

export const connect = (mapContextToProps = ctx => ctx) => WrapComponent =>
  props => (
    <Consumer>
      {context => <WrapComponent {...props} {...mapContextToProps(context)} />}
    </Consumer>
  )

export default AppProvider
