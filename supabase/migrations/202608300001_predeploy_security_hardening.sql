-- A template exercise may reference a shared exercise or one owned by its caller,
-- never another user's custom exercise.
alter policy "workout_template_exercises_insert_own" on public.workout_template_exercises
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
  and (
    exercise_id is null or exists (
      select 1 from public.exercises available
      where available.id = exercise_id
        and (available.user_id is null or available.user_id = auth.uid())
    )
  )
);

alter policy "workout_template_exercises_update_own" on public.workout_template_exercises
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_templates template
    where template.id = template_id and template.user_id = auth.uid()
  )
  and (
    exercise_id is null or exists (
      select 1 from public.exercises available
      where available.id = exercise_id
        and (available.user_id is null or available.user_id = auth.uid())
    )
  )
);

-- Exercise sets must point to the caller's session and, when supplied, a session
-- exercise from that exact same session.
alter policy "exercise_sets_insert_own" on public.exercise_sets
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
  and (
    session_exercise_id is null or exists (
      select 1 from public.workout_session_exercises session_exercise
      where session_exercise.id = session_exercise_id
        and session_exercise.session_id = session_id
        and session_exercise.user_id = auth.uid()
    )
  )
);

alter policy "exercise_sets_update_own" on public.exercise_sets
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_sessions session
    where session.id = session_id and session.user_id = auth.uid()
  )
  and (
    session_exercise_id is null or exists (
      select 1 from public.workout_session_exercises session_exercise
      where session_exercise.id = session_exercise_id
        and session_exercise.session_id = session_id
        and session_exercise.user_id = auth.uid()
    )
  )
);

-- Composite foreign keys backstop the RLS parent checks for all new writes. They
-- are NOT VALID so an unexpected historical inconsistency cannot block deploy;
-- PostgreSQL still enforces them for every row written after this migration.
create unique index if not exists saved_meals_user_id_id_idx on public.saved_meals (user_id, id);
create unique index if not exists workout_templates_user_id_id_idx on public.workout_templates (user_id, id);
create unique index if not exists workout_sessions_user_id_id_idx on public.workout_sessions (user_id, id);
create unique index if not exists workout_session_exercises_user_session_id_idx on public.workout_session_exercises (user_id, session_id, id);

-- Replace the original single-column parent FKs rather than keeping two
-- equivalent PostgREST relationships, which would make nested selects
-- ambiguous. The composite replacements below retain ON DELETE CASCADE.
alter table public.saved_meal_items
  drop constraint if exists saved_meal_items_saved_meal_id_fkey;
alter table public.workout_template_exercises
  drop constraint if exists workout_template_exercises_template_id_fkey;
alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_session_id_fkey;
alter table public.exercise_sets
  drop constraint if exists exercise_sets_session_id_fkey,
  drop constraint if exists exercise_sets_session_exercise_id_fkey;

alter table public.saved_meal_items
  add constraint saved_meal_items_owned_parent_fk
  foreign key (user_id, saved_meal_id) references public.saved_meals (user_id, id)
  on delete cascade not valid;

alter table public.workout_template_exercises
  add constraint workout_template_exercises_owned_parent_fk
  foreign key (user_id, template_id) references public.workout_templates (user_id, id)
  on delete cascade not valid;

alter table public.workout_session_exercises
  add constraint workout_session_exercises_owned_parent_fk
  foreign key (user_id, session_id) references public.workout_sessions (user_id, id)
  on delete cascade not valid;

alter table public.exercise_sets
  add constraint exercise_sets_owned_session_fk
  foreign key (user_id, session_id) references public.workout_sessions (user_id, id)
  on delete cascade not valid,
  add constraint exercise_sets_owned_session_exercise_fk
  foreign key (user_id, session_id, session_exercise_id)
  references public.workout_session_exercises (user_id, session_id, id)
  on delete cascade not valid;

-- Food changes and complete-day invalidation must commit together. This avoids
-- reporting a failed save after the food row was already inserted and also
-- protects direct API writes that bypass the browser service helper.
create or replace function public.reset_daily_food_log_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.daily_food_log_status
    set is_complete = false, completed_at = null
    where user_id = old.user_id
      and date = (old.eaten_at at time zone 'Asia/Singapore')::date;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.daily_food_log_status
    set is_complete = false, completed_at = null
    where user_id = new.user_id
      and date = (new.eaten_at at time zone 'Asia/Singapore')::date;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger food_entries_reset_daily_completion
after insert or update or delete on public.food_entries
for each row execute function public.reset_daily_food_log_completion();

-- Updating a saved meal and replacing its items now succeeds or rolls back as one
-- invoker-rights statement. RLS remains the authorization boundary.
create or replace function public.save_saved_meal(
  p_meal_id uuid,
  p_name text,
  p_default_meal_type text,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
  item jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 then raise exception 'Check the meal name.'; end if;
  if p_default_meal_type is not null and p_default_meal_type not in ('breakfast', 'lunch', 'dinner', 'snack') then raise exception 'Check the meal type.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then raise exception 'Add at least one meal item.'; end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object'
       or char_length(trim(coalesce(item ->> 'name', ''))) < 1
       or (item ->> 'calories') is null
       or (item ->> 'calories')::numeric < 0
       or ((item ->> 'proteinG') is not null and (item ->> 'proteinG')::numeric < 0) then
      raise exception 'Check every saved meal item.';
    end if;
  end loop;

  if p_meal_id is null then
    insert into public.saved_meals (user_id, name, default_meal_type)
    values (auth.uid(), trim(p_name), p_default_meal_type)
    returning id into saved_id;
  else
    update public.saved_meals
    set name = trim(p_name), default_meal_type = p_default_meal_type
    where id = p_meal_id and user_id = auth.uid()
    returning id into saved_id;
    if saved_id is null then raise exception 'Saved meal not found.'; end if;
    delete from public.saved_meal_items where saved_meal_id = saved_id and user_id = auth.uid();
  end if;

  insert into public.saved_meal_items (user_id, saved_meal_id, name, calories, protein_g, position)
  select auth.uid(), saved_id, trim(value ->> 'name'), (value ->> 'calories')::integer,
    nullif(value ->> 'proteinG', '')::numeric, ordinality - 1
  from jsonb_array_elements(p_items) with ordinality;

  return saved_id;
end;
$$;

-- Routine replacement receives the same transaction guarantee and continues to
-- rely on owner-based RLS plus exercise-availability policies.
create or replace function public.save_workout_routine(
  p_routine_id uuid,
  p_name text,
  p_exercises jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_id uuid;
  exercise jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_name is null or char_length(trim(p_name)) < 1 then raise exception 'Check the routine name.'; end if;
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' then raise exception 'Check the routine exercises.'; end if;

  for exercise in select value from jsonb_array_elements(p_exercises)
  loop
    if jsonb_typeof(exercise) <> 'object'
       or char_length(trim(coalesce(exercise ->> 'exerciseName', ''))) < 1
       or coalesce(exercise ->> 'loadType', '') not in ('per_dumbbell', 'total', 'bodyweight', 'none')
       or (exercise ->> 'targetSets') is null
       or (exercise ->> 'targetRepMin') is null
       or (exercise ->> 'targetRepMax') is null
       or (exercise ->> 'targetSets')::integer < 1
       or (exercise ->> 'targetRepMin')::integer < 0
       or (exercise ->> 'targetRepMax')::integer < (exercise ->> 'targetRepMin')::integer
       or ((exercise ->> 'includeInLight')::boolean is true and (
         (exercise ->> 'lightTargetSets') is null
         or (exercise ->> 'lightTargetSets')::integer not between 1 and (exercise ->> 'targetSets')::integer
       ))
       or ((exercise ->> 'progressionStepKg') is not null and (exercise ->> 'progressionStepKg')::numeric < 0) then
      raise exception 'Check every routine exercise.';
    end if;
  end loop;

  if p_routine_id is null then
    insert into public.workout_templates (user_id, name)
    values (auth.uid(), trim(p_name))
    returning id into saved_id;
  else
    update public.workout_templates set name = trim(p_name)
    where id = p_routine_id and user_id = auth.uid()
    returning id into saved_id;
    if saved_id is null then raise exception 'Routine not found.'; end if;
    delete from public.workout_template_exercises where template_id = saved_id and user_id = auth.uid();
  end if;

  insert into public.workout_template_exercises (
    user_id, template_id, exercise_id, exercise_name, position,
    target_sets, target_rep_min, target_rep_max, include_in_light,
    light_target_sets, progression_step_kg
  )
  select auth.uid(), saved_id, nullif(value ->> 'exerciseId', '')::uuid,
    trim(value ->> 'exerciseName'), ordinality - 1,
    (value ->> 'targetSets')::integer, (value ->> 'targetRepMin')::integer,
    (value ->> 'targetRepMax')::integer, coalesce((value ->> 'includeInLight')::boolean, false),
    case when coalesce((value ->> 'includeInLight')::boolean, false)
      then least(coalesce((value ->> 'lightTargetSets')::integer, 2), (value ->> 'targetSets')::integer)
      else null end,
    nullif(value ->> 'progressionStepKg', '')::numeric
  from jsonb_array_elements(p_exercises) with ordinality;

  return saved_id;
end;
$$;

revoke all on function public.reset_daily_food_log_completion() from public, anon, authenticated;
revoke all on function public.save_saved_meal(uuid, text, text, jsonb) from public, anon;
revoke all on function public.save_workout_routine(uuid, text, jsonb) from public, anon;
grant execute on function public.save_saved_meal(uuid, text, text, jsonb) to authenticated;
grant execute on function public.save_workout_routine(uuid, text, jsonb) to authenticated;
