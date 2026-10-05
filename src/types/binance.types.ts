export interface BinanceTickerResponse {
  symbol: string;
  price: string;
}

export interface BinanceErrorResponse {
  code: number;
  msg: string;
}
