# Steady Fitness Tracker

A mobile-first personal tracker for calories, simple A/B workouts, and weight trends. The app uses React, TypeScript, Vite, Tailwind, shadcn/ui, and Supabase.

## Local setup

1. Copy `.env.example` to `.env.local` and provide your Supabase project URL and publishable key.
2. Apply `supabase/migrations/202608280001_fitness_v1.sql` to the Supabase project. You can use the Supabase CLI migration workflow or paste the file into the dashboard SQL editor.
3. Run `npm install` if dependencies are not already installed.
4. Run `npm run dev`.

The frontend only uses the public/publishable Supabase key. Never add a service-role key to a Vite environment variable.

## Verification

- `npm run lint`
- `npm run build`
- `npm test`

## Data behavior

- Profiles, calorie targets, food, weight, templates, sessions, and sets are protected by row-level security.
- Logging weight again for the same date updates that date's entry.
- Calorie targets are initial estimates and do not change automatically with weight logs.
- Workout A/B selection alternates based on the most recently completed session. Light workouts count as completed workouts.
