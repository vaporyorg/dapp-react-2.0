export const ETHEREUM_NETWORKS = {
  MAIN: 'MAIN',
  MORDEN: 'MORDEN',
  ROPSTEN: 'ROPSTEN',
  RINKEBY: 'RINKEBY',
  KOVAN: 'KOVAN',
  UNKNOWN: 'UNKNOWN',
}

export const networkById = {
  1: ETHEREUM_NETWORKS.MAIN,
  2: ETHEREUM_NETWORKS.MORDEN,
  3: ETHEREUM_NETWORKS.ROPSTEN,
  4: ETHEREUM_NETWORKS.RINKEBY,
  42: ETHEREUM_NETWORKS.KOVAN,
}

export const GAS_LIMIT = 4000000
export const GAS_PRICE = 5e9

export const WEBSOCKET_URLS = {
  MAIN: 'wss://mainnet.infura.io/ws/v3/fb2b930672ff4872bfcad69671f2dfd4',
  RINKEBY: 'wss://rinkeby.infura.io/ws/v3/fb2b930672ff4872bfcad69671f2dfd4',
  KOVAN: 'wss://kovan.infura.io/ws/v3/fb2b930672ff4872bfcad69671f2dfd4',
  MORDEN: 'wss://morden.infura.io/ws/v3/fb2b930672ff4872bfcad69671f2dfd4',
  ROPSTEN: 'wss://ropsten.infura.io/ws/v3/fb2b930672ff4872bfcad69671f2dfd4',
  LOCAL: 'ws://localhost:8545/ws',
}
