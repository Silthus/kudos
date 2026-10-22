import type { ReactNode } from "react";
import { IconCheck } from "@posthog/icons";
import type { GettingStarted as Facts, GettingStartedSteps } from "../../../convex/website/onboarding";
import { NamedEmoji } from "../Emoji";

type Step = { step: keyof GettingStartedSteps; goal: string; how: (kudosEmoji: ReactNode) => ReactNode };

const steps: Step[] = [
  { step: "hugged", goal: "Give a hug", how: (kudosEmoji) => <>react with {kudosEmoji} on any message in Slack</> },
  { step: "thoughtful", goal: "Give a thoughtful kudos", how: (kudosEmoji) => <>thank a teammate with {kudosEmoji} in a message and say why</> },
  { step: "turned", goal: "Turn an item", how: () => "turn a waiting item on your board" },
  { step: "levelTwo", goal: "Reach level 2", how: () => "your first kudos takes you there" },
];

export function GettingStarted({ facts }: { facts: Facts | null }) {
  if (facts === null) return null;
  const done = steps.filter(({ step }) => facts.steps[step]).length;
  const next = steps.find(({ step }) => !facts.steps[step]);
  if (next === undefined) return null;
  const { kudosEmoji, kudosEmojiImage } = facts.kudos;
  return (
    <section className="al-started" aria-label="Getting started">
      <span className="al-started-title">
        Getting started · {done} of {steps.length}
      </span>
      <ol className="al-started-steps">
        {steps.map(({ step, goal }) => (
          <li key={step} className="al-started-step" data-done={facts.steps[step] ? "" : undefined} aria-label={`${goal}: ${facts.steps[step] ? "done" : "not yet"}`}>
            {facts.steps[step] && <IconCheck />}
          </li>
        ))}
      </ol>
      <span className="al-started-next">
        Next: <strong>{next.goal}</strong> · {next.how(<NamedEmoji name={kudosEmoji} image={kudosEmojiImage ?? undefined} />)}
      </span>
    </section>
  );
}
