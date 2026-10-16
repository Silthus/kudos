import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { IconArrowRight, IconCheck } from "@posthog/icons";
import { Button, buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { hogOf, isOrAre, waitsOf, webPageOf } from "../features";
import type { Feature, FeatureCard, MemberProfile } from "../shell";
import { earnedLineOf } from "../quests/QuestReward";
import { prefersReducedMotion } from "../reducedMotion";
import { SlackLink } from "../SlackLink";
import { CrateArt, CrateGlyph } from "./CrateArt";
import { CrateRewardFlight } from "./CrateRewardFlight";
import type { Drop } from "./drops";
import { attemptMessages, useMoments, type Flight, type Reveal } from "./moments";
import { rewardLabelOf, type QuestCrate, type ReadyCrate } from "./readyCrates";
import { listedRewardOf, type Reward, type RewardKind } from "./rewards";
import { crestBeatPlaysForMs, flyingKindsOf, hasCrest, RewardChips, TokenStage, tokensOf, type Stage, type TokenKind } from "./RewardTokens";

export const crateChargesForMs = 700;

export const burstPlaysForMs = 1300;

type Phase = "charging" | "bursting" | "flying" | "ended";

type Close = (how: { returnFocus: boolean }) => void;

export type Flying = { flight: Flight; reward: Reward };

type RevealDialogProps = Reveal & {
  chatUrl: string;
  questsOpen: boolean;
  othersReady: ReadyCrate[];
  flying: Flying | undefined;
  shown: MemberProfile;
  onFinish: (crate: ReadyCrate, drop: Drop | null) => void;
  onClose: Close;
  onSetOut: (crate: ReadyCrate) => void;
  onRewardLanded: (crate: ReadyCrate, kind: RewardKind) => void;
};

export function RevealDialog({ crate, seenBefore, fromQuests, drop, chatUrl, questsOpen, othersReady, flying, shown, onFinish, onClose, onSetOut, onRewardLanded }: RevealDialogProps) {
  const labelId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(seenBefore || reducedMotion ? "ended" : "charging");
  const [shownAt, setShownAt] = useState(0);
  const [flown, setFlown] = useState<TokenKind[]>([]);
  const [rehearsing, setRehearsing] = useState(false);
  const reward = useRewardOnStage(flying, crate);
  const tokens = tokensOf(reward, drop);
  const burstLength = burstPlaysForMs + (hasCrest(tokens) ? crestBeatPlaysForMs : 0);
  const flies = flyingKindsOf(reward).length > 0;
  const onStage = flying ?? (rehearsing ? rehearsalOf(crate, reward) : undefined);
  const playing = phase !== "ended";
  const headroom = useHeadroom();

  useEffect(() => {
    if (phase === "charging") dialog.current?.focus();
    if (phase !== "charging" && phase !== "bursting") return;
    const timer = setTimeout(() => setPhase(phase === "charging" ? "bursting" : onStage !== undefined && flies ? "flying" : "ended"), phase === "charging" ? crateChargesForMs : burstLength);
    return () => clearTimeout(timer);
  }, [phase, onStage, flies, burstLength]);

  useEffect(() => {
    if (phase !== "charging") onSetOut(crate);
  }, [phase, crate, onSetOut]);

  useEffect(() => {
    if (!playing) onFinish(crate, drop);
  }, [playing, crate, drop, onFinish]);

  const skip = () => setPhase("ended");

  const replay = () => {
    if (reducedMotion) return setShownAt((times) => times + 1);
    setFlown([]);
    setRehearsing(flies);
    setPhase("charging");
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event);
    if (playing && (event.key === "Escape" || event.key === " ")) {
      event.preventDefault();
      skip();
    } else if (!playing && event.key === "Escape") {
      event.preventDefault();
      onClose({ returnFocus: true });
    }
  };

  const onRewardTaken = useCallback((kind: RewardKind) => setFlown((taken) => (taken.includes(kind) ? taken : [...taken, kind])), []);
  const landed = useCallback((kind: RewardKind) => !rehearsing && onRewardLanded(crate, kind), [rehearsing, crate, onRewardLanded]);
  const land = useCallback(() => {
    setRehearsing(false);
    setPhase("ended");
  }, []);

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-labelledby={labelId}
      tabIndex={-1}
      data-motion={reducedMotion ? "reduced" : "full"}
      data-phase={phase}
      onKeyDown={onKeyDown}
      onClick={() => playing && skip()}
      className="moment-scrim fixed inset-0 z-50 overflow-y-auto"
      style={headroom}
    >
      <div className="moment-stage mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 pb-12 text-center">
        <span id={labelId} className="hud-label moment-label">
          {crate.kind === "feature" ? `Level ${crate.card.level} unlock` : rewardLabelOf(crate)}
        </span>
        <div className={`crate-stage flex flex-col items-center pb-6 ${tokens.length > 0 ? "pt-4" : "pt-36"}`}>
          <TokenStage key={shownAt} tokens={tokens} stage={stageOf(phase)} flown={flown} />
          <CrateArt phase={playing ? "opening" : "open"} width={220} Hog={hogOf(crate.kind === "feature" ? crate.card.feature : "quests")} />
        </div>
        {onStage !== undefined && (phase === "flying" || phase === "ended") && (
          <CrateRewardFlight key={rehearsing ? "rehearsal" : "flight"} reward={onStage.reward} shown={shown} landAtOnce={phase === "ended"} rehearsal={rehearsing || onStage.flight.climb === null} onRewardTaken={onRewardTaken} onRewardLanded={landed} onLanded={land} />
        )}
        {!playing && crate.kind === "feature" && <EndState key={shownAt} card={crate.card} chips={<RewardChips tokens={tokens} />} chatUrl={chatUrl} othersReady={othersReady} onClose={onClose} onReplay={replay} />}
        {!playing && crate.kind === "quest" && <RewardEndState key={shownAt} crate={crate} chips={<RewardChips tokens={tokens} />} offerQuests={questsOpen && !fromQuests} onClose={onClose} onReplay={replay} />}
      </div>
    </div>
  );
}

function stageOf(phase: Phase): Stage {
  if (phase === "charging") return "charging";
  return phase === "ended" ? "ended" : "popped";
}

function rehearsalOf(crate: ReadyCrate, reward: Reward): Flying {
  return { flight: { crate, landed: [], setOut: true }, reward };
}

function useRewardOnStage(flying: Flying | undefined, crate: ReadyCrate) {
  const charted = useRef<Reward>(undefined);
  if (flying !== undefined) charted.current = flying.reward;
  return charted.current ?? listedRewardOf(crate);
}

function useHeadroom(): CSSProperties | undefined {
  const [headroom, setHeadroom] = useState<CSSProperties>();
  useLayoutEffect(() => {
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    setHeadroom({ "--hud-height": `${header}px` } as CSSProperties);
  }, []);
  return headroom;
}

type EndStateProps = { card: FeatureCard; chips: ReactNode; chatUrl: string; othersReady: ReadyCrate[]; onClose: Close; onReplay: () => void };

function EndState({ card, chips, chatUrl, othersReady, onClose, onReplay }: EndStateProps) {
  return (
    <EndFrame
      headline={`${card.name} ${isOrAre(card.feature)} open`}
      chips={chips}
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

type RewardEndStateProps = { crate: QuestCrate; chips: ReactNode; offerQuests: boolean; onClose: Close; onReplay: () => void };

function RewardEndState({ crate, chips, offerQuests, onClose, onReplay }: RewardEndStateProps) {
  const toQuests = offerQuests && (
    <AppLink href="/quests" onFollow={() => onClose({ returnFocus: false })} className={buttonVariants({ variant: "primary" })}>
      See this week's quests
      <IconArrowRight aria-hidden="true" className="size-4" />
    </AppLink>
  );
  return <EndFrame headline={earnedLineOf(crate.reward)} chips={chips} onClose={onClose} onReplay={onReplay} go={toQuests} />;
}

type EndFrameProps = { headline: string; chips?: ReactNode; go: ReactNode; next?: ReactNode; onClose: Close; onReplay: () => void; children?: ReactNode };

function EndFrame({ headline, chips, go, next, onClose, onReplay, children }: EndFrameProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => firstActionIn(end.current)?.focus(), []);
  return (
    <div ref={end} className="moment-end flex w-full flex-col items-center gap-4">
      <h2 className="hud-display text-[clamp(2rem,8vw,3rem)] font-extrabold leading-tight text-balance">{headline}</h2>
      {chips}
      <div className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-card p-5 text-left text-card-foreground shadow-2xl">
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
