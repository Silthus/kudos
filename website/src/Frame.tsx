import type { ReactNode } from "react";
import { HedgehogHeart } from "./hoggies";
import { AppLink } from "./AppLink";
import { useCapturing } from "./browserAnalytics/capturing";
import { Feedback } from "./Feedback";
import { ThemeControl } from "./ThemeControl";

export function Frame({ busy, children }: { busy: boolean; children: ReactNode }) {
  const capturer = useCapturing();
  return (
    <div className="hud-root flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/85 shadow-[0_1px_0_0_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-3 px-4 max-lg:gap-y-1 max-lg:pt-2 max-sm:gap-x-2 md:px-6">
          <Wordmark />
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:gap-1.5">
            {capturer && <Feedback capturer={capturer} />}
            <ThemeControl />
          </div>
        </div>
      </header>
      <main aria-busy={busy || undefined} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">
        {children}
      </main>
    </div>
  );
}

function Wordmark() {
  return (
    <AppLink href="/" aria-label="HedgeHug, home" className="flex items-center gap-2.5 rounded-md">
      <HedgehogHeart size={34} className="shrink-0" />
      <span className="flex flex-col leading-none max-sm:hidden">
        <span className="hud-display text-lg font-bold">HedgeHug</span>
        <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
      </span>
    </AppLink>
  );
}
