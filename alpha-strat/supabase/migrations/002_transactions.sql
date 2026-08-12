create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  position_id uuid references positions(id) on delete cascade not null,
  ticker text not null,
  type text not null check (type in ('buy', 'sell')),
  quantity numeric not null check (quantity > 0),
  price_per_share numeric not null check (price_per_share > 0),
  transacted_at timestamptz default now() not null
);

alter table transactions enable row level security;

create policy "Users can view their own transactions"
  on transactions for select using (true);

create policy "Users can insert their own transactions"
  on transactions for insert with check (true);

create index idx_transactions_position_id on transactions(position_id);
create index idx_transactions_user_id on transactions(user_id);

-- Allow quantity = 0 for sold-out positions (preserves transaction history)
alter table positions drop constraint if exists positions_quantity_check;
alter table positions add constraint positions_quantity_check check (quantity >= 0);
