// PROTOTYPE (#625, round 5): your album at a glance: people and full teams, your own team, and hoggies found, each a door to its page. Never merge to main.
import type { ReactNode } from "react";
import { AppLink } from "../../../../AppLink";
import { CrestArt, HoggieArt } from "../../../art";
import type { Album, Team } from "../../../round-3/album";
import { coolestHoggiesOf, glanceOf, hrefs, myTeamOf, shareOf, type Glance as GlanceFacts } from "./profile";

export function Glance({ album }: { album: Album }) {
  const glance = glanceOf(album);
  const team = myTeamOf(album);
  const showcase = coolestHoggiesOf(album)[0];
  return (
    <section className="r5p-section" aria-labelledby="r5p-glance-title">
      <h2 id="r5p-glance-title" className="r5p-section-title">
        Your album at a glance
      </h2>
      <ul className="r5p-glance">
        <Tile href={hrefs.milestones} label="People collected" held={glance.people.held} total={glance.people.total} footnote={teamsFootnote(glance, team)} />
        <Tile href={hrefs.myTeam} label={`Your team, ${team.name}`} held={team.held} total={team.total} footnote={teamFootnote(team)} art={<CrestArt art={team.art} size={52} name={team.name} collected={team.held > 0} />} dots />
        <Tile href={hrefs.hoggies} label="Hoggies found" held={glance.hoggies.found} total={glance.hoggies.total} footnote={`${glance.hoggies.total - glance.hoggies.found} still hiding in packs`} art={showcase === undefined ? undefined : <HoggieArt slug={showcase.hoggie} size={56} />} />
      </ul>
    </section>
  );
}

function teamsFootnote(glance: GlanceFacts, team: Team) {
  if (glance.teams.complete > 0) return `${glance.teams.complete} of ${glance.teams.total} teams complete`;
  return `No full team yet, ${team.name} is ${missingWords(team)}`;
}

function missingWords(team: Team) {
  const missing = team.total - team.held;
  return missing === 1 ? "1 away" : `${missing} away`;
}

function teamFootnote(team: Team) {
  if (team.complete) return "Complete, the seal is yours";
  const missing = team.total - team.held;
  return missing === 1 ? "1 to go for the seal" : `${missing} to go for the seal`;
}

function Tile({ href, label, held, total, footnote, art, dots = false }: { href: string; label: string; held: number; total: number; footnote: string; art?: ReactNode; dots?: boolean }) {
  return (
    <li>
      <AppLink href={href} className="r5p-tile">
        <span className="r5p-tile-top">
          <span className="r5p-tile-label">{label}</span>
          {art !== undefined && <span className="r5p-tile-art">{art}</span>}
        </span>
        <span className="r5p-tile-count">
          <strong>{held}</strong>
          <span className="r5p-quiet"> of {total}</span>
        </span>
        {dots ? <Dots held={held} total={total} /> : <Bar held={held} total={total} label={`${held} of ${total} ${label.toLowerCase()}`} />}
        <span className="r5p-tile-foot r5p-quiet">{footnote}</span>
      </AppLink>
    </li>
  );
}

function Bar({ held, total, label }: { held: number; total: number; label: string }) {
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={held} className="r5p-bar">
      <span className="r5p-bar-fill" style={{ width: `${Math.max(2, shareOf(held, total) * 100)}%` }} />
    </span>
  );
}

function Dots({ held, total }: { held: number; total: number }) {
  return (
    <span className="r5p-dots" role="img" aria-label={`${held} of ${total} in your album`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < held ? "r5p-dot r5p-dot-in" : "r5p-dot"} />
      ))}
    </span>
  );
}
