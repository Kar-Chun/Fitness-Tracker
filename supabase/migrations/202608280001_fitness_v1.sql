create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age integer not null check (age between 13 and 120),
  sex text not null check (sex in ('female', 'male')),
  height_cm numeric(5,2) not null check (height_cm between 80 and 250),
  goal text not null check (goal in ('lose', 'maintain', 'gain')),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'active')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calorie_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calories integer not null check (calories > 0),
  effective_from date not null default current_date,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg > 0 and weight_kg < 500),
  recorded_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, recorded_on)
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  calories integer not null check (calories >= 0),
  protein_g numeric(6,2) check (protein_g is null or protein_g >= 0),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_name text not null check (char_length(trim(exercise_name)) between 1 and 120),
  position integer not null check (position >= 0),
  target_sets integer not null check (target_sets between 1 and 10),
  target_rep_min integer not null check (target_rep_min >= 0),
  target_rep_max integer not null check (target_rep_max >= target_rep_min),
  unique (template_id, position)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.workout_templates(id) on delete restrict,
  mode text not null check (mode in ('normal', 'light')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null check (char_length(trim(exercise_name)) between 1 and 120),
  set_number integer not null check (set_number between 1 and 20),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg >= 0),
  reps integer not null check (reps >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, exercise_name, set_number)
);

create index calorie_targets_user_effective_idx on public.calorie_targets (user_id, effective_from desc);
create unique index calorie_targets_one_initial_idx on public.calorie_targets (user_id, reason) where reason = 'initial_estimate';
create index weight_entries_user_date_idx on public.weight_entries (user_id, recorded_on desc);
create index food_entries_user_eaten_idx on public.food_entries (user_id, eaten_at desc);
create index workout_sessions_user_completed_idx on public.workout_sessions (user_id, completed_at desc);
create index exercise_sets_session_idx on public.exercise_sets (session_id, set_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger food_entries_set_updated_at before update on public.food_entries
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.calorie_targets enable row level security;
alter table public.weight_entries enable row level security;
alter table public.food_entries enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_sets enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

create policy "calorie_targets_select_own" on public.calorie_targets for select using (auth.uid() = user_id);
create policy "calorie_targets_insert_own" on public.calorie_targets for insert with check (auth.uid() = user_id);
create policy "calorie_targets_update_own" on public.calorie_targets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "calorie_targets_delete_own" on public.calorie_targets for delete using (auth.uid() = user_id);

create policy "weight_entries_select_own" on public.weight_entries for select using (auth.uid() = user_id);
create policy "weight_entries_insert_own" on public.weight_entries for insert with check (auth.uid() = user_id);
create policy "weight_entries_update_own" on public.weight_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weight_entries_delete_own" on public.weight_entries for delete using (auth.uid() = user_id);

create policy "food_entries_select_own" on public.food_entries for select using (auth.uid() = user_id);
create policy "food_entries_insert_own" on public.food_entries for insert with check (auth.uid() = user_id);
create policy "food_entries_update_own" on public.food_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "food_entries_delete_own" on public.food_entries for delete using (auth.uid() = user_id);

create policy "workout_templates_select_own" on public.workout_templates for select using (auth.uid() = user_id);
create policy "workout_templates_insert_own" on public.workout_templates for insert with check (auth.uid() = user_id);
create policy "workout_templates_update_own" on public.workout_templates for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_templates_delete_own" on public.workout_templates for delete using (auth.uid() = user_id);

create policy "workout_template_exercises_select_own" on public.workout_template_exercises for select using (auth.uid() = user_id);
create policy "workout_template_exercises_insert_own" on public.workout_template_exercises for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
);
create policy "workout_template_exercises_update_own" on public.workout_template_exercises for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
);
create policy "workout_template_exercises_delete_own" on public.workout_template_exercises for delete using (auth.uid() = user_id);

create policy "workout_sessions_select_own" on public.workout_sessions for select using (auth.uid() = user_id);
create policy "workout_sessions_insert_own" on public.workout_sessions for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
);
create policy "workout_sessions_update_own" on public.workout_sessions for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
);
create policy "workout_sessions_delete_own" on public.workout_sessions for delete using (auth.uid() = user_id);

create policy "exercise_sets_select_own" on public.exercise_sets for select using (auth.uid() = user_id);
create policy "exercise_sets_insert_own" on public.exercise_sets for insert with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
);
create policy "exercise_sets_update_own" on public.exercise_sets for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
);
create policy "exercise_sets_delete_own" on public.exercise_sets for delete using (auth.uid() = user_id);
