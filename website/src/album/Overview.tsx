import { TeamCrest } from "../crates/TeamCrest";
import { PageTitle } from "../PageTitle";
import type { Album, NewestPerson } from "./answer";
import { closestToCompleteOf, plural } from "./facts";
import { PackWrapper } from "./PackCards";
import { findYourselfHref, hrefOf } from "./place";
import { MoreLink, NewestRow, Section, Tile } from "./ProfilePage";
import { teamFootnoteOf } from "./profile";
import { thankedFor } from "./opening";
import "./profile.css";
import "./overview.css";

const closestShown = 3;

const packsShown = 3;

type OverviewProps = { album: Album; newest: NewestPerson[] | null; onOpenPacks: () => void };

export function Overview({ album, newest, onOpenPacks }: OverviewProps) {
  return (
    <article className="al-page-body al-overview">
      <PageTitle tab="Your album" size="hero">
        Your album
      </PageTitle>
      <FindYourTeam />
      <ClosestToComplete album={album} />
      <WaitingPacks album={album} onOpenPacks={onOpenPacks} />
      {newest !== null && <Newest album={album} newest={newest} />}
    </article>
  );
}

function FindYourTeam() {
  return (
    <Section title="Find your team">
      <div className="al-overview-find">
        <p className="al-lede">Your team's page shows here once you're matched to your profile on posthog.com.</p>
        <MoreLink href={findYourselfHref}>Find yourself on posthog.com</MoreLink>
      </div>
    </Section>
  );
}

function ClosestToComplete({ album }: { album: Album }) {
  const closest = closestToCompleteOf(album.teams, closestShown);
  if (closest.length === 0) return null;
  return (
    <Section title="Closest to complete">
      <ul className="al-profile-glance">
        {closest.map((team) => (
          <Tile key={team.team} href={hrefOf({ kind: "team", team: team.team })} label={team.name} held={team.held} total={team.total} footnote={teamFootnoteOf(team)} art={<TeamCrest art={team.art} size={44} name={team.name} collected={team.held > 0} />} />
        ))}
      </ul>
    </Section>
  );
}

function WaitingPacks({ album, onOpenPacks }: { album: Album; onOpenPacks: () => void }) {
  const waiting = album.packs.length;
  if (waiting === 0)
    return (
      <Section title="Waiting packs">
        <p className="al-lede">No packs waiting. Thank someone and say why to earn one.</p>
      </Section>
    );
  return (
    <Section title="Waiting packs">
      <div className="al-overview-packs">
        <span className="al-overview-pack-stack" aria-hidden="true">
          {album.packs.slice(0, packsShown).map((pack) => (
            <PackWrapper key={pack.pack} thanked={thankedFor(album, pack)} size="mini" />
          ))}
        </span>
        <div className="al-overview-pack-words">
          <p className="al-lede">{`${plural(waiting, "pack", "packs")}${album.morePacks ? " and more" : ""} waiting to open.`}</p>
          <button type="button" className="al-overview-open" onClick={onOpenPacks}>
            Open a pack
          </button>
        </div>
      </div>
    </Section>
  );
}

function Newest({ album, newest }: { album: Album; newest: NewestPerson[] }) {
  return (
    <Section title="New in your album">
      {newest.length === 0 ? (
        <p className="al-lede">Give a thoughtful kudos and open its pack: your first person shows here.</p>
      ) : (
        <div className="al-profile-newest">
          <ul aria-label="Newest people">
            {newest.map((person) => (
              <NewestRow key={person.person} album={album} person={person} />
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
