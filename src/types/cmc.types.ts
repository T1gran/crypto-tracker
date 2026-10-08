export interface CmcSimpleQuote {
  symbol: string;
  price: number;
}

export interface CmcSimpleData {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  quotes: CmcSimpleQuote[];
}

export interface CmcSimplePriceResponse {
  data: CmcSimpleData[];
  status: {
    timestamp: string;
    error_code: number | string;
    error_message: string;
    elapsed: number;
    credit_count: number;
  };
}
