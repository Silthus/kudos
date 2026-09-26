import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { TUTORIAL_STEPS, type TutorialStep } from "../../convex/lib/tutorial";
import { Progress } from "@/components/ui";
import { useViewer } from "@/lib/viewer";
import { Npc } from "@/world/Npc";
import { ELDER_HOGGIE, useAdvance, useTutorial } from "@/world/Tutorial";

/**
 * The elder hog's window (#159, plan #152 S4): PostHog's reading hoggie, and the step of the chain
 * you're on as one action and one sentence on why, with the way there where it's a place. A step
 * waiting for a level shows the level and your XP bar instead. Coming here is step 1, arriving.
 */

/** The one action, as a way there where it has one. */
function Action({ step }: { step: TutorialStep }) {
  const { workspace } = useViewer();
  const button = "pixel-btn inline-flex h-10 items-center px-4 text-sm font-semibold";
  if (step.id === "thanks") {
    // The demo and the simulator have the sandbox; a real workspace gives in Slack.
    return workspace.isDemo ? (
      <Link to="/playground" className={button}>
        Give a kudos in the sandbox
      </Link>
    ) : (
      <p className="font-semibold text-ink">
        In Slack: @name <span data-user-text>{workspace.emojiGlyph}</span> and a few words on why.
      </p>
    );
  }
  if (step.to && step.to !== "/elder") {
    return (
      <Link to={step.to} className={button}>
        {step.action}
      </Link>
    );
  }
  return <p className="font-semibold text-ink">{step.action}.</p>;
}

export function Elder() {
  const now = useTutorial();
  const advance = useAdvance();
  // Arriving is the first step: said once, however often the window renders.
  const arrived = useRef(false);
  const arriving = now?.current?.id === "arrive";
  useEffect(() => {
    if (!arriving || arrived.current) return;
    arrived.current = true;
    advance("arrive").catch(() => (arrived.current = false));
  }, [arriving, advance]);

  const current = now?.current ?? null;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <Npc slot={ELDER_HOGGIE} size={96} />
        <p className="pt-2 text-ink">
          {current
            ? "Welcome to the tree. Everything here grows from thanks, and I'll show you round one step at a time."
            : now === null
              ? "The tree grows with every thoughtful kudos. Come back when the game is on."
              : "You know the way now. The tree grows with every thoughtful kudos, and so will you."}
        </p>
      </div>
      {current && now && (
        <section data-elder-step aria-labelledby="elder-step" className="pixel-note space-y-2 px-4 py-3">
          <p className="text-sm text-ink/75">
            Step {current.n} of {TUTORIAL_STEPS.length}
          </p>
          <h3 id="elder-step" className="font-display text-xl font-medium text-ink">
            {current.title}
          </h3>
          <p className="text-ink">{current.why}</p>
          {now.gate?.kind === "level" ? (
            <div className="space-y-1">
              <p className="font-semibold text-ink">At level {now.gate.level}</p>
              {now.level && <Progress value={now.level.into} max={now.level.span} className="w-48" height={8} label="XP to your next level" />}
            </div>
          ) : now.gate ? (
            <p className="font-semibold text-ink">{`${now.gate.label[0].toUpperCase()}${now.gate.label.slice(1)}.`}</p>
          ) : (
            <Action step={current} />
          )}
        </section>
      )}
    </div>
  );
}
