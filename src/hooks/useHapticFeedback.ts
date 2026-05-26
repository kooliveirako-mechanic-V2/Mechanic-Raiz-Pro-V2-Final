export function useHapticFeedback() {
  const vibrate = (pattern: number | number[] = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return {
    /** Light tap - button clicks, toggles */
    light: () => vibrate(10),
    /** Medium - OS created, status change */
    medium: () => vibrate(25),
    /** Success - finalized, payment confirmed */
    success: () => vibrate([15, 50, 15]),
    /** Warning - alert, error */
    warning: () => vibrate([30, 30, 30]),
  };
}
