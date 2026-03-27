export function useHaptic() {
  return () => {
    if ("vibrate" in navigator) navigator.vibrate(30)
  }
}
