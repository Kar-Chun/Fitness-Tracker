alter table public.profiles
  add column adaptive_calorie_enabled boolean not null default false;

create table public.daily_food_log_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  is_complete boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date),
  check (date <= (now() at time zone 'Asia/Singapore')::date),
  check ((is_complete and completed_at is not null) or (not is_complete))
);

create table public.calorie_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  period_start date not null,
  period_end date not null,
  previous_weight_avg numeric(6,2) not null check (previous_weight_avg > 0),
  current_weight_avg numeric(6,2) not null check (current_weight_avg > 0),
  weight_change_kg numeric(6,2) not null,
  weight_change_percent numeric(7,3) not null,
  complete_food_days integer not null check (complete_food_days >= 0),
  weight_entry_count integer not null check (weight_entry_count >= 0),
  average_calories integer not null check (average_calories >= 0),
  current_target integer not null check (current_target > 0),
  suggested_target integer check (suggested_target is null or suggested_target > 0),
  status text not null check (status in ('on_track', 'watch', 'suggest_increase', 'suggest_decrease', 'review_goal')),
  reason_code text not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  dismissed_at timestamptz,
  check (period_end >= period_start),
  check (accepted_at is null or dismissed_at is null),
  unique (user_id, period_end)
);

create index daily_food_log_status_user_date_idx
  on public.daily_food_log_status (user_id, date desc);
create index calorie_reviews_user_created_idx
  on public.calorie_reviews (user_id, created_at desc);
create index calorie_reviews_user_goal_idx
  on public.calorie_reviews (user_id, goal, period_end desc);

create trigger daily_food_log_status_set_updated_at
before update on public.daily_food_log_status
for each row execute function public.set_updated_at();

alter table public.daily_food_log_status enable row level security;
alter table public.calorie_reviews enable row level security;

create policy "daily_food_log_status_select_own" on public.daily_food_log_status
for select using (auth.uid() = user_id);
create policy "daily_food_log_status_insert_own" on public.daily_food_log_status
for insert with check (auth.uid() = user_id);
create policy "daily_food_log_status_update_own" on public.daily_food_log_status
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_food_log_status_delete_own" on public.daily_food_log_status
for delete using (auth.uid() = user_id);

create policy "calorie_reviews_select_own" on public.calorie_reviews
for select using (auth.uid() = user_id);
create policy "calorie_reviews_insert_own" on public.calorie_reviews
for insert with check (auth.uid() = user_id);
create policy "calorie_reviews_update_own" on public.calorie_reviews
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calorie_reviews_delete_own" on public.calorie_reviews
for delete using (auth.uid() = user_id);

create or replace function public.enforce_calorie_review_cooldown()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.calorie_reviews review
    where review.user_id = new.user_id
      and review.created_at > now() - interval '7 days'
  ) then
    raise exception 'A calorie review is available at most once every 7 days.';
  end if;
  return new;
end;
$$;

create trigger calorie_reviews_enforce_cooldown
before insert on public.calorie_reviews
for each row execute function public.enforce_calorie_review_cooldown();

create or replace function public.accept_calorie_review(p_review_id uuid)
returns table (target_id uuid, calories integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_review public.calorie_reviews%rowtype;
  created_target public.calorie_targets%rowtype;
begin
  select * into selected_review
  from public.calorie_reviews
  where id = p_review_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Calorie review not found.';
  end if;
  if selected_review.accepted_at is not null or selected_review.dismissed_at is not null then
    raise exception 'This calorie review has already been acknowledged.';
  end if;
  if selected_review.status not in ('suggest_increase', 'suggest_decrease')
     or selected_review.suggested_target is null then
    raise exception 'This calorie review does not contain an adjustment.';
  end if;

  insert into public.calorie_targets (user_id, calories, effective_from, reason)
  values (auth.uid(), selected_review.suggested_target, selected_review.period_end, 'adaptive_review')
  returning * into created_target;

  update public.calorie_reviews
  set accepted_at = now()
  where id = selected_review.id;

  return query select created_target.id, created_target.calories;
end;
$$;

revoke all on function public.accept_calorie_review(uuid) from public;
grant execute on function public.accept_calorie_review(uuid) to authenticated;
