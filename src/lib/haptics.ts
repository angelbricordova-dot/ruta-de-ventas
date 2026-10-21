/** Vibración corta de confirmación. Android la respeta; iOS la ignora sin error. */
export function haptic(ms: number | number[] = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sin soporte */
  }
}
