# Steady Fitness Tracker

A mobile-first personal tracker for calories, flexible workout logging, and weight trends. V1.2 adds review-first text and photo meal estimates backed by personal food history, USDA FoodData Central, Gemini, and an AI fallback. V1.3 adds custom routines and low-friction workout logging. V1.4 adds optional, user-confirmed calorie reviews based on complete food logs and two weekly weight averages. The app uses React, TypeScript, Vite, Tailwind, shadcn/ui, and Supabase.

## Local setup

1. Copy `.env.example` to `.env.local` and provide your Supabase project URL and publishable key.
2. Apply the migrations in `supabase/migrations` to the Supabase project in filename order. You can use the Supabase CLI migration workflow or paste each file into the dashboard SQL editor.
3. Run `npm install` if dependencies are not already installed.
4. Run `npm run dev`.

The frontend only uses the public/publishable Supabase key. Never add a service-role key to a Vite environment variable.

## V1.2 AI food setup

The `analyze-food-text` Edge Function requires these server-side Supabase secrets:

- `GEMINI_API_KEY` — create an API key in [Google AI Studio](https://ai.google.dev/aistudio).
- `USDA_API_KEY` — request a free data.gov key from the [USDA FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/).

Never prefix either secret with `VITE_`; Vite-prefixed values are exposed to browser code. After linking the local repository to your Supabase project, apply and deploy V1.2A with:

```sh
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=your_gemini_key
npx supabase secrets set USDA_API_KEY=your_usda_key
npx supabase functions deploy analyze-food-text
npx supabase functions deploy analyze-food-image
```

For local Edge Function development, create an ignored file such as `supabase/functions/.env.local` containing the two keys, then run:

```sh
npx supabase start
npx supabase functions serve analyze-food-text --env-file supabase/functions/.env.local
npx supabase functions serve analyze-food-image --env-file supabase/functions/.env.local
```

Do not commit that local environment file. The existing `.gitignore` excludes `.env.*` files.

### Analysis flow

1. The authenticated Edge Function checks for a conservative exact match in the caller's food history, favourites, or saved meals.
2. If no direct match exists, Gemini `gemini-3.5-flash-lite` interprets the description into schema-constrained food components and estimated gram weights.
3. Application code ranks generic USDA matches and deterministically calculates calories and protein from per-100g values.
4. Only unresolved components use the model's conservative nutrition fallback. Mixed estimates retain item-level provenance and wider uncertainty.
5. The browser shows the complete estimate for editing. It creates one normal `food_entries` row only after confirmation.

The original description, raw AI response, and full USDA responses are not persisted. Nutrition and portion values are estimates and should not be treated as medical or verified dietary measurements.

### Manual integration check

After deploying the migration and function, sign in and try `2 eggs and 2 slices toast`, `chicken rice no skin`, `caifan half rice curry chicken egg cabbage`, `kopi c kosong`, and `protein shake and banana`. Confirm the result is labelled Estimated, sources and uncertainty are understandable, edits recalculate USDA-backed gram values, and nothing reaches the diary until **Log meal** is selected.

Automated tests mock Gemini structured responses and external nutrition lookup behavior; they do not make live Gemini requests. A real end-to-end Gemini/USDA check requires valid project secrets and a deployed or locally served Edge Function.

## V1.2B meal photo scanning

From **Add Food**, choose **Scan Meal**, then either take a photo with the device camera or select one from the photo library. Selecting a photo only creates a local preview. Analysis starts only after **Analyze meal** is pressed, and the resulting estimate must still be reviewed and confirmed before it reaches the diary.

Supported formats are JPEG, PNG, WebP, HEIC, and HEIF. The app and Edge Function both enforce a 6 MB maximum. The optional meal note is useful for context that may not be visible, such as `half rice, no skin` or `shared plate, I ate about half`.

The image is sent inline to the authenticated `analyze-food-image` Edge Function, interpreted by Gemini, and passed through the same personal matching, USDA lookup, deterministic nutrition calculations, provenance, confidence, and calorie-range code used by text analysis. Image-derived portion ranges are intentionally wider.

Meal photos are analyzed for the current estimate and are not intentionally stored by the Fitness App. No Storage bucket, image database column, photo gallery, public URL, or Gemini Files API is used. Only a confirmed nutrition entry is persisted. The image is still processed by Gemini for the request and may be subject to Google's applicable API data handling terms.

For a manual integration check, try a banana, eggs with toast, chicken rice, cai fan, kopi or Milo, and a difficult curry or noodle dish. Add the note `half rice, no skin` to a chicken-rice photo and explicitly analyze again. Also confirm a keyboard returns no food, a dark or blurred meal can return too uncertain, and an image over 6 MB is rejected before analysis.

## Verification

- `npm run lint`
- `npm run build`
- `npm test`

## V1.3 custom workouts

The Workout tab is user-choice-first. Existing Workout A/B rows remain ordinary editable routines, while users can create any number of routines from the focused home-equipment exercise library or their own custom exercises.

Starting a routine opens one scrollable logger with every exercise visible. Entering valid weight and rep values records a performed set; blank rows are ignored, and no separate set check button is required. Previous performance stays read-only until **Copy last sets** is selected. Exercises can be searched, created, and added inline without leaving the workout, and untouched exercises may be omitted when finishing a partial workout. Quick Workout uses the same logger, while Log Finished Workout records retrospective sessions without mutating history.

Configure adjustable dumbbells, maximum weight per dumbbell, bench, and pull-up bar under Profile & Settings. Per-dumbbell and total loads are labelled explicitly. Progression remains deterministic and ignores Light, skipped, and incomplete work; a configured dumbbell ceiling prevents suggestions above available equipment.

Apply the V1.3 follow-up migration before deploying the updated frontend:

```sh
npx supabase db push
```

## Data behavior

- Profiles, calorie targets, food, weight, exercises, routines, session exercises, sessions, and sets are protected by row-level security.
- Logging weight again for the same date updates that date's entry.
- The formula target remains the baseline. Adaptive reviews are opt-in and never change a target without explicit confirmation.
- Existing Workout A/B data remains readable, but no sequence is imposed. Light workouts are configured per routine, count as completed workouts, and do not drive progression.
- Recent, frequent, and search results are derived from the user's own food history using deterministic name normalisation.
- Favourites and saved meals are reusable templates. Logging them always creates new diary entries, so later template edits never alter food history.
- AI-created diary entries store only compact provenance, confidence, and calorie-range fields. Existing entries remain `manual` by default.

## V1.4 adaptive calorie reviews

Enable **Adaptive Calorie Reviews** under Profile & Settings. The feature waits for a 14-day period containing at least 8 useful weigh-ins, at least 3 weigh-ins in each seven-day window, and 10 food days marked complete with at least 4 complete days in each window. Incomplete food days are excluded rather than counted as zero. Adding, editing, deleting, copying, or repeating food resets the affected day's completion marker.

The algorithm compares the mean weight in days 1–7 with days 8–14 and evaluates the percentage direction against the profile goal. A first off-target review is **Watch**. Only a consecutive eligible off-target review can suggest a change. Each suggestion is exactly 100 kcal/day, reviews have a seven-day cooldown, and accepted adaptive targets cannot move more than 200 kcal above or below the latest formula baseline. Rapid goal-direction changes may suggest a conservative 100 kcal correction; exercise calories are never added back.

Review messages are deterministic product heuristics, not medical advice or an exact metabolism calculation. Choosing **Keep** records the review without changing the target. Choosing **Accept** transactionally marks the review accepted and inserts a new `calorie_targets` history row; prior targets remain unchanged.

Apply the V1.4 migration before running this frontend:

```sh
npx supabase db push
```

The migration creates owner-protected `daily_food_log_status` and `calorie_reviews` tables, adds the opt-in profile setting, enforces review cooldown in PostgreSQL, and adds the atomic `accept_calorie_review` function.
