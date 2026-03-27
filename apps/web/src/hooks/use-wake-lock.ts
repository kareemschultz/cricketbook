import { useEffect, useRef } from "react"

export function useWakeLock(enabled: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return
    navigator.wakeLock.request("screen").then((wl) => { wakeLockRef.current = wl })
    return () => { wakeLockRef.current?.release() }
  }, [enabled])
}
