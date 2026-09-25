/** A padlock drawn in pixels (#132): an ink shackle over a soil body with a brass plate and keyhole. */
export function Padlock() {
  return (
    <svg data-padlock width="10" height="12" viewBox="0 0 5 6" shapeRendering="crispEdges" className="shrink-0" aria-hidden>
      <rect x="1" y="0" width="3" height="1" fill="currentColor" />
      <rect x="1" y="1" width="1" height="1" fill="currentColor" />
      <rect x="3" y="1" width="1" height="1" fill="currentColor" />
      <rect x="0" y="2" width="5" height="4" fill="var(--color-soil)" />
      <rect x="1" y="3" width="3" height="2" fill="var(--color-lantern)" />
      <rect x="2" y="3" width="1" height="2" fill="var(--color-soil)" />
    </svg>
  );
}
