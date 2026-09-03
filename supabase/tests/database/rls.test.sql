begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select is((select count(*) from pg_constraint where contype = 'f' and conrelid = 'public.saved_meal_items'::regclass and confrelid = 'public.saved_meals'::regclass), 1::bigint, 'Saved meal items have one unambiguous parent relationship');
select is((select count(*) from pg_constraint where contype = 'f' and conrelid = 'public.workout_template_exercises'::regclass and confrelid = 'public.workout_templates'::regclass), 1::bigint, 'Routine exercises have one unambiguous parent relationship');
select is((select count(*) from pg_constraint where contype = 'f' and conrelid = 'public.workout_session_exercises'::regclass and confrelid = 'public.workout_sessions'::regclass), 1::bigint, 'Session exercises have one unambiguous parent relationship');
select ok(
  (select count(*) = 1 from pg_constraint where contype = 'f' and conrelid = 'public.exercise_sets'::regclass and confrelid = 'public.workout_sessions'::regclass)
  and (select count(*) = 1 from pg_constraint where contype = 'f' and conrelid = 'public.exercise_sets'::regclass and confrelid = 'public.workout_session_exercises'::regclass),
  'Exercise sets have one relationship to each intended parent'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated', 'hardening-a@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated', 'hardening-b@example.test', '', now(), now(), now());

insert into public.profiles (user_id, age, sex, height_cm, goal, activity_level, onboarding_completed)
values
  ('00000000-0000-4000-8000-00000000000a', 30, 'male', 175, 'maintain', 'light', true),
  ('00000000-0000-4000-8000-00000000000b', 31, 'female', 165, 'maintain', 'light', true);

insert into public.saved_meals (id, user_id, name)
values ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'Owner meal');
insert into public.saved_meal_items (id, user_id, saved_meal_id, name, calories, position)
values
  ('21000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'Rice', 200, 0),
  ('21000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000a', '20000000-0000-4000-8000-00000000000a', 'Egg', 90, 1);

insert into public.exercises (id, user_id, name, category, load_type)
values ('30000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'Owner curl', 'arms', 'per_dumbbell');
insert into public.workout_templates (id, user_id, name)
values
  ('40000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'Owner routine'),
  ('40000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'Other routine');
insert into public.workout_template_exercises (id, user_id, template_id, exercise_id, exercise_name, position, target_sets, target_rep_min, target_rep_max)
values ('41000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '40000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', 'Owner curl', 0, 3, 8, 12);
insert into public.workout_sessions (id, user_id, mode, title, started_at)
values
  ('50000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'normal', 'Owner workout', now()),
  ('50000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'normal', 'Other workout', now());
insert into public.workout_session_exercises (id, user_id, session_id, exercise_id, exercise_name_snapshot, position, load_type, target_sets, target_rep_min, target_rep_max)
values ('60000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', 'Owner curl', 0, 'per_dumbbell', 3, 8, 12);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', true);

select throws_ok($$insert into public.saved_meal_items (user_id, saved_meal_id, name, calories, position) values ('00000000-0000-4000-8000-00000000000b', '20000000-0000-4000-8000-00000000000a', 'Intruder item', 10, 0)$$, '42501', 'new row violates row-level security policy for table "saved_meal_items"', 'Another user cannot attach an item to the owner saved meal');
select throws_ok($$insert into public.workout_template_exercises (user_id, template_id, exercise_name, position, target_sets, target_rep_min, target_rep_max) values ('00000000-0000-4000-8000-00000000000b', '40000000-0000-4000-8000-00000000000a', 'Intruder exercise', 0, 3, 8, 12)$$, '42501', 'new row violates row-level security policy for table "workout_template_exercises"', 'Another user cannot attach an exercise to the owner routine');
select throws_ok($$insert into public.workout_session_exercises (user_id, session_id, exercise_name_snapshot, position, load_type, target_sets, target_rep_min, target_rep_max) values ('00000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000a', 'Intruder exercise', 0, 'bodyweight', 3, 8, 12)$$, '42501', 'new row violates row-level security policy for table "workout_session_exercises"', 'Another user cannot attach an exercise to the owner session');
select throws_ok($$insert into public.exercise_sets (user_id, session_id, session_exercise_id, exercise_name, set_number, weight_kg, reps) values ('00000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000a', '60000000-0000-4000-8000-00000000000a', 'Owner curl', 1, 10, 10)$$, '42501', 'new row violates row-level security policy for table "exercise_sets"', 'Another user cannot attach a set to the owner workout');
select throws_ok($$insert into public.exercise_sets (user_id, session_id, session_exercise_id, exercise_name, set_number, weight_kg, reps) values ('00000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', '60000000-0000-4000-8000-00000000000a', 'Owner curl', 1, 10, 10)$$, '42501', 'new row violates row-level security policy for table "exercise_sets"', 'A set cannot mix a caller session with another user session exercise');
select throws_ok($$insert into public.workout_template_exercises (user_id, template_id, exercise_id, exercise_name, position, target_sets, target_rep_min, target_rep_max) values ('00000000-0000-4000-8000-00000000000b', '40000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000a', 'Owner curl', 0, 3, 8, 12)$$, '42501', 'new row violates row-level security policy for table "workout_template_exercises"', 'Another user cannot reference the owner custom exercise');
select throws_ok($$select public.save_saved_meal('20000000-0000-4000-8000-00000000000a', 'Changed by other', 'lunch', '[{"name":"Rice","calories":200,"proteinG":4}]'::jsonb)$$, 'P0001', 'Saved meal not found.', 'Another user cannot replace the owner saved meal through the RPC');
select throws_ok($$select public.save_workout_routine('40000000-0000-4000-8000-00000000000a', 'Changed by other', '[]'::jsonb)$$, 'P0001', 'Routine not found.', 'Another user cannot replace the owner routine through the RPC');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);

insert into public.daily_food_log_status (user_id, date, is_complete, completed_at)
values ('00000000-0000-4000-8000-00000000000a', current_date - 1, true, now());
insert into public.food_entries (id, user_id, name, calories, meal_type, eaten_at)
values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'Inserted food', 100, 'snack', current_date - 1 + interval '4 hours');
select is((select is_complete from public.daily_food_log_status where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date - 1), false, 'Food insert resets completion in the same database statement');

insert into public.daily_food_log_status (user_id, date, is_complete, completed_at)
values
  ('00000000-0000-4000-8000-00000000000a', current_date - 2, true, now()),
  ('00000000-0000-4000-8000-00000000000a', current_date, true, now());
insert into public.food_entries (id, user_id, name, calories, meal_type, eaten_at)
values ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000a', 'Moved food', 200, 'lunch', current_date - 2 + interval '4 hours');
update public.daily_food_log_status set is_complete = true, completed_at = now() where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date - 2;
update public.food_entries set eaten_at = current_date + interval '4 hours' where id = '10000000-0000-4000-8000-00000000000b';
select is((select is_complete from public.daily_food_log_status where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date - 2), false, 'Moving food resets the old day completion');
select is((select is_complete from public.daily_food_log_status where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date), false, 'Moving food resets the new day completion');

update public.daily_food_log_status set is_complete = true, completed_at = now() where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date;
delete from public.food_entries where id = '10000000-0000-4000-8000-00000000000b';
select is((select is_complete from public.daily_food_log_status where user_id = '00000000-0000-4000-8000-00000000000a' and date = current_date), false, 'Food delete resets completion in the same database statement');

select lives_ok($$select public.save_saved_meal('20000000-0000-4000-8000-00000000000a', 'Owner meal updated', 'lunch', '[{"name":"Rice","calories":220,"proteinG":4},{"name":"Egg","calories":90,"proteinG":6}]'::jsonb)$$, 'Owner can transactionally replace a saved meal');
select is((select count(*) from public.saved_meal_items where saved_meal_id = '20000000-0000-4000-8000-00000000000a'), 2::bigint, 'Complete saved meal replacement is stored');
select throws_matching($$select public.save_saved_meal('20000000-0000-4000-8000-00000000000a', 'Broken replacement', 'lunch', '[{"name":"Too large","calories":3000000000,"proteinG":0}]'::jsonb)$$, '.*out of range.*', 'A child insert failure aborts saved meal replacement');
select is((select count(*) from public.saved_meal_items where saved_meal_id = '20000000-0000-4000-8000-00000000000a' and name in ('Rice', 'Egg')), 2::bigint, 'Failed saved meal replacement leaves old items intact');

select lives_ok($$select public.save_workout_routine('40000000-0000-4000-8000-00000000000a', 'Owner routine updated', '[{"exerciseId":"30000000-0000-4000-8000-00000000000a","exerciseName":"Owner curl","loadType":"per_dumbbell","targetSets":3,"targetRepMin":8,"targetRepMax":12,"includeInLight":false,"lightTargetSets":null,"progressionStepKg":2.5}]'::jsonb)$$, 'Owner can transactionally replace a workout routine');
select is((select count(*) from public.workout_template_exercises where template_id = '40000000-0000-4000-8000-00000000000a'), 1::bigint, 'Complete routine replacement is stored');
select throws_ok($$select public.save_workout_routine('40000000-0000-4000-8000-00000000000a', 'Broken replacement', '[{"exerciseId":"99999999-9999-4999-8999-999999999999","exerciseName":"Missing exercise","loadType":"per_dumbbell","targetSets":3,"targetRepMin":8,"targetRepMax":12,"includeInLight":false,"lightTargetSets":null,"progressionStepKg":2.5}]'::jsonb)$$, '42501', 'new row violates row-level security policy for table "workout_template_exercises"', 'A child insert failure aborts routine replacement');
select is((select count(*) from public.workout_template_exercises where template_id = '40000000-0000-4000-8000-00000000000a' and exercise_id = '30000000-0000-4000-8000-00000000000a'), 1::bigint, 'Failed routine replacement leaves old exercises intact');

select * from finish();
rollback;
