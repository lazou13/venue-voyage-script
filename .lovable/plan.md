

## Fix: Redeploy poi-watchdog Edge Function

**Problem:** The code fix (moving `withGps` to line 30) is already in the source file, but the deployed version still runs the old code with the Temporal Dead Zone error. The logs confirm the crash is still happening at runtime.

**Action:** Redeploy `poi-watchdog` so the deployed function matches the fixed source code. No code changes needed — deployment only.

### Step
1. Deploy `poi-watchdog` edge function to push the already-corrected source code live.

