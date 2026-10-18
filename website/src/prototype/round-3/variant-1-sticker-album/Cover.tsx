// PROTOTYPE (#625, round 3): the album's closed cover: owner, level pin, people collected, packets tucked under the corner and the first-steps bookmark. Never merge to main.
import type { Album } from "../album";
import { AppLink } from "../../../AppLink";
import { HedgehogStar } from "../../../hoggies";
import { LevelPin } from "./Pages";
import { plural } from "./model";

export function Cover({ album }: { album: Album }) {
  const unfinished = album.journey.some(({ done }) => !done);
  return (
    <div className="sa-cover-desk">
      <div className="sa-cover-wrap">
        {album.packs.length > 0 && (
          <AppLink href="/book#packs" className="sa-tucked" aria-label={`${plural(album.packs.length, "pack")} to open`}>
            {album.packs.slice(0, 3).map(({ id }, at) => (
              <span key={id} className="sa-tucked-packet" style={{ transform: `rotate(${8 + at * 7}deg) translate(${at * 14}px, ${at * -6}px)` }} aria-hidden="true">
                <span>HedgeHug</span>
              </span>
            ))}
            <span className="sa-tucked-tag">{plural(album.packs.length, "pack")} to open</span>
          </AppLink>
        )}
        <AppLink href="/book" className="sa-cover" aria-label="Open the album">
          <span className="sa-cover-frame">
            <span className="sa-cover-brand">HedgeHug</span>
            <span className="sa-cover-title">Sticker Album</span>
            <span className="sa-cover-edition">Collect your whole company · 2026</span>
            <span className="sa-cover-window" aria-hidden="true">
              <HedgehogStar size={210} />
            </span>
            <span className="sa-cover-plate">
              <span className="sa-cover-plate-label">This album belongs to</span>
              <span className="sa-cover-plate-name">{album.me.name}</span>
              <span className="sa-cover-plate-row">
                <LevelPin level={album.level.level} />
                <span>
                  <b>{album.collected}</b> people collected
                </span>
              </span>
            </span>
            <span className="sa-cover-open">Open the album →</span>
          </span>
        </AppLink>
        {unfinished && <Bookmark album={album} />}
      </div>
    </div>
  );
}

function Bookmark({ album }: { album: Album }) {
  const done = album.journey.filter((step) => step.done).length;
  const next = album.journey.find((step) => !step.done);
  return (
    <aside className="sa-bookmark" aria-label="First steps">
      <span className="sa-bookmark-ribbon" aria-hidden="true" />
      <p className="sa-kicker">First steps</p>
      <p className="sa-bookmark-count">
        {done} of {album.journey.length} done
      </p>
      <ol>
        {album.journey.map((step) => (
          <li key={step.step} className={step.done ? "sa-step-done" : step === next ? "sa-step-next" : undefined}>
            <span className="sa-step-box" aria-hidden="true">
              {step.done ? "✓" : ""}
            </span>
            <span>{step.goal}</span>
          </li>
        ))}
      </ol>
      {next?.step === "complete-team" && (
        <AppLink href={nextTeamHref(album)} className="sa-bookmark-link">
          See the closest page →
        </AppLink>
      )}
    </aside>
  );
}

function nextTeamHref(album: Album) {
  const closest = album.teams.filter(({ complete }) => !complete).toSorted((first, second) => first.total - first.held - (second.total - second.held))[0];
  return closest === undefined ? "/book" : `/book#teams/${closest.team}`;
}
