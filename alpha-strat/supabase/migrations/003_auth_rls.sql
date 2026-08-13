-- Phase 2: Replace permissive dev policies with proper per-user RLS
-- Run AFTER signing up and assigning NULL user_id rows (see below)

-- Drop existing permissive policies on transactions
drop policy if exists "Users can view their own transactions" on transactions;
drop policy if exists "Users can insert their own transactions" on transactions;

-- Drop existing policies on positions (re-create to ensure consistency)
drop policy if exists "Users can view their own positions" on positions;
drop policy if exists "Users can insert their own positions" on positions;
drop policy if exists "Users can update their own positions" on positions;
drop policy if exists "Users can delete their own positions" on positions;

-- Positions: per-user policies
create policy "Users can view their own positions"
  on positions for select using (auth.uid() = user_id);
create policy "Users can insert their own positions"
  on positions for insert with check (auth.uid() = user_id);
create policy "Users can update their own positions"
  on positions for update using (auth.uid() = user_id);
create policy "Users can delete their own positions"
  on positions for delete using (auth.uid() = user_id);

-- Transactions: per-user policies
create policy "Users can view their own transactions"
  on transactions for select using (auth.uid() = user_id);
create policy "Users can insert their own transactions"
  on transactions for insert with check (auth.uid() = user_id);
create policy "Users can update their own transactions"
  on transactions for update using (auth.uid() = user_id);
create policy "Users can delete their own transactions"
  on transactions for delete using (auth.uid() = user_id);

-- Assign dev data to first user (run manually after signup)
-- UPDATE positions SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
-- UPDATE transactions SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
-- ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
