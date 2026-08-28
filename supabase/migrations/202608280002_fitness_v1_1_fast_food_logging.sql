create table public.favourite_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  normalized_name text not null check (char_length(trim(normalized_name)) between 1 and 120),
  calories integer not null check (calories >= 0),
  protein_g numeric(6,2) check (protein_g is null or protein_g >= 0),
  default_meal_type text check (default_meal_type is null or default_meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  default_meal_type text check (default_meal_type is null or default_meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_meal_id uuid not null references public.saved_meals(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  calories integer not null check (calories >= 0),
  protein_g numeric(6,2) check (protein_g is null or protein_g >= 0),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (saved_meal_id, position)
);

create index favourite_foods_user_updated_idx on public.favourite_foods (user_id, updated_at desc);
create index saved_meals_user_updated_idx on public.saved_meals (user_id, updated_at desc);
create index saved_meal_items_parent_idx on public.saved_meal_items (saved_meal_id, position);

create trigger favourite_foods_set_updated_at before update on public.favourite_foods
for each row execute function public.set_updated_at();

create trigger saved_meals_set_updated_at before update on public.saved_meals
for each row execute function public.set_updated_at();

alter table public.favourite_foods enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;

create policy "favourite_foods_select_own" on public.favourite_foods for select using (auth.uid() = user_id);
create policy "favourite_foods_insert_own" on public.favourite_foods for insert with check (auth.uid() = user_id);
create policy "favourite_foods_update_own" on public.favourite_foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favourite_foods_delete_own" on public.favourite_foods for delete using (auth.uid() = user_id);

create policy "saved_meals_select_own" on public.saved_meals for select using (auth.uid() = user_id);
create policy "saved_meals_insert_own" on public.saved_meals for insert with check (auth.uid() = user_id);
create policy "saved_meals_update_own" on public.saved_meals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_meals_delete_own" on public.saved_meals for delete using (auth.uid() = user_id);

create policy "saved_meal_items_select_own" on public.saved_meal_items for select using (auth.uid() = user_id);
create policy "saved_meal_items_insert_own" on public.saved_meal_items for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.saved_meals meal
    where meal.id = saved_meal_id and meal.user_id = auth.uid()
  )
);
create policy "saved_meal_items_update_own" on public.saved_meal_items for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.saved_meals meal
    where meal.id = saved_meal_id and meal.user_id = auth.uid()
  )
);
create policy "saved_meal_items_delete_own" on public.saved_meal_items for delete using (
  auth.uid() = user_id and exists (
    select 1 from public.saved_meals meal
    where meal.id = saved_meal_id and meal.user_id = auth.uid()
  )
);
