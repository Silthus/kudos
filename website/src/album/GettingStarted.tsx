import { IconCheck } from "@posthog/icons";
import type { GettingStarted as Facts } from "./answer";
import { gettingStartedSteps } from "./facts";

export function GettingStarted({ facts }: { facts: Facts | null }) {
  if (facts === null) return null;
  const done = gettingStartedSteps.filter(({ step }) => facts[step]).length;
  const next = gettingStartedSteps.find(({ step }) => !facts[step]);
  if (next === undefined) return null;
  return (
    <section className="al-started" aria-label="Getting started">
      <span className="al-started-title">
        Getting started · {done} of {gettingStartedSteps.length}
      </span>
      <ol className="al-started-steps">
        {gettingStartedSteps.map(({ step, goal }) => (
          <li key={step} className="al-started-step" data-done={facts[step] ? "" : undefined} aria-label={`${goal}: ${facts[step] ? "done" : "not yet"}`}>
            {facts[step] && <IconCheck />}
          </li>
        ))}
      </ol>
      <span className="al-started-next">
        Next: <strong>{next.goal}</strong>
      </span>
    </section>
  );
}
