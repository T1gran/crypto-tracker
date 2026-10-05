export interface PriceHistory {
  id: number;
  coin_symbol: string;
  price: number;
  timestamp: string;
}

export interface CreatePriceDTO {
  coin_symbol: string;
  price: number;
}
