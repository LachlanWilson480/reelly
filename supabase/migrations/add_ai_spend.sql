-- Tracks how much AI each person has used this month (in US dollars) so the app can keep it under their plan's budget.
create table if not exists ai_spend (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start text not null,
  cost_usd numeric not null default 0,
  calls int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (user_id, month_start)
);
alter table ai_spend enable row level security;

create or replace function add_ai_spend(p_user uuid, p_month text, p_cost numeric, p_in bigint, p_out bigint)
returns void language sql security definer set search_path = public as $$
  insert into ai_spend (user_id, month_start, cost_usd, calls, input_tokens, output_tokens)
  values (p_user, p_month, p_cost, 1, p_in, p_out)
  on conflict (user_id, month_start) do update set
    cost_usd = ai_spend.cost_usd + excluded.cost_usd,
    calls = ai_spend.calls + 1,
    input_tokens = ai_spend.input_tokens + excluded.input_tokens,
    output_tokens = ai_spend.output_tokens + excluded.output_tokens;
$$;
revoke all on function add_ai_spend(uuid, text, numeric, bigint, bigint) from public, anon, authenticated;
