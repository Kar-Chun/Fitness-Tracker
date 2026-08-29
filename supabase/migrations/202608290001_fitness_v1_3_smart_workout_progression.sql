alter table public.workout_sessions
  add column readiness text,
  add constraint workout_sessions_readiness_check
    check (readiness is null or readiness in ('tired', 'normal', 'good'));

alter table public.workout_template_exercises
  add column progression_step_kg numeric(6,2),
  add constraint workout_template_exercises_progression_step_check
    check (progression_step_kg is null or progression_step_kg >= 0);

-- Only known externally loaded default movements receive a starting increment.
-- Bodyweight, band, core, and other user-edited movements remain opt-in.
update public.workout_template_exercises
set progression_step_kg = 2.5
where progression_step_kg is null
  and exercise_name in (
    'Goblet Squat',
    'One-arm Dumbbell Row',
    'Dumbbell Romanian Deadlift',
    'Reverse Lunge',
    'Dumbbell Overhead Press'
  );
