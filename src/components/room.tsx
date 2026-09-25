import clsx from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";

/**
 * Parts for a place's window (#126): the window is already a pixel frame, so what's inside sits
 * straight on its parchment. A window is a stack of rooms; papers are pinned where the place pins
 * things (the signpost's quests, the notice board's notes).
 */

/**
 * One room of a window: a Pixelify title over a 2 px parchment-deep rule, and what's in it. No
 * frame of its own. `action` sits at the title's right (tabs, a link), and wraps under it when narrow.
 */
export function Room({ title, subtitle, action, children, className, ...rest }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode } & Omit<ComponentProps<"section">, "title">) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={clsx("min-w-0", className)} {...rest}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b-2 border-parchment-deep pb-2">
        <div className="min-w-0">
          <h2 id={id} className="font-display text-xl font-medium leading-7">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-ink/75">{subtitle}</p>}
        </div>
        {action && <div className="max-w-full">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * A paper pinned up: a parchment note with a pixel step and a pin at its top. `pin` is the pin's
 * colour class; `tone` tints the paper for done (hedge) or waiting (dashed, faded) papers.
 */
export function Paper({ pin = "bg-lantern", tone, className, children, ...rest }: { pin?: string; tone?: "done" | "faded" } & ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "pixel-note relative px-3.5 pt-4 pb-3",
        tone === "done" && "shadow-[inset_0_0_0_2px_var(--color-hedge),3px_3px_0_0_var(--color-dusk-deep)]",
        tone === "faded" && "opacity-70",
        className,
      )}
      {...rest}
    >
      <span aria-hidden className={clsx("pixel-chip absolute top-1 left-1/2 -ml-1 h-2 w-2", pin)} />
      {children}
    </div>
  );
}

/** A small pixel triangle pointing up (hedge) or down (ember), for a change in rank or count. */
export function PixelArrow({ up }: { up: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 5 3" width={10} height={6} className={clsx("pixels inline-block shrink-0", up ? "text-hedge-deep" : "text-ember-deep")} shapeRendering="crispEdges">
      <path fill="currentColor" d={up ? "M2 0h1v1h1v1h1v1H0V2h1V1h1z" : "M0 0h5v1H4v1H3v1H2V2H1V1H0z"} />
    </svg>
  );
}
