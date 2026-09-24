/**
 * Our own mark: an orange speech bubble carrying a star. Deliberately not a hedgehog and not PostHog's
 * logo (licence rules, #52). public/favicon.svg is the same drawing.
 */
export function KudosMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" className={className} aria-hidden>
      <path d="M4 3h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--k-brand)" />
      <path d="M13 6.5l1.5 3.4 3.7.4-2.8 2.5.8 3.6-3.2-1.9-3.2 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="var(--k-on-brand)" />
    </svg>
  );
}

/** The wordmark: KudosMark plus "kudos" in the display face. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-display text-[19px] font-black tracking-tight text-text">
      <KudosMark />
      kudos
    </span>
  );
}
