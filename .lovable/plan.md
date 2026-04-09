

## Fix: poi-watchdog Edge Function crash

**Problem:** The `poi-watchdog` function crashes with `"Cannot access 'withGps' before initialization"` because `withGps` (line 103) is referenced on line 90 before its declaration. This is a `const` temporal dead zone error.

**Fix:** Move the `withGps` declaration (line 103) to before its first use (before line 90). Specifically:

1. **Move line 103** (`const withGps = all.filter(...)`) to just after line 29 (`const all = pois ?? [];`), so it's available for both the out-of-bounds check (step 7) and the duplicates check (step 8).

2. **Redeploy** the `poi-watchdog` function and verify it returns successfully.

**Single file change:** `supabase/functions/poi-watchdog/index.ts`

