import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    if (!('wakeLock' in navigator)) return;

    const requestLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch {
        // Silently fail - browser may not support or page not visible
      }
    };

    requestLock();

    // Re-acquire on visibility change (lock is auto-released when tab hidden)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [active]);
}
