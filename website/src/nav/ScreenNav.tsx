import { useEffect, useRef, type AnimationEvent, type ReactElement, type ReactNode } from "react";
import { IconLock } from "@posthog/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { CrateGlyph } from "../crates/CrateArt";
import { useMoments, type PopIn } from "../crates/moments";
import { featureCrateOf } from "../crates/readyCrates";
import { isOrAre } from "../features";
import type { Screen } from "../route";
import type { Feature, MemberProfile } from "../shell";
import { navEntriesOf, type LockedEntry, type OpenEntry, type ReadyEntry } from "./entries";
import "./nav.css";

const tokenShape = "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] outline-none lg:font-medium max-lg:rounded-full max-lg:px-3 max-lg:py-1 max-lg:text-sm max-lg:[&>svg]:size-3.5";

const entryShape = `${tokenShape} focus-visible:ring-2 focus-visible:ring-ring`;

const currentLook = "text-foreground max-lg:bg-primary max-lg:font-medium max-lg:text-primary-foreground lg:after:absolute lg:after:inset-x-2 lg:after:-bottom-[12px] lg:after:h-0.5 lg:after:rounded-full lg:after:bg-primary";

const idleLook = "text-muted-foreground hover:bg-fill-hover hover:text-foreground";

export function ScreenNav({ current, member }: { current?: Screen; member: MemberProfile }) {
  const entries = navEntriesOf(member);
  const rail = useCurrentEntryInView(entries.some((entry) => entry.state === "open" && entry.screen === current) ? current : undefined);
  return (
    <nav
      ref={rail}
      aria-label="Screens"
      onFocus={(event) => bringIntoView(event.target)}
      className="flex flex-nowrap items-center gap-0.5 max-lg:order-last max-lg:-mx-4 max-lg:w-[calc(100%+2rem)] max-lg:gap-1 max-lg:overflow-x-auto max-lg:px-3 max-lg:pt-1.5 max-lg:pb-2 max-lg:scroll-px-3 md:max-lg:-mx-6 md:max-lg:w-[calc(100%+3rem)] md:max-lg:px-5 lg:mx-auto"
    >
      {entries.map((entry) => {
        if (entry.state === "open") return <OpenItem key={entry.href} entry={entry} current={current === entry.screen} />;
        if (entry.state === "ready") return <ReadyItem key={entry.card.feature} entry={entry} />;
        return <LockedItem key={entry.feature} entry={entry} />;
      })}
    </nav>
  );
}

export function usePopIn(feature: Feature | undefined, where: PopIn) {
  const moments = useMoments();
  if (feature === undefined || moments === undefined || !moments.popsIn(feature, where) || prefersReducedMotion()) return {};
  return {
    className: "nav-pop",
    onAnimationEnd: (event: AnimationEvent) => {
      if (event.target === event.currentTarget) moments.poppedIn(feature, where);
    },
  };
}

function OpenItem({ entry: { href, name, Icon, feature }, current }: { entry: OpenEntry; current: boolean }) {
  const { className: popIn = "", onAnimationEnd } = usePopIn(feature, "entry");
  return (
    <WithTip tip={<div>{name}</div>} onlyWhenIconOnly>
      <AppLink href={href} aria-current={current ? "page" : undefined} onAnimationEnd={onAnimationEnd} className={`${entryShape} ${current ? currentLook : idleLook} ${popIn}`}>
        <Icon className="size-4" />
        <Label>{name}</Label>
      </AppLink>
    </WithTip>
  );
}

function ReadyItem({ entry: { card, name } }: { entry: ReadyEntry }) {
  const moments = useMoments();
  const crate = featureCrateOf(card);
  const opening = moments?.attemptOf(crate) === "opening";
  return (
    <WithTip
      tip={
        <>
          <div className="font-medium">{`${name} ${isOrAre(card.feature)} ready`}</div>
          <div>Open its crate to unlock it</div>
        </>
      }
    >
      <button
        type="button"
        aria-label={opening ? `${name}: opening its crate` : `${name}: unlock ready. Open its crate`}
        aria-disabled={opening || undefined}
        onClick={() => {
          if (!opening) moments?.open(crate);
        }}
        className={`${tokenShape} nav-token font-semibold text-foreground`}
      >
        <CrateGlyph className="size-4" />
        <Label>{opening ? "Opening…" : name}</Label>
      </button>
    </WithTip>
  );
}

function LockedItem({ entry: { name, level, next } }: { entry: LockedEntry }) {
  return (
    <WithTip
      tip={
        <>
          <div className="font-medium">
            {next ? "Next unlock · " : ""}
            {name}
          </div>
          <div>Unlocks at level {level}</div>
        </>
      }
    >
      <span
        role="link"
        tabIndex={0}
        aria-disabled="true"
        aria-label={`${name}, locked. Unlocks at level ${level}`}
        className={`${entryShape} cursor-default text-muted-foreground ${next ? "border border-dashed border-muted-foreground" : ""}`}
      >
        <IconLock className="size-4" />
        <Label>{name}</Label>
        {next && <span className="rounded-full border px-1.5 text-[10px] font-semibold leading-4 tabular-nums">Lv {level}</span>}
      </span>
    </WithTip>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span data-entry-label className="lg:max-xl:sr-only">
      {children}
    </span>
  );
}

function WithTip({ tip, onlyWhenIconOnly = false, children }: { tip: ReactNode; onlyWhenIconOnly?: boolean; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent className={`flex-col items-start gap-0 ${onlyWhenIconOnly ? "hidden lg:max-xl:flex" : ""}`}>{tip}</TooltipContent>
    </Tooltip>
  );
}

function useCurrentEntryInView(current: Screen | undefined) {
  const rail = useRef<HTMLElement>(null);
  useEffect(() => {
    const entry = rail.current?.querySelector('[aria-current="page"]');
    if (entry) bringIntoView(entry);
  }, [current]);
  return rail;
}

function bringIntoView(entry: Element) {
  entry.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
