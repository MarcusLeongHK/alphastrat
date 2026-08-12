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
  ticker: string;
  quantity: number;
  cost_basis: number;
}
