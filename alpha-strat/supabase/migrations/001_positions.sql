create table positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  ticker text not null,
  quantity numeric not null check (quantity > 0),
  cost_basis numeric not null check (cost_basis > 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table positions enable row level security;

create policy "Users can view their own positions"
  on positions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own positions"
  on positions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own positions"
  on positions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own positions"
  on positions for delete
  using (auth.uid() = user_id);

create index idx_positions_user_id on positions(user_id);
