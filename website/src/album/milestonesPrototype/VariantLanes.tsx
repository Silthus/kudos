// PROTOTYPE variant C: three lanes, earned / up next / still locked. Throwaway.
import { LadderEmblem } from "../../book/LadderEmblem";
import { PageTitle } from "../../PageTitle";
import type { Album } from "../answer";
import { dateOf } from "../teamPage";
import { earnedOf, hintOf, lockedOf, nextUpOf, slackWordsOf, type Medal } from "./model";

export function VariantLanes({ album }: { album: Album }) {
  const earned = earnedOf(album);
  const next = nextUpOf(album);
  const locked = lockedOf(album);
  return (
    <div className="al-page-body pms pms-c">
      <header>
        <p className="al-eyebrow">Album</p>
        <PageTitle tab="Milestones" size="hero">
          Milestones
        </PageTitle>
      </header>
      <div className="pms-c-lanes">
        <Lane title="Earned" count={earned.length} tone="done">
          {earned.map((medal) => (
            <li key={medal.key} className="pms-c-chip">
              <img src={medal.emoji.picture} alt="" width={32} height={32} />
              <span>
                <strong>{medal.tier.name}</strong>
                <small>{`${medal.metal} · ${medal.milestoneName}`}</small>
              </span>
              <span className="pms-c-chip-end">
                <small>{dateOf(medal.tier.earnedAt!)}</small>
                <span className="pms-slack" data-in={slackWordsOf(medal) === "In Slack" ? "" : undefined}>
                  {slackWordsOf(medal)}
                </span>
              </span>
            </li>
          ))}
        </Lane>
        <Lane title="Up next" count={next.length} tone="next">
          {next.map((medal) => (
            <NextCard key={medal.key} medal={medal} />
          ))}
        </Lane>
        <Lane title="Still to unlock" count={locked.length} tone="locked">
          {groupedByMilestone(locked).map(([name, medals]) => (
            <li key={name} className="pms-c-group">
              <p className="pms-c-group-name">{name}</p>
              <ul>
                {medals.map((medal) => (
                  <li key={medal.key} className="pms-c-locked">
                    <img src={medal.emoji.picture} alt="" width={24} height={24} />
                    <span>{medal.tier.name}</span>
                    <small>{`${medal.metal} · at ${medal.tier.at}`}</small>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </Lane>
      </div>
    </div>
  );
}

function Lane({ title, count, tone, children }: { title: string; count: number; tone: string; children: React.ReactNode }) {
  return (
    <section className="pms-c-lane" data-tone={tone}>
      <h2 className="pms-c-lane-head">
        <span>{title}</span> <span className="pms-c-count">{count}</span>
      </h2>
      <ol>{children}</ol>
    </section>
  );
}

function NextCard({ medal }: { medal: Medal }) {
  return (
    <li className="pms-c-card">
      <div className="pms-c-card-top">
        <LadderEmblem ladder={medal.ladder} best={medal.tier.tier} size={52} />
        <div>
          <strong>{medal.tier.name}</strong>
          <small className="pms-quiet">{`${medal.metal} · ${medal.milestoneName}`}</small>
        </div>
        <img className="pms-c-card-emoji" src={medal.emoji.picture} alt="" width={32} height={32} title={`:${medal.emoji.name}:`} />
      </div>
      <div className="pms-bar" aria-hidden="true">
        <span style={{ width: `${medal.share * 100}%` }} />
      </div>
      <p className="pms-c-card-count">
        <strong>{`${medal.toGo} to go`}</strong> <span className="pms-quiet">{`${medal.reached} of ${medal.tier.at}`}</span>
      </p>
      <p className="pms-c-hint">{hintOf[medal.milestone.id]}</p>
    </li>
  );
}

function groupedByMilestone(medals: Medal[]) {
  const groups = new Map<string, Medal[]>();
  for (const medal of medals) groups.set(medal.milestoneName, [...(groups.get(medal.milestoneName) ?? []), medal]);
  return [...groups.entries()];
}
