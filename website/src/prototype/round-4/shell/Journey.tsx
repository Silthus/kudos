// PROTOTYPE (#625, round 4): the getting-started strip on the home page, shown only while the Journey is unfinished. Never merge to main.
import { IconCheck } from "@posthog/icons";
import { useAlbum } from "../../round-3/album";

export function Journey() {
  const { album } = useAlbum();
  const done = album.journey.filter((step) => step.done).length;
  const next = album.journey.find((step) => !step.done);
  if (next === undefined) return null;
  return (
    <section className="r4-journey" aria-label="Getting started">
      <span className="r4-journey-title">
        Getting started · {done} of {album.journey.length}
      </span>
      <ol className="r4-journey-steps">
        {album.journey.map((step) => (
          <li key={step.step} className="r4-journey-step" data-done={step.done ? "" : undefined} aria-label={`${step.goal} ${step.done ? "Done" : "Not yet"}`}>
            {step.done && <IconCheck />}
          </li>
        ))}
      </ol>
      <span className="r4-journey-next">
        Next: <strong>{next.goal}</strong>
      </span>
    </section>
  );
}
