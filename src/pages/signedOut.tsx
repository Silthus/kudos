import clsx from "clsx";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * The signed-out world's pieces (#133): the name on a wooden sign, and the parchment page that the
 * install guide and the not-installed screen are written on, both on the dusk sky.
 */

/** "Kudos" in Pixelify on a bark board standing on two posts. `big` is the landing page's; the small one links home. */
export function KudosSign({ big = false }: { big?: boolean }) {
  const board = (
    <span className="flex flex-col items-center">
      <span className={clsx("pixel-sign block", big ? "px-8 py-3" : "px-4 py-1")}>
        {big ? (
          <h1 className="font-display text-6xl font-medium leading-none text-cream">Kudos</h1>
        ) : (
          <span className="block font-display text-2xl font-medium leading-8 text-cream">Kudos</span>
        )}
      </span>
      <span aria-hidden className={clsx("flex", big ? "w-40 justify-between" : "w-16 justify-between")}>
        <span className={clsx("block bg-bark shadow-[2px_0_0_0_var(--color-dusk-deep)]", big ? "h-5 w-3" : "h-2.5 w-2")} />
        <span className={clsx("block bg-bark shadow-[2px_0_0_0_var(--color-dusk-deep)]", big ? "h-5 w-3" : "h-2.5 w-2")} />
      </span>
    </span>
  );
  if (big) return <div data-landing-sign>{board}</div>;
  return (
    <Link to="/" aria-label="Kudos, back to the start" className="inline-block">
      {board}
    </Link>
  );
}

/** A signed-out page: the small sign on the dusk sky, and a parchment sheet in a pixel frame below it. */
export function ParchmentPage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <div className="min-h-dvh bg-dusk px-4 py-6 sm:px-6 sm:py-10">
      <div className={clsx("mx-auto", narrow ? "max-w-md" : "max-w-3xl")}>
        <div className="flex justify-center">
          <KudosSign />
        </div>
        <main className="pixel-frame mt-6 px-5 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
