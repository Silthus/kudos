import type { TierId } from "../shell";

export function metalOf(tier: TierId) {
  return `var(--medal-${tier})`;
}

export function glintOf(tier: TierId) {
  return `oklch(from ${metalOf(tier)} 0.92 calc(c * 1.4) h)`;
}
