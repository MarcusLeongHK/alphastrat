create table access_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  max_uses int not null default 10,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table access_codes enable row level security;

create policy "No direct access" on access_codes for all using (false);

insert into access_codes (code, max_uses) values
  ('ALPHA', 10),
  ('BRAVO', 10),
  ('CHARLIE', 10),
  ('DELTA', 10),
  ('ECHO', 10);

-- Atomic validate-and-claim function. Bypasses RLS via security definer.
-- Returns true if the code was valid and a slot was claimed, false otherwise.
create or replace function claim_access_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated int;
begin
  update access_codes
  set used_count = used_count + 1
  where upper(code) = upper(input_code)
    and used_count < max_uses;

  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;
