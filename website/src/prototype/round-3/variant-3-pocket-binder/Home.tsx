// PROTOTYPE (#625, round 3): the desk: the closed binder, your unopened booster packs fanned out, and the Journey card while it lasts. Never merge to main.
import type { CSSProperties } from "react";
import { AppLink } from "../../../AppLink";
import { personOf, type Album } from "../album";
import { ClosedBinder, PackWrapper } from "./PackTable";
import { firstNameOf } from "./motion";

export function Home({ album }: { album: Album }) {
  const fanned = album.packs.slice(0, 5);
  return (
    <div className="pb-home">
      <div className="pb-home-binder">
        <AppLink href="/book" className="pb-home-binder-link" aria-label="Open your binder">
          <ClosedBinder album={album} size="big" />
        </AppLink>
        <p className="pb-home-count">
          <strong>{album.collected}</strong> people collected
          <span className="pb-level-pin" title={`Level ${album.level.level}`}>
            Lv {album.level.level}
          </span>
        </p>
        <p className="pb-home-sub">
          {album.teams.filter(({ complete }) => complete).length} of {album.teams.length} team pages complete · {album.hoggiesFound} hoggies
        </p>
        <JourneyCard album={album} />
      </div>
      <section className="pb-home-packs" aria-labelledby="pb-packs-heading">
        <h1 id="pb-packs-heading" className="pb-title">
          {album.packs.length === 0 ? "No packs waiting" : album.packs.length === 1 ? "1 pack waiting" : `${album.packs.length} packs waiting`}
        </h1>
        <p className="pb-home-lead">{album.packs.length === 0 ? "Thank someone in Slack and say why. Each thoughtful kudos earns a booster pack: their card the first time, and a hoggie every time." : "Each one came from a thank-you you gave. Rip one open."}</p>
        {fanned.length > 0 ? (
          <ul className="pb-fan">
            {fanned.map((pack, index) => (
              <li key={pack.id} style={{ "--tilt": `${(index - (fanned.length - 1) / 2) * 5}deg`, "--lift": `${Math.abs(index - (fanned.length - 1) / 2) * 10}px` } as CSSProperties}>
                <AppLink href={`/book#packs/${pack.id}`} className="pb-fan-pack" aria-label={`Open the pack for thanking ${personOf(album, pack.person)?.name ?? "a teammate"}`}>
                  <PackWrapper album={album} pack={pack} size="fan" />
                </AppLink>
              </li>
            ))}
          </ul>
        ) : (
          <div className="pb-fan-empty" aria-hidden="true">
            <span className="pb-pack-ghost" />
            <span className="pb-pack-ghost" />
          </div>
        )}
      </section>
    </div>
  );
}

function JourneyCard({ album }: { album: Album }) {
  const done = album.journey.filter((step) => step.done).length;
  if (done === album.journey.length) return null;
  const closest = album.teams.filter(({ complete, total }) => !complete && total > 0).toSorted((first, second) => first.total - first.held - (second.total - second.held))[0];
  const waiting = closest === undefined ? undefined : album.packs.find(({ person }) => closest.people.includes(person) && personOf(album, person)?.collectedAt === null);
  return (
    <aside className="pb-journey" aria-label="Getting started">
      <span className="pb-journey-head">
        Getting started <span>{done}/{album.journey.length}</span>
      </span>
      <ol>
        {album.journey.map((step) => (
          <li key={step.step} data-done={step.done ? "" : undefined}>
            <span aria-hidden="true" className="pb-journey-check">
              {step.done ? "✓" : ""}
            </span>
            {step.goal}
          </li>
        ))}
      </ol>
      {closest !== undefined && (
        <p className="pb-journey-hint">
          {closest.name} needs {closest.total - closest.held} more.
          {waiting !== undefined && ` ${firstNameOf(personOf(album, waiting.person)!.name)}'s pack is waiting.`}
        </p>
      )}
    </aside>
  );
}
