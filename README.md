# Steady Fitness Tracker

A mobile-first personal tracker for calories, simple A/B workouts, and weight trends. V1.2A adds review-first text meal estimates backed by personal food history, USDA FoodData Central, Gemini, and an AI fallback. The app uses React, TypeScript, Vite, Tailwind, shadcn/ui, and Supabase.

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

## Data behavior

- Profiles, calorie targets, food, weight, templates, sessions, and sets are protected by row-level security.
- Logging weight again for the same date updates that date's entry.
- Calorie targets are initial estimates and do not change automatically with weight logs.
- Workout A/B selection alternates based on the most recently completed session. Light workouts count as completed workouts.
- Recent, frequent, and search results are derived from the user's own food history using deterministic name normalisation.
- Favourites and saved meals are reusable templates. Logging them always creates new diary entries, so later template edits never alter food history.
- AI-created diary entries store only compact provenance, confidence, and calorie-range fields. Existing entries remain `manual` by default.
