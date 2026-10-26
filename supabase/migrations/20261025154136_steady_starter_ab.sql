-- Additive metadata: existing routines, exercises, sessions and sets stay intact.
alter table public.profiles
  add column if not exists starter_workouts_initialized boolean not null default false;
alter table public.workout_templates
  add column if not exists program_key text;

-- Reuse canonical library exercises; only add the two missing movements.
insert into public.exercises (name, category, load_type, progression_step_kg, requires_dumbbells)
values
  ('Dumbbell Floor Press', 'chest', 'per_dumbbell', 2.5, true),
  ('Sliding Hamstring Curl', 'legs', 'bodyweight', null, false)
on conflict (lower(name)) where user_id is null do nothing;

create or replace function public.ensure_starter_workout_program()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  initialized boolean;
  routine_id uuid;
  routine record;
begin
  if owner_id is null then raise exception 'Authentication required.'; end if;

  -- Serialize repeated / concurrent requests for this owner. The marker also
  -- respects deliberate deletion of all starter routines before any workout.
  select starter_workouts_initialized into initialized
  from public.profiles where user_id = owner_id for update;
  if not found then raise exception 'Complete your profile before adding starter workouts.'; end if;
  if initialized then return; end if;

  if not exists (select 1 from public.workout_templates where user_id = owner_id)
     and not exists (select 1 from public.workout_sessions where user_id = owner_id) then
    for routine in
      select * from (values
        ('Workout A — Main Lifts + Biceps', '[
          {"name":"DB Bench Press","library":"Dumbbell Bench Press","sets":3,"min":8,"max":12},
          {"name":"One-Arm Row","library":"One-Arm Dumbbell Row","sets":3,"min":8,"max":12},
          {"name":"Goblet Squat","library":"Goblet Squat","sets":3,"min":8,"max":12},
          {"name":"Glute Bridge","library":"Glute Bridge","sets":2,"min":10,"max":15},
          {"name":"DB Bicep Curl","library":"Dumbbell Curl","sets":2,"min":8,"max":12}
        ]'::jsonb),
        ('Workout B — Full Body + Triceps', '[
          {"name":"DB Floor Press","library":"Dumbbell Floor Press","sets":3,"min":8,"max":12},
          {"name":"One-Arm Row","library":"One-Arm Dumbbell Row","sets":3,"min":8,"max":12},
          {"name":"Goblet Squat","library":"Goblet Squat","sets":2,"min":8,"max":12},
          {"name":"Sliding Hamstring Curl","library":"Sliding Hamstring Curl","sets":2,"min":8,"max":12},
          {"name":"DB Tricep Extension","library":"Overhead Dumbbell Tricep Extension","sets":2,"min":8,"max":12},
          {"name":"DB Lateral Raise","library":"Dumbbell Lateral Raise","sets":2,"min":12,"max":15}
        ]'::jsonb)
      ) as program(name, exercises)
    loop
      insert into public.workout_templates (user_id, name, program_key)
      values (owner_id, routine.name, 'steady-starter-ab-v1') returning id into routine_id;

      -- Fail the transaction if a required library entry is missing rather than
      -- silently seeding a partial routine with incorrect load semantics.
      if exists (
        select 1 from jsonb_array_elements(routine.exercises) item
        where not exists (
          select 1 from public.exercises library
          where library.user_id is null and lower(library.name) = lower(item ->> 'library')
        )
      ) then raise exception 'Starter exercise library is incomplete.'; end if;

      insert into public.workout_template_exercises (
        user_id, template_id, exercise_id, exercise_name, position,
        target_sets, target_rep_min, target_rep_max, progression_step_kg,
        include_in_light, light_target_sets
      )
      select owner_id, routine_id, library.id, item ->> 'name', ordinality - 1,
        (item ->> 'sets')::integer, (item ->> 'min')::integer, (item ->> 'max')::integer,
        library.progression_step_kg, ordinality <= 3,
        case when ordinality <= 3 then least(2, (item ->> 'sets')::integer) else null end
      from jsonb_array_elements(routine.exercises) with ordinality as items(item, ordinality)
      join public.exercises library on library.user_id is null and lower(library.name) = lower(item ->> 'library');
    end loop;
  end if;

  update public.profiles set starter_workouts_initialized = true where user_id = owner_id;
end;
$$;

revoke all on function public.ensure_starter_workout_program() from public, anon;
grant execute on function public.ensure_starter_workout_program() to authenticated;
