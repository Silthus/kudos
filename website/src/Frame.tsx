import type { ComponentType, ReactNode } from "react";
import { IconHome } from "@posthog/icons";
import { AccountMenu } from "./AccountMenu";
import { AppLink } from "./AppLink";
import { ReadyPill } from "./crates/ReadyPill";
import { openWebPagesOf } from "./features";
import type { Screen } from "./route";
import type { MemberProfile } from "./shell";
import { ThemeControl } from "./ThemeControl";

type FrameProps = { member?: MemberProfile; current?: Screen; busy: boolean; inert?: boolean; onSignOut?: () => void; children: ReactNode };

export function Frame({ member, current, busy, inert, onSignOut, children }: FrameProps) {
  return (
    <div className="hud-root flex min-h-screen flex-col" inert={inert}>
      <header className="sticky top-0 z-40 border-b bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
          <Wordmark />
          {member && <ScreenNav current={current} member={member} />}
          <div className="ml-auto flex items-center gap-2">
            {member && <ReadyPill member={member} />}
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
    <AppLink href="/" className="flex items-center rounded-md">
      <span className="flex flex-col leading-none">
        <span className="hud-display text-lg font-bold">HedgeHug</span>
        <span className="text-[10px] text-muted-foreground">Thanks a Hog</span>
      </span>
    </AppLink>
  );
}

function ScreenNav({ current, member }: { current?: Screen; member: MemberProfile }) {
  return (
    <nav aria-label="Screens" className="mx-auto flex items-center gap-0.5">
      <ScreenLink href="/" current={current === "home"} Icon={IconHome}>
        Home
      </ScreenLink>
      {openWebPagesOf(member).map(({ screen, href, name, Icon }) => (
        <ScreenLink key={href} href={href} current={current === screen} Icon={Icon}>
          {name}
        </ScreenLink>
      ))}
    </nav>
  );
}

type ScreenLinkProps = { href: string; current: boolean; Icon: ComponentType<{ className?: string }>; children: ReactNode };

function ScreenLink({ href, current, Icon, children }: ScreenLinkProps) {
  return (
    <AppLink
      href={href}
      aria-current={current ? "page" : undefined}
      className={`relative flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px] font-medium ${current ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[12px] after:h-0.5 after:rounded-full after:bg-primary" : "text-muted-foreground hover:bg-fill-hover hover:text-foreground"}`}
    >
      <Icon className="size-4" />
      {children}
    </AppLink>
  );
}
