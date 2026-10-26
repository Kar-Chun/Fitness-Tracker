begin;

-- Run with psql -v ON_ERROR_STOP=1 -f <this file> after the migrations.
-- Every fixture is rolled back. No pgTAP extension is required.
insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'starter-new@example.test'),
  ('00000000-0000-4000-8000-000000000102', 'authenticated', 'authenticated', 'starter-custom@example.test'),
  ('00000000-0000-4000-8000-000000000103', 'authenticated', 'authenticated', 'starter-history@example.test'),
  ('00000000-0000-4000-8000-000000000104', 'authenticated', 'authenticated', 'starter-rollback@example.test');

insert into public.profiles (user_id, age, sex, height_cm, goal, activity_level)
select id, 30, 'female', 165, 'gain', 'light' from auth.users
where id in ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000104');

insert into public.workout_templates (user_id, name)
values ('00000000-0000-4000-8000-000000000102', 'Workout A');
insert into public.workout_sessions (user_id, mode, title)
values ('00000000-0000-4000-8000-000000000103', 'normal', 'My previous quick workout');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select public.ensure_starter_workout_program();
select public.ensure_starter_workout_program();

do $$
begin
  if (select count(*) from public.workout_templates) <> 2 then raise exception 'Expected exactly two owner routines after retries'; end if;
  if exists (select 1 from public.workout_templates where program_key <> 'steady-starter-ab-v1' or program_key is null) then raise exception 'Missing program metadata'; end if;
  if (select count(*) from public.workout_template_exercises) <> 11 then raise exception 'Expected all 11 exercises'; end if;
  if (select sum(target_sets) from public.workout_template_exercises e join public.workout_templates t on t.id = e.template_id where t.name like 'Workout A%') <> 13 then raise exception 'Workout A must have 13 sets'; end if;
  if (select sum(target_sets) from public.workout_template_exercises e join public.workout_templates t on t.id = e.template_id where t.name like 'Workout B%') <> 14 then raise exception 'Workout B must have 14 sets'; end if;
  if exists (
    select 1 from public.workout_template_exercises e
    left join public.exercises library on library.id = e.exercise_id
    where library.id is null or (e.progression_step_kg is distinct from library.progression_step_kg)
  ) then raise exception 'Exercise identities and load progression must use the library'; end if;
  if exists (
    select 1 from public.workout_template_exercises
    where target_rep_min <> case when exercise_name = 'Glute Bridge' then 10 when exercise_name = 'DB Lateral Raise' then 12 else 8 end
       or target_rep_max <> case when exercise_name in ('Glute Bridge', 'DB Lateral Raise') then 15 else 12 end
       or include_in_light <> (position < 3)
       or light_target_sets is distinct from case when position < 3 then 2 else null end
  ) then raise exception 'Rep ranges and Light targets must match the program'; end if;
end;
$$;

do $$
begin
  if (select jsonb_agg(jsonb_build_array(e.exercise_name, e.target_sets) order by e.position)
      from public.workout_template_exercises e join public.workout_templates t on t.id = e.template_id
      where t.name like 'Workout A%') <> '[ ["DB Bench Press",3], ["One-Arm Row",3], ["Goblet Squat",3], ["Glute Bridge",2], ["DB Bicep Curl",2] ]'::jsonb then raise exception 'Workout A exercise order or set targets are incorrect'; end if;
  if (select jsonb_agg(jsonb_build_array(e.exercise_name, e.target_sets) order by e.position)
      from public.workout_template_exercises e join public.workout_templates t on t.id = e.template_id
      where t.name like 'Workout B%') <> '[ ["DB Floor Press",3], ["One-Arm Row",3], ["Goblet Squat",2], ["Sliding Hamstring Curl",2], ["DB Tricep Extension",2], ["DB Lateral Raise",2] ]'::jsonb then raise exception 'Workout B exercise order or set targets are incorrect'; end if;
end;
$$;

update public.workout_templates set name = 'My edited routine' where name like 'Workout A%';
select public.ensure_starter_workout_program();
do $$ begin
  if not exists (select 1 from public.workout_templates where name = 'My edited routine') then raise exception 'Edited routine was overwritten'; end if;
end $$;

delete from public.workout_templates;
select public.ensure_starter_workout_program();
do $$ begin
  if exists (select 1 from public.workout_templates) then raise exception 'Deleted starter routines were recreated'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);
select public.ensure_starter_workout_program();
do $$ begin
  if (select count(*) from public.workout_templates) <> 1 or not exists (select 1 from public.workout_templates where name = 'Workout A' and program_key is null) then raise exception 'Custom routines were changed'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000103', true);
select public.ensure_starter_workout_program();
do $$ begin
  if exists (select 1 from public.workout_templates) then raise exception 'Historical workout account was seeded'; end if;
  if (select count(*) from public.workout_sessions) <> 1 then raise exception 'Workout history changed'; end if;
end $$;

reset role;
do $$ begin
  if has_function_privilege('anon', 'public.ensure_starter_workout_program()', 'execute') then raise exception 'Anonymous access must be denied'; end if;
end $$;

-- Simulate a missing library dependency; neither a partial routine nor the
-- initialization marker may survive the failed call.
update public.exercises set name = 'Temporarily unavailable bench press'
where user_id is null and name = 'Dumbbell Bench Press';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000104', true);
do $$
begin
  begin
    perform public.ensure_starter_workout_program();
    raise exception 'Expected missing library error';
  exception when raise_exception then
    if sqlerrm <> 'Starter exercise library is incomplete.' then raise; end if;
  end;
  if exists (select 1 from public.workout_templates) then raise exception 'Failed seed left a partial routine'; end if;
  if (select starter_workouts_initialized from public.profiles where user_id = auth.uid()) then raise exception 'Failed seed set the initialization marker'; end if;
end;
$$;

rollback;
