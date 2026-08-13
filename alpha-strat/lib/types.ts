export interface Position {
  id: string;
  user_id: string;
  ticker: string;
  quantity: number;
  cost_basis: number;
  created_at: string;
  updated_at: string;
}

export interface PositionInsert {
  user_id: string;
  ticker: string;
  quantity: number;
  cost_basis: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  position_id: string;
  ticker: string;
  type: "buy" | "sell";
  quantity: number;
  price_per_share: number;
  transacted_at: string;
}
