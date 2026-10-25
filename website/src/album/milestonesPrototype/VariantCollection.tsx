// PROTOTYPE variant B: the whole collection as one grid, with an inspector. Throwaway.
import { useState } from "react";
import { LadderEmblem } from "../../book/LadderEmblem";
import { PageTitle } from "../../PageTitle";
import type { Album } from "../answer";
import { climbedShareOf, metalOrder, tierWordOf, unitOf } from "../milestones";
import { dateOf } from "../teamPage";
import { closestOf, countWordsOf, earnedOf, hintOf, medalsOf, slackWordsOf, type Medal } from "./model";

export function VariantCollection({ album }: { album: Album }) {
  const all = medalsOf(album);
  const [chosen, setChosen] = useState(() => closestOf(album)?.key ?? all[0]?.key ?? null);
  const shown = all.find(({ key }) => key === chosen) ?? null;
  return (
    <div className="al-page-body pms pms-b">
      <header className="pms-b-head">
        <div>
          <p className="al-eyebrow">Album</p>
          <PageTitle tab="Milestones" size="hero">
            Milestones
          </PageTitle>
        </div>
        <p className="pms-b-tally">
          <strong>{earnedOf(album).length}</strong> <span>{`of ${all.length} emojis unlocked`}</span>
        </p>
      </header>
      <div className="pms-b-layout">
        <div className="pms-b-grid" role="grid" aria-label="Milestone medals">
          <div className="pms-b-corner" />
          {metalOrder.map((metal) => (
            <div key={metal} className="pms-b-colhead" data-metal={metal}>
              {tierWordOf(metal)}
            </div>
          ))}
          {album.milestones.map((milestone) => {
            const row = all.filter((medal) => medal.milestone === milestone);
            const first = row[0]!;
            return (
              <div key={milestone.id} className="pms-b-row" role="row">
                <div className="pms-b-rowhead">
                  <LadderEmblem ladder={first.ladder} best={row.findLast(({ step }) => step === "earned")?.tier.tier ?? null} size={44} />
                  <div>
                    <strong>{first.milestoneName}</strong>
                    <span className="pms-quiet">{`${milestone.count} ${unitOf(milestone.id, milestone.count)}`}</span>
                    <div className="pms-bar pms-bar-thin" aria-hidden="true">
                      <span style={{ width: `${climbedShareOf(milestone) * 100}%` }} />
                    </div>
                  </div>
                </div>
                {row.map((medal) => (
                  <Cell key={medal.key} medal={medal} chosen={medal.key === chosen} onChoose={() => setChosen(medal.key)} />
                ))}
              </div>
            );
          })}
        </div>
        {shown !== null && <Inspector medal={shown} />}
      </div>
    </div>
  );
}

function Cell({ medal, chosen, onChoose }: { medal: Medal; chosen: boolean; onChoose: () => void }) {
  return (
    <button type="button" role="gridcell" className="pms-b-cell" data-step={medal.step} data-chosen={chosen ? "" : undefined} onClick={onChoose} aria-label={`${medal.tier.name}, ${medal.metal}`}>
      <span className="pms-b-cell-art">
        {medal.step === "next" && <Ring share={medal.share} />}
        <img src={medal.emoji.picture} alt="" width={40} height={40} />
      </span>
      <span className="pms-b-cell-name">{medal.tier.name}</span>
      <span className="pms-b-cell-note">{medal.step === "earned" ? "✓" : medal.step === "next" ? `${medal.reached}/${medal.tier.at}` : `at ${medal.tier.at}`}</span>
    </button>
  );
}

function Ring({ share }: { share: number }) {
  const length = 2 * Math.PI * 46;
  return (
    <svg className="pms-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" className="pms-ring-track" />
      <circle cx="50" cy="50" r="46" className="pms-ring-fill" strokeDasharray={`${length * share} ${length}`} />
    </svg>
  );
}

function Inspector({ medal }: { medal: Medal }) {
  return (
    <aside className="pms-b-inspector" aria-live="polite">
      <LadderEmblem ladder={medal.ladder} best={medal.tier.tier} size={96} />
      <p className="pms-metal" data-metal={medal.tier.tier}>
        {medal.metal}
      </p>
      <h2 className="pms-b-ins-name">{medal.tier.name}</h2>
      <p className="pms-quiet">{medal.milestoneName}</p>
      {medal.step === "earned" ? (
        <p className="pms-b-ins-status" data-done="">{`Earned ${dateOf(medal.tier.earnedAt!)}`}</p>
      ) : (
        <>
          <p className="pms-b-ins-status">{`${medal.toGo} to go`}</p>
          <div className="pms-bar" aria-hidden="true">
            <span style={{ width: `${medal.share * 100}%` }} />
          </div>
          <p className="pms-quiet">{countWordsOf(medal)}</p>
        </>
      )}
      <figure className="pms-b-ins-reward" data-earned={medal.step === "earned" ? "" : undefined}>
        <img src={medal.emoji.picture} alt="" width={48} height={48} />
        <figcaption>
          <code>{`:${medal.emoji.name}:`}</code>
          <span>{medal.step === "earned" ? slackWordsOf(medal) : "Your Slack emoji when you earn it"}</span>
        </figcaption>
      </figure>
      {medal.step !== "earned" && (
        <div className="pms-b-ins-how">
          <h3>How to get there</h3>
          <p>{hintOf[medal.milestone.id]}</p>
        </div>
      )}
      {medal.step === "earned" && slackWordsOf(medal) === "Add to Slack" && (
        <button type="button" className="pms-button">
          Add to Slack
        </button>
      )}
    </aside>
  );
}
