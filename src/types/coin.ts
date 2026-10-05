export interface Coin {
  id: number;
  symbol: string;
  created_at: string;
}

export interface CreateCoinDTO {
  symbol: string;
}
