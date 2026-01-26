

# Plan: Reliability Hardening for Route Recorder

## Resume

Add explicit error handling for geolocation failures, expose a status state machine, and ensure crash-safe behavior on page reload.

---

## 1. useRouteRecorder.ts - Error Handling & Status State

### 1.1 Add Status Type

```typescript
export type RecordingStatus = 'idle' | 'recording' | 'error';
```

### 1.2 Expand RecordingState

Add fields to track status and error message:

```typescript
interface RecordingState {
  status: RecordingStatus;      // NEW
  errorMessage: string | null;  // NEW
  startTime: number | null;
  coords: RouteCoord[];
  currentTraceId: string | null;
  mode: RecordingMode;
}
```

Initial state:
```typescript
{
  status: 'idle',
  errorMessage: null,
  startTime: null,
  coords: [],
  currentTraceId: null,
  mode,
}
```

### 1.3 Geolocation Error Handling in startRecording

Before calling `watchPosition`, check geolocation availability:

```typescript
const startRecording = useCallback(async () => {
  // Check geolocation support
  if (!('geolocation' in navigator)) {
    setState(prev => ({
      ...prev,
      status: 'error',
      errorMessage: 'Geolocalisation non disponible sur cet appareil',
    }));
    return;
  }

  try {
    const trace = await createTrace.mutateAsync();
    lastKeptPointRef.current = null;

    setState({
      status: 'recording',
      errorMessage: null,
      startTime: Date.now(),
      coords: [],
      currentTraceId: trace.id,
      mode: modeRef.current,
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      // success callback (existing filtering logic)
      ...
      ,
      // error callback - ENHANCED
      (error) => {
        console.error('Geolocation error:', error);
        
        // Clear watch on error
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        
        let message: string;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Permission GPS refusee. Autorisez l\'acces dans les parametres.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Position GPS indisponible. Verifiez que le GPS est active.';
            break;
          case error.TIMEOUT:
            message = 'Delai GPS depasse. Reessayez dans un endroit ouvert.';
            break;
          default:
            message = error.message || 'Erreur GPS inconnue';
        }
        
        setState(prev => ({
          ...prev,
          status: 'error',
          errorMessage: message,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    toast({ title: 'Enregistrement demarre' });
  } catch (err) {
    setState(prev => ({
      ...prev,
      status: 'error',
      errorMessage: 'Impossible de creer la trace. Verifiez la connexion.',
    }));
  }
}, [createTrace, toast]);
```

### 1.4 Add retry() Function

```typescript
const retry = useCallback(() => {
  setState(prev => ({
    ...prev,
    status: 'idle',
    errorMessage: null,
  }));
}, []);
```

### 1.5 Update stopRecording

Reset to idle status:

```typescript
setState({
  status: 'idle',
  errorMessage: null,
  startTime: null,
  coords: [],
  currentTraceId: null,
  mode: modeRef.current,
});
```

### 1.6 Expose New Fields in Return

```typescript
return {
  // State
  status: state.status,           // NEW
  errorMessage: state.errorMessage, // NEW
  isRecording: state.status === 'recording', // DERIVED
  ...
  // Actions
  retry,  // NEW
  ...
};
```

---

## 2. RouteReconStep.tsx - Error Banner & Retry

### 2.1 Destructure New Fields

```typescript
const {
  status,
  errorMessage,
  isRecording,
  retry,
  ...
} = useRouteRecorder(projectId, recordingMode);
```

### 2.2 Error Banner Component

Add below mode selector, above recording controls:

```tsx
{status === 'error' && errorMessage && (
  <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30">
    <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-medium text-destructive">Erreur GPS</p>
      <p className="text-xs text-destructive/80">{errorMessage}</p>
    </div>
    <Button 
      variant="outline" 
      size="sm"
      onClick={retry}
      className="shrink-0"
    >
      Reessayer
    </Button>
  </div>
)}
```

### 2.3 Disable REC Button When Error

```tsx
<Button 
  onClick={startRecording} 
  variant="default"
  className="gap-2"
  disabled={status === 'error'}
>
  <Circle className="w-4 h-4 fill-current" />
  REC
</Button>
```

---

## 3. Crash-Safe Behavior

### 3.1 No localStorage Persistence

The current implementation already uses React state which resets on reload. No change needed - state is ephemeral by design.

### 3.2 Ensure watchIdRef Cleared on Mount

Add explicit reset on mount to guarantee clean state:

```typescript
// In useRouteRecorder, near top of hook
useEffect(() => {
  // Force idle state on mount - ensures no stale recording state
  // watchIdRef is already null on fresh mount
  // State is already idle from useState initializer
  return () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };
}, []);
```

This cleanup already exists at line 355-361. No additional mount-time reset needed since useState initializes to idle.

---

## 4. Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useRouteRecorder.ts` | Add RecordingStatus type, expand state, error handling, retry function |
| `src/components/intake/RouteReconStep.tsx` | Error banner, disable REC on error, retry button |

---

## Section Technique

### State Machine

```text
     [idle]
       |
       v (startRecording)
  [recording]
       |
       +---> (stopRecording) --> [idle]
       |
       +---> (geolocation error) --> [error]
                                        |
                                        v (retry)
                                      [idle]
```

### Error Code Mapping

| GeolocationPositionError.code | Message |
|------------------------------|---------|
| 1 (PERMISSION_DENIED) | Permission GPS refusee. Autorisez l'acces dans les parametres. |
| 2 (POSITION_UNAVAILABLE) | Position GPS indisponible. Verifiez que le GPS est active. |
| 3 (TIMEOUT) | Delai GPS depasse. Reessayez dans un endroit ouvert. |

---

## QA Checklist

1. **Permission denied simulation**
   - Open browser DevTools > Sensors > Location > Permission denied
   - Click REC
   - Expected: Error banner appears with "Permission GPS refusee..."
   - REC button becomes disabled

2. **Retry after error**
   - From error state, click "Reessayer"
   - Change DevTools > Sensors > Location to a valid location
   - Click REC
   - Expected: Recording starts normally

3. **Reload during recording**
   - Start recording
   - Reload page
   - Expected: UI shows idle state, REC button enabled
   - Previously saved traces still visible in list

4. **Normal flow unaffected**
   - Start recording
   - Wait for points to accumulate
   - Stop recording
   - Expected: Trace saved and appears in list

