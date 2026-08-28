alter table public.food_entries
  add column source text not null default 'manual',
  add column confidence text,
  add column estimate_low_calories integer,
  add column estimate_high_calories integer;

alter table public.food_entries
  add constraint food_entries_source_check check (
    source in ('manual', 'history', 'favourite', 'saved_meal', 'usda', 'ai_estimate', 'mixed')
  ),
  add constraint food_entries_confidence_check check (
    confidence is null or confidence in ('high', 'medium', 'low')
  ),
  add constraint food_entries_estimate_low_check check (
    estimate_low_calories is null or estimate_low_calories >= 0
  ),
  add constraint food_entries_estimate_high_check check (
    estimate_high_calories is null or estimate_high_calories >= 0
  ),
  add constraint food_entries_estimate_range_check check (
    estimate_low_calories is null
    or estimate_high_calories is null
    or estimate_low_calories <= estimate_high_calories
  );
