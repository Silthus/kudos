import type { ReactNode } from "react";
import { IconHome } from "@posthog/icons";
import { AccountMenu } from "./AccountMenu";
import type { MemberProfile } from "./shell";
import { ThemeControl } from "./ThemeControl";

type FrameProps = { member?: MemberProfile; atHome: boolean; busy: boolean; onSignOut?: () => void; children: ReactNode };

export function Frame({ member, atHome, busy, onSignOut, children }: FrameProps) {
  return (
    <div className="hud-root flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
          <Wordmark />
          {member && <ScreenNav atHome={atHome} />}
          <div className="ml-auto flex items-center gap-2">
            <ThemeControl />
            {member && onSignOut && <AccountMenu member={member} onSignOut={onSignOut} />}
          </div>
        </div>
      </header>
      <main aria-busy={busy || undefined} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 md:px-6 md:pt-8">{children}</main>
    </div>
  );
}

function Wordmark() {
  return (
    <a href="/" className="flex items-center rounded-md">
      <span className="flex flex-col leading-none">
        <span className="hud-display text-lg font-bold">HedgeHug</span>
        <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
      </span>
    </a>
  );
}

function ScreenNav({ atHome }: { atHome: boolean }) {
  return (
    <nav aria-label="Screens" className="mx-auto flex items-center gap-0.5">
      <a
        href="/"
        aria-current={atHome ? "page" : undefined}
        className={`relative flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-medium ${atHome ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
      >
        <IconHome className="size-4" />
        Home
      </a>
    </nav>
  );
}
