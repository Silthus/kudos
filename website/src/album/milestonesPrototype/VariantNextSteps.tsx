// PROTOTYPE variant A: next steps first. Throwaway.
import { LadderEmblem } from "../../book/LadderEmblem";
import { PageTitle } from "../../PageTitle";
import type { Album } from "../answer";
import { dateOf } from "../teamPage";
import { actionsOf, earnedOf, hintOf, lockedOf, medalsOf, nextUpOf, slackWordsOf, type Medal } from "./model";
import { metalOrder, milestoneNameOf, tierWordOf } from "../milestones";

export function VariantNextSteps({ album }: { album: Album }) {
  const all = medalsOf(album);
  const earned = earnedOf(album);
  return (
    <div className="al-page-body pms pms-a">
      <header className="pms-a-head">
        <div>
          <p className="al-eyebrow">Album</p>
          <PageTitle tab="Milestones" size="hero">
            Milestones
          </PageTitle>
          <p className="al-lede">{`${earned.length} of ${all.length} medals · ${lockedOf(album).length + nextUpOf(album).length} emojis still to unlock`}</p>
        </div>
        <ol className="pms-a-metals" aria-label="Medals by metal">
          {metalOrder.map((metal) => {
            const ofMetal = all.filter(({ tier }) => tier.tier === metal);
            return (
              <li key={metal} data-metal={metal}>
                <strong>{`${ofMetal.filter(({ step }) => step === "earned").length}/${ofMetal.length}`}</strong>
                <span>{tierWordOf(metal)}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <section className="pms-a-section">
        <h2 className="pms-h2">Do this next</h2>
        <ul className="pms-a-actions">
          {actionsOf(album).map((action) => (
            <li key={action.key}>
              <a href={action.href ?? undefined} className="pms-a-action" data-in-slack={action.href === null ? "" : undefined}>
                <strong>{action.title}</strong>
                <span>{action.detail}</span>
                <span className="pms-a-feeds">{action.feeds.map(milestoneNameOf).join(" · ")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="pms-a-section">
        <h2 className="pms-h2">Closest medals</h2>
        <ol className="pms-a-closest">
          {nextUpOf(album).map((medal, index) => (
            <ClosestRow key={medal.key} medal={medal} first={index === 0} />
          ))}
        </ol>
      </section>

      <section className="pms-a-section">
        <h2 className="pms-h2">{`Earned · ${earned.length}`}</h2>
        <ul className="pms-a-earned">
          {earned.map((medal) => (
            <li key={medal.key}>
              <img src={medal.emoji.picture} alt="" width={28} height={28} />
              <span>
                <strong>{medal.tier.name}</strong>
                <small>{`${medal.metal} · ${dateOf(medal.tier.earnedAt!)}`}</small>
              </span>
              <span className="pms-slack" data-in={slackWordsOf(medal) === "In Slack" ? "" : undefined}>
                {slackWordsOf(medal)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ClosestRow({ medal, first }: { medal: Medal; first: boolean }) {
  return (
    <li className="pms-a-row" data-first={first ? "" : undefined}>
      <LadderEmblem ladder={medal.ladder} best={medal.tier.tier} size={first ? 64 : 48} />
      <div className="pms-a-row-words">
        <p className="pms-a-row-name">
          <strong>{medal.tier.name}</strong> <span className="pms-metal" data-metal={medal.tier.tier}>{medal.metal}</span>
        </p>
        <p className="pms-quiet">{`${medal.milestoneName} · ${hintOf[medal.milestone.id]}`}</p>
        <div className="pms-bar" aria-hidden="true">
          <span style={{ width: `${medal.share * 100}%` }} />
        </div>
      </div>
      <p className="pms-a-togo">
        <strong>{medal.toGo}</strong>
        <span>{`to go · ${medal.reached}/${medal.tier.at}`}</span>
      </p>
      <figure className="pms-reward">
        <img src={medal.emoji.picture} alt="" width={32} height={32} />
        <figcaption>
          <small>Unlocks</small>
          <code>{`:${medal.emoji.name}:`}</code>
        </figcaption>
      </figure>
    </li>
  );
}
