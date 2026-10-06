export interface ApiKeyRow {
  id: number;
  key_value: string;
  client_name: string;
  created_at: string;
}

export interface CoinRow {
  id: number;
  symbol: string;
  name: string;
  is_active: number;
  created_at: string;
}

export interface PriceHistoryRow {
  id: number;
  coin_symbol: string;
  price_usd: number;
  fetched_at: string;
}

export interface PriceHistoryOptions {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}
