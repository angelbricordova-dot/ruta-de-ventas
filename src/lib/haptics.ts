/** Vibración corta de confirmación. Android la respeta; iOS la ignora sin error. */
export function haptic(ms: number | number[] = 10) {
  try {
    // El navegador solo deja vibrar después de que la persona tocó la pantalla.
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
    if (active && !active.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* sin soporte */
  }
}
