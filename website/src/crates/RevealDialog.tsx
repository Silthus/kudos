import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconArrowRight } from "@posthog/icons";
import { Button, buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { MomentAnnouncement } from "./MomentAnnouncement";
import { aboutOf, webPageOf } from "../features";
import type { FeatureCard } from "../shell";
import { SlackLink } from "../SlackLink";
import { CrateArt } from "./CrateArt";
import type { Reveal } from "./moments";

export const revealPlaysForMs = 1700;

type RevealDialogProps = Reveal & { chatUrl: string; announcement: string; onFinish: (card: FeatureCard) => void; onClose: (how: { returnFocus: boolean }) => void };

export function RevealDialog({ card, seenBefore, chatUrl, announcement, onFinish, onClose }: RevealDialogProps) {
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
    if (!playing) onFinish(card);
  }, [playing, card, onFinish]);

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
      aria-modal="true"
      aria-labelledby={labelId}
      tabIndex={-1}
      data-motion={reducedMotion ? "reduced" : "full"}
      onKeyDown={onKeyDown}
      onClick={() => playing && setPlaying(false)}
      className="moment-scrim fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 pb-12 pt-[clamp(2.5rem,8vh,5rem)] text-center">
        <span id={labelId} className="hud-label moment-label">{`Level ${card.level} unlock`}</span>
        <div className="pb-6 pt-36">
          <CrateArt phase={playing ? "opening" : "open"} width={220} Hog={aboutOf(card.feature).Hog} />
        </div>
        {!playing && <EndState key={shownAt} card={card} chatUrl={chatUrl} onClose={onClose} onReplay={replay} />}
      </div>
      <MomentAnnouncement text={announcement} />
    </div>
  );
}

type EndStateProps = { card: FeatureCard; chatUrl: string; onClose: RevealDialogProps["onClose"]; onReplay: () => void };

function EndState({ card, chatUrl, onClose, onReplay }: EndStateProps) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => firstActionIn(end.current)?.focus(), []);
  return (
    <div ref={end} className="moment-end flex w-full flex-col items-center gap-4">
      <h2 className="hud-display text-[clamp(2rem,8vw,3rem)] font-bold leading-tight">{`${card.name} is open`}</h2>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-card p-5 text-left text-card-foreground shadow-2xl">
        <p className="text-base">{`It opens ${card.opens}.`}</p>
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <GoThere card={card} chatUrl={chatUrl} onGo={() => onClose({ returnFocus: false })} />
          <Button variant="outline" onClick={() => onClose({ returnFocus: true })}>
            Done
          </Button>
          <Button variant="link-muted" className="ml-auto" onClick={onReplay}>
            Replay
          </Button>
        </div>
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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const actionSelector = "a[href], button:not([aria-disabled='true'])";

function firstActionIn(dialog: HTMLElement | null) {
  return dialog?.querySelector<HTMLElement>(actionSelector) ?? dialog;
}

function keepFocusIn(dialog: HTMLElement | null, event: KeyboardEvent) {
  const actions = [...(dialog?.querySelectorAll<HTMLElement>(actionSelector) ?? [])];
  const first = actions[0];
  const last = actions.at(-1);
  const leaving = actions.length === 0 || (event.shiftKey ? document.activeElement === first || document.activeElement === dialog : document.activeElement === last);
  if (!leaving) return;
  event.preventDefault();
  (event.shiftKey ? last : first)?.focus();
}
