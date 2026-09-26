/** Small number guards shared by the game's rule modules, so stored or client data can't smuggle NaN in. */

/** A whole number: NaN and infinities become 0, fractions are truncated toward zero. */
export function whole(n: number): number {
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** A whole number clamped into [min, max]. */
export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, whole(n)));
}
