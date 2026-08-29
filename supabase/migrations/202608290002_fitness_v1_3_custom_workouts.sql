alter table public.profiles
  add column has_adjustable_dumbbells boolean not null default false,
  add column dumbbell_max_kg numeric(6,2),
  add column has_bench boolean not null default false,
  add column has_pull_up_bar boolean not null default false,
  add constraint profiles_dumbbell_max_check
    check (dumbbell_max_kg is null or dumbbell_max_kg > 0);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  category text not null check (category in ('chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'other')),
  load_type text not null check (load_type in ('per_dumbbell', 'total', 'bodyweight', 'none')),
  progression_step_kg numeric(6,2) check (progression_step_kg is null or progression_step_kg >= 0),
  requires_dumbbells boolean not null default false,
  requires_bench boolean not null default false,
  requires_pull_up_bar boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index exercises_system_name_idx on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_idx on public.exercises (user_id, lower(name)) where user_id is not null;

insert into public.exercises (id, name, category, load_type, progression_step_kg, requires_dumbbells, requires_bench, requires_pull_up_bar) values
  ('10000000-0000-0000-0000-000000000001', 'Dumbbell Bench Press', 'chest', 'per_dumbbell', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000002', 'Incline Dumbbell Press', 'chest', 'per_dumbbell', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000003', 'Dumbbell Fly', 'chest', 'per_dumbbell', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000004', 'Push-Up', 'chest', 'bodyweight', null, false, false, false),
  ('10000000-0000-0000-0000-000000000005', 'One-Arm Dumbbell Row', 'back', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000006', 'Chest-Supported Dumbbell Row', 'back', 'per_dumbbell', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000007', 'Dumbbell Pullover', 'back', 'total', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000008', 'Dead Hang', 'back', 'bodyweight', null, false, false, true),
  ('10000000-0000-0000-0000-000000000009', 'Assisted Pull-Up', 'back', 'bodyweight', null, false, false, true),
  ('10000000-0000-0000-0000-000000000010', 'Negative Pull-Up', 'back', 'bodyweight', null, false, false, true),
  ('10000000-0000-0000-0000-000000000011', 'Pull-Up', 'back', 'bodyweight', null, false, false, true),
  ('10000000-0000-0000-0000-000000000012', 'Dumbbell Shoulder Press', 'shoulders', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000013', 'Dumbbell Lateral Raise', 'shoulders', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000014', 'Front Raise', 'shoulders', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000015', 'Rear Delt Fly', 'shoulders', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000016', 'Dumbbell Curl', 'arms', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000017', 'Hammer Curl', 'arms', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000018', 'Concentration Curl', 'arms', 'per_dumbbell', 1, true, false, false),
  ('10000000-0000-0000-0000-000000000019', 'Overhead Dumbbell Tricep Extension', 'arms', 'total', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000020', 'Dumbbell Skull Crusher', 'arms', 'per_dumbbell', 1, true, true, false),
  ('10000000-0000-0000-0000-000000000021', 'Goblet Squat', 'legs', 'total', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000022', 'Dumbbell Squat', 'legs', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000023', 'Bulgarian Split Squat', 'legs', 'per_dumbbell', 2.5, true, true, false),
  ('10000000-0000-0000-0000-000000000024', 'Dumbbell Romanian Deadlift', 'legs', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000025', 'Reverse Lunge', 'legs', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000026', 'Dumbbell Calf Raise', 'legs', 'per_dumbbell', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000027', 'Plank', 'core', 'none', null, false, false, false),
  ('10000000-0000-0000-0000-000000000028', 'Leg Raise', 'core', 'bodyweight', null, false, false, false),
  ('10000000-0000-0000-0000-000000000029', 'Crunch', 'core', 'bodyweight', null, false, false, false),
  ('10000000-0000-0000-0000-000000000030', 'Weighted Crunch', 'core', 'total', 2.5, true, false, false),
  ('10000000-0000-0000-0000-000000000031', 'Dead Bug', 'core', 'none', null, false, false, false),
  ('10000000-0000-0000-0000-000000000032', 'Glute Bridge', 'legs', 'bodyweight', null, false, false, false),
  ('10000000-0000-0000-0000-000000000033', 'Band Lat Pulldown', 'back', 'none', null, false, false, false);

create trigger exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

alter table public.workout_template_exercises
  add column exercise_id uuid references public.exercises(id) on delete set null,
  add column include_in_light boolean not null default false,
  add column light_target_sets integer,
  add constraint workout_template_exercises_light_sets_check
    check (light_target_sets is null or light_target_sets between 1 and 10);

update public.workout_template_exercises template_exercise
set exercise_id = exercise.id
from public.exercises exercise
where exercise.user_id is null
  and lower(exercise.name) = lower(template_exercise.exercise_name);

update public.workout_template_exercises
set exercise_id = '10000000-0000-0000-0000-000000000012'
where lower(exercise_name) = 'dumbbell overhead press'
  and exercise_id is null;

update public.workout_template_exercises
set include_in_light = true,
    light_target_sets = least(target_sets, 2)
where position < 3;

alter table public.workout_sessions
  drop constraint workout_sessions_template_id_fkey,
  alter column template_id drop not null,
  add column title text,
  add column logged_retrospectively boolean not null default false,
  add constraint workout_sessions_title_check check (title is null or char_length(trim(title)) between 1 and 120),
  add constraint workout_sessions_template_id_fkey foreign key (template_id) references public.workout_templates(id) on delete set null;

update public.workout_sessions session
set title = template.name
from public.workout_templates template
where session.template_id = template.id
  and session.title is null;

drop policy "workout_sessions_insert_own" on public.workout_sessions;
drop policy "workout_sessions_update_own" on public.workout_sessions;

create policy "workout_sessions_insert_own" on public.workout_sessions for insert with check (
  auth.uid() = user_id and (
    template_id is null or exists (
      select 1 from public.workout_templates template
      where template.id = template_id and template.user_id = auth.uid()
    )
  )
);
create policy "workout_sessions_update_own" on public.workout_sessions for update
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (
    template_id is null or exists (
      select 1 from public.workout_templates template
      where template.id = template_id and template.user_id = auth.uid()
    )
  )
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name_snapshot text not null check (char_length(trim(exercise_name_snapshot)) between 1 and 120),
  position integer not null check (position >= 0),
  load_type text not null check (load_type in ('per_dumbbell', 'total', 'bodyweight', 'none')),
  target_sets integer not null check (target_sets between 1 and 20),
  target_rep_min integer not null check (target_rep_min >= 0),
  target_rep_max integer not null check (target_rep_max >= target_rep_min),
  progression_step_kg numeric(6,2) check (progression_step_kg is null or progression_step_kg >= 0),
  status text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_at timestamptz not null default now()
);

create index workout_session_exercises_session_idx on public.workout_session_exercises (session_id, position);
create index workout_session_exercises_exercise_idx on public.workout_session_exercises (user_id, exercise_id, created_at desc);

alter table public.exercise_sets
  add column session_exercise_id uuid references public.workout_session_exercises(id) on delete cascade;

with historical_exercises as (
  select
    gen_random_uuid() as id,
    session.user_id,
    session.id as session_id,
    exercise.id as exercise_id,
    set_row.exercise_name as exercise_name_snapshot,
    row_number() over (partition by session.id order by min(set_row.created_at), set_row.exercise_name) - 1 as position,
    coalesce(exercise.load_type, case when bool_and(set_row.weight_kg is null) then 'bodyweight' else 'total' end) as load_type,
    greatest(count(*)::integer, 1) as target_sets,
    0 as target_rep_min,
    greatest(max(set_row.reps), 0) as target_rep_max,
    exercise.progression_step_kg,
    'completed' as status,
    min(set_row.created_at) as created_at
  from public.exercise_sets set_row
  join public.workout_sessions session on session.id = set_row.session_id
  left join public.exercises exercise on lower(exercise.name) = lower(set_row.exercise_name) and exercise.user_id is null
  group by session.user_id, session.id, set_row.exercise_name, exercise.id, exercise.load_type, exercise.progression_step_kg
)
insert into public.workout_session_exercises (
  id, user_id, session_id, exercise_id, exercise_name_snapshot, position, load_type,
  target_sets, target_rep_min, target_rep_max, progression_step_kg, status, created_at
)
select id, user_id, session_id, exercise_id, exercise_name_snapshot, position, load_type,
  target_sets, target_rep_min, target_rep_max, progression_step_kg, status, created_at
from historical_exercises;

update public.exercise_sets set_row
set session_exercise_id = session_exercise.id
from public.workout_session_exercises session_exercise
where session_exercise.session_id = set_row.session_id
  and session_exercise.exercise_name_snapshot = set_row.exercise_name
  and set_row.session_exercise_id is null;

alter table public.exercises enable row level security;
alter table public.workout_session_exercises enable row level security;

create policy "exercises_select_available" on public.exercises for select to authenticated
using (user_id is null or auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises for insert
with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises for delete
using (auth.uid() = user_id);

create policy "workout_session_exercises_select_own" on public.workout_session_exercises for select
using (auth.uid() = user_id);
create policy "workout_session_exercises_insert_own" on public.workout_session_exercises for insert
with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  ) and (
    exercise_id is null or exists (
      select 1 from public.exercises available
      where available.id = exercise_id and (available.user_id is null or available.user_id = auth.uid())
    )
  )
);
create policy "workout_session_exercises_update_own" on public.workout_session_exercises for update
using (auth.uid() = user_id) with check (
  auth.uid() = user_id and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  ) and (
    exercise_id is null or exists (
      select 1 from public.exercises available
      where available.id = exercise_id and (available.user_id is null or available.user_id = auth.uid())
    )
  )
);
create policy "workout_session_exercises_delete_own" on public.workout_session_exercises for delete
using (auth.uid() = user_id);
