import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import { Button, buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { aboutOf, waitsOf, webPageOf } from "../features";
import type { Feature, FeatureCard } from "../shell";
import { prefersReducedMotion } from "../reducedMotion";
import { SlackLink } from "../SlackLink";
import { CrateArt, CrateGlyph } from "./CrateArt";
import { attemptMessages, useMoments, type Reveal } from "./moments";
import { rewardLabelOf, type QuestCrate, type ReadyCrate } from "./readyCrates";

export const revealPlaysForMs = 1700;

type Close = (how: { returnFocus: boolean }) => void;

type RevealDialogProps = Reveal & { chatUrl: string; questsOpen: boolean; othersReady: ReadyCrate[]; onFinish: (crate: ReadyCrate) => void; onClose: Close };

export function RevealDialog({ crate, seenBefore, fromQuests, chatUrl, questsOpen, othersReady, onFinish, onClose }: RevealDialogProps) {
  const labelId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [playing, setPlaying] = useState(!seenBefore && !reducedMotion);
  const [shownAt, setShownAt] = useState(0);

  useEffect(() => {
    if (!playing) return;
    dialog.current?.focus();
    const timer = setTimeout(() => setPlaying(false), revealPlaysForMs);
    return () => clearTimeout(timer);
  }, [playing]);

  useEffect(() => {
    if (!playing) onFinish(crate);
  }, [playing, crate, onFinish]);

  const replay = () => {
    if (reducedMotion) setShownAt((times) => times + 1);
    else setPlaying(true);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    if (playing && (event.key === "Escape" || event.key === " ")) {
      event.preventDefault();
      setPlaying(false);
    } else if (!playing && event.key === "Escape") {
      event.preventDefault();
      onClose({ returnFocus: true });
    }
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-labelledby={labelId}
      tabIndex={-1}
      data-motion={reducedMotion ? "reduced" : "full"}
      onKeyDown={onKeyDown}
      onClick={() => playing && setPlaying(false)}
      className="moment-scrim fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 pb-12 pt-[clamp(2.5rem,8vh,5rem)] text-center">
        <span id={labelId} className="hud-label moment-label">
          {crate.kind === "feature" ? `Level ${crate.card.level} unlock` : rewardLabelOf(crate)}
        </span>
        <div className="pb-6 pt-36">
          <CrateArt phase={playing ? "opening" : "open"} width={220} Hog={aboutOf(crate.kind === "feature" ? crate.card.feature : "quests").Hog} />
        </div>
        {!playing && crate.kind === "feature" && <EndState key={shownAt} card={crate.card} chatUrl={chatUrl} othersReady={othersReady} onClose={onClose} onReplay={replay} />}
        {!playing && crate.kind === "quest" && <RewardEndState key={shownAt} crate={crate} offerQuests={questsOpen && !fromQuests} onClose={onClose} onReplay={replay} />}
      </div>
    </div>
  );
}

type EndStateProps = { card: FeatureCard; chatUrl: string; othersReady: ReadyCrate[]; onClose: Close; onReplay: () => void };

function EndState({ card, chatUrl, othersReady, onClose, onReplay }: EndStateProps) {
  return (
    <EndFrame
      headline={`${card.name} is open`}
      onClose={onClose}
      onReplay={onReplay}
      go={<GoThere card={card} chatUrl={chatUrl} onGo={() => onClose({ returnFocus: false })} />}
      next={<NextCrate othersReady={othersReady} onClose={onClose} />}
    >
      <p className="text-base">{`It opens ${card.opens}.`}</p>
      <WhatWaits feature={card.feature} />
    </EndFrame>
  );
}

function WhatWaits({ feature }: { feature: Feature }) {
  const lines = waitsOf(feature);
  if (lines.length === 0) return null;
  return (
    <ul aria-label="What waits" className="flex flex-col gap-2">
      {lines.map((line, at) => (
        <li key={line} className="moment-line flex items-start gap-2.5 text-sm" style={{ "--line-delay": `${0.15 + at * 0.12}s` } as CSSProperties}>
          <IconCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {line}
        </li>
      ))}
    </ul>
  );
}

function NextCrate({ othersReady, onClose }: { othersReady: ReadyCrate[]; onClose: Close }) {
  const moments = useMoments();
  const [asked, ask] = useState<ReadyCrate>();
  const askedAttempt = asked === undefined ? undefined : moments?.attemptOf(asked);
  const revealed = asked !== undefined && moments?.waitsToReveal(asked) === true;
  const stillAsked = asked !== undefined && (askedAttempt === "opening" || revealed || othersReady.some(({ seen }) => seen === asked.seen));
  const next = stillAsked ? asked : othersReady[0];
  const attempt = next === undefined ? undefined : moments?.attemptOf(next);
  useEffect(() => {
    if (revealed) onClose({ returnFocus: false });
  }, [revealed, onClose]);
  const opening = attempt === "opening";
  const shown = next !== undefined && moments !== undefined && (othersReady.length > 0 || opening || revealed);
  useFocusTheRevealWhenGone(shown);
  if (!shown) return null;
  const open = () => {
    if (opening) return;
    if (othersReady.some((crate) => moments.waitsToReveal(crate))) return onClose({ returnFocus: false });
    ask(next);
    moments.open(next);
  };
  return (
    <div className="flex flex-col items-start gap-2 border-t pt-4">
      <Button variant="outline" aria-disabled={opening || undefined} aria-label={opening ? undefined : `Open the next one, ${othersReady.length} more ready`} onClick={open}>
        <CrateGlyph className="size-4" />
        {opening ? "Opening…" : <NextCount count={othersReady.length} />}
      </Button>
      {attempt !== undefined && attempt !== "opening" && <p className="text-sm font-medium">{attemptMessages[attempt]}</p>}
    </div>
  );
}

function useFocusTheRevealWhenGone(shown: boolean) {
  const wasShown = useRef(shown);
  useLayoutEffect(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusLost = !dialog?.contains(document.activeElement);
    if (wasShown.current && !shown && focusLost) firstActionIn(dialog)?.focus();
    wasShown.current = shown;
  }, [shown]);
}

function NextCount({ count }: { count: number }) {
  return (
    <>
      Open the next one
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <span className="tabular-nums text-muted-foreground">{`${count} more ready`}</span>
    </>
  );
}

type RewardEndStateProps = { crate: QuestCrate; offerQuests: boolean; onClose: Close; onReplay: () => void };

function RewardEndState({ crate, offerQuests, onClose, onReplay }: RewardEndStateProps) {
  const toQuests = offerQuests && (
    <AppLink href="/quests" onFollow={() => onClose({ returnFocus: false })} className={buttonVariants({ variant: "primary" })}>
      See this week's quests
      <IconArrowRight aria-hidden="true" className="size-4" />
    </AppLink>
  );
  return <EndFrame headline={`You earned ${crate.xp} XP`} onClose={onClose} onReplay={onReplay} go={toQuests} />;
}

type EndFrameProps = { headline: string; go: ReactNode; next?: ReactNode; onClose: Close; onReplay: () => void; children?: ReactNode };

function EndFrame({ headline, go, next, onClose, onReplay, children }: EndFrameProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => firstActionIn(end.current)?.focus(), []);
  return (
    <div ref={end} className="moment-end flex w-full flex-col items-center gap-4">
      <h2 className="hud-display text-[clamp(2rem,8vw,3rem)] font-bold leading-tight">{headline}</h2>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-card p-5 text-left text-card-foreground shadow-2xl">
        {children}
        <div className={`flex flex-wrap items-center gap-2 ${children === undefined ? "" : "border-t pt-4"}`}>
          {go}
          <Button variant={go ? "outline" : "primary"} onClick={() => onClose({ returnFocus: true })}>
            Done
          </Button>
          <Button variant="link-muted" className="ml-auto" onClick={onReplay}>
            Replay
          </Button>
        </div>
        {next}
      </div>
    </div>
  );
}

function GoThere({ card, chatUrl, onGo }: { card: FeatureCard; chatUrl: string; onGo: () => void }) {
  const page = webPageOf(card.feature);
  if (page === undefined)
    return (
      <SlackLink chatUrl={chatUrl} variant="primary" size="default">
        Find it in Slack's App Home.
      </SlackLink>
    );
  return (
    <AppLink href={page.href} onFollow={onGo} className={buttonVariants({ variant: "primary" })}>
      {`Go to ${card.name}`}
      <IconArrowRight aria-hidden="true" className="size-4" />
    </AppLink>
  );
}

const actionSelector = "a[href], button:not([aria-disabled='true'])";

function firstActionIn(dialog: HTMLElement | null) {
  return dialog?.querySelector<HTMLElement>(actionSelector) ?? dialog;
}

function keepFocusIn(dialog: HTMLElement | null, event: KeyboardEvent) {
  const actions = [...(dialog?.querySelectorAll<HTMLElement>(actionSelector) ?? [])];
  const first = actions[0];
  const last = actions.at(-1);
  const focused = document.activeElement as HTMLElement | null;
  const outsideTheActions = focused === null || !actions.includes(focused);
  const leaving = actions.length === 0 || outsideTheActions || (event.shiftKey ? focused === first : focused === last);
  if (!leaving) return;
  event.preventDefault();
  (event.shiftKey ? last : first)?.focus();
}
