import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { HowItWorksCard } from "../../../convex/website/onboarding";
import { NamedEmoji } from "../Emoji";
import { keepFocusIn } from "./focusTrap";
import "./howItWorks.css";

type HowItWorksProps = { card: HowItWorksCard; onClose: (triedSlack: boolean) => void };

export function HowItWorks({ card: { slack, toLevelTwo, kudos }, onClose }: HowItWorksProps) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => dialog.current?.querySelector<HTMLElement>(".hw-try")?.focus({ preventScroll: true }), []);
  const kudosEmoji = <NamedEmoji name={kudos.kudosEmoji} image={kudos.kudosEmojiImage ?? undefined} />;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Tab") return keepFocusIn(dialog.current, event, "a[href], button:not(:disabled)");
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose(false);
  };
  return (
    <div className="hw-ground">
      <div className="hw-scrim" />
      <section ref={dialog} className="hw-card" role="dialog" aria-modal="true" aria-label="How HedgeHug works" onKeyDown={onKeyDown}>
        <p className="hw-eyebrow">How HedgeHug works</p>
        <h2 className="hw-title">Two ways to thank someone</h2>
        <ol className="hw-slack" aria-label="Two Slack messages">
          <SlackMessage beat={0} author="Alex Lee" avatar="AL" chips={<Chip beat={2}>Hug · +1 XP each</Chip>}>
            <span>Shipped the fix for the flaky deploy, should be green now.</span>
            <span className="hw-reactions">
              <span className="hw-reaction hw-pop" style={beatOf(1)}>
                {kudosEmoji} 1
              </span>
            </span>
          </SlackMessage>
          <SlackMessage
            beat={3}
            author="You"
            avatar="You"
            chips={
              <>
                <Chip beat={4}>Kudos · +10 XP</Chip>
                <Chip beat={4} tone="item">
                  said why · +1 item
                </Chip>
              </>
            }
          >
            <span>
              {kudosEmoji} <span className="hw-mention">@Alex Lee</span> thanks for staying on the deploy fix, the release went out on time because of you.
            </span>
          </SlackMessage>
        </ol>
        <p className="hw-note hw-beat" style={beatOf(5)}>
          {toLevelTwo && "Your first kudos takes you to level 2. "}Items wait here for you to turn.
        </p>
        {toLevelTwo && (
          <p className="hw-unlocks hw-beat" style={beatOf(5)}>
            <span className="hw-unlocks-title">Level 2 unlocks:</span> Leaderboard · 3 items · your next emoji
          </p>
        )}
        <div className="hw-actions">
          <a className="hw-try" href={slack} target="_blank" rel="noreferrer" onClick={() => onClose(true)}>
            Try it in Slack
          </a>
          <button type="button" className="hw-got-it" onClick={() => onClose(false)}>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}

type SlackMessageProps = { beat: number; author: string; avatar: string; chips: ReactNode; children: ReactNode };

function SlackMessage({ beat, author, avatar, chips, children }: SlackMessageProps) {
  return (
    <li className="hw-message hw-beat" style={beatOf(beat)}>
      <span className="hw-avatar" data-you={author === "You" ? "" : undefined} aria-hidden="true">
        {avatar}
      </span>
      <span className="hw-body">
        <strong>{author}</strong>
        {children}
      </span>
      <span className="hw-chips">{chips}</span>
    </li>
  );
}

function Chip({ beat, tone = "xp", children }: { beat: number; tone?: "xp" | "item"; children: ReactNode }) {
  return (
    <span className="hw-chip hw-beat" data-tone={tone} style={beatOf(beat)}>
      {children}
    </span>
  );
}

function beatOf(beat: number): CSSProperties {
  return { "--hw-beat": beat } as CSSProperties;
}
