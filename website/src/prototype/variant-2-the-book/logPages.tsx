// PROTOTYPE (#625): the book's printed log pages: contents, quest log, achievements, store, activity, leaderboard, settings. Never merge to main.
import type { LadderCard } from "../../shell";
import { HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar } from "../../hoggies";
import { MemberFace } from "../art";
import { rarityColour, rarityOrder, type Quest } from "../world";
import { useDesk } from "./desk";
import { chapters, firstSpreadOf } from "./spreads";
import { dayOf, namesOf, packLabel, plainTextOf, rewardOf, sourceLabel, rarityName } from "./text";

export function ContentsPlate() {
  const { world } = useDesk();
  const { me, level } = world;
  return (
    <div className="v2-plate">
      <p className="v2-kicker">Ex libris</p>
      <div className="v2-plate-art">
        <HedgehogReading size={150} />
      </div>
      <p className="v2-small">This book belongs to</p>
      <h2 className="v2-plate-name">{me.name}</h2>
      <dl className="v2-ledger">
        <Fact term="Level" value={`${level.level}`} />
        <Fact term="To next level" value={`${level.toNext} XP`} />
        <Fact term="Coins" value={`${world.coins}`} />
        <Fact term="Kudos left today" value={`${me.allowance.left} of ${me.allowance.base}`} />
        <Fact term="This week" value={`${me.thisWeek.given} given · ${me.thisWeek.received} received`} />
        <Fact term="All time" value={`${me.lifetime.given} given · ${me.lifetime.received} received`} />
      </dl>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="v2-fact">
      <dt>{term}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function ContentsIndex() {
  const { spreads, go, world } = useDesk();
  return (
    <div className="v2-index">
      <p className="v2-kicker">Contents</p>
      <h2 className="v2-title">In this book</h2>
      <ol className="v2-toc">
        {chapters.map((chapter) => (
          <li key={chapter.id} data-tier={chapter.tier}>
            <button type="button" onClick={() => go(chapter.address)}>
              <span>{chapter.name}</span>
              <span className="v2-leader" aria-hidden="true" />
              <span>{spreads[firstSpreadOf(spreads, chapter.id)]!.left.number}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="v2-small v2-hint">
        {world.owned} of {world.total} hoggies · {world.teams.filter(({ complete }) => complete).length} of {world.teams.length} team pages complete. Turn pages with ← and →, or a page corner.
      </p>
    </div>
  );
}

export function QuestsNow() {
  const { world } = useDesk();
  const journey = world.quests.find(({ source, state }) => source === "journey" && state === "active");
  const weekly = world.quests.filter(({ source, state }) => source === "weekly" && state === "active");
  return (
    <div className="v2-log">
      <p className="v2-kicker">Quest log</p>
      <h2 className="v2-title">What comes next</h2>
      {journey === undefined ? <p className="v2-small">The Journey is complete.</p> : <QuestEntry quest={journey} lead />}
      <h3 className="v2-subtitle">This week</h3>
      {weekly.length === 0 ? <p className="v2-small">Every weekly quest is done.</p> : weekly.map((quest) => <QuestEntry key={quest.id} quest={quest} />)}
    </div>
  );
}

export function QuestsDone() {
  const { world } = useDesk();
  const team = world.quests.filter(({ source, state }) => source === "group" && state === "active");
  const done = world.quests.filter(({ state }) => state !== "active");
  return (
    <div className="v2-log">
      <h3 className="v2-subtitle">Team quests</h3>
      {team.length === 0 ? <p className="v2-small">No team quest is running.</p> : team.map((quest) => <QuestEntry key={quest.id} quest={quest} />)}
      <h3 className="v2-subtitle">Finished</h3>
      {done.length === 0 ? <p className="v2-small">Nothing finished yet.</p> : done.map((quest) => <QuestEntry key={quest.id} quest={quest} />)}
    </div>
  );
}

function QuestEntry({ quest, lead = false }: { quest: Quest; lead?: boolean }) {
  const { nudge, finish, openPack, world } = useDesk();
  const packWaiting = world.packs.some(({ id }) => id === `pack:${quest.id}`);
  return (
    <article className="v2-quest" data-state={quest.state} data-lead={lead}>
      <p className="v2-quest-source">{sourceLabel[quest.source]}</p>
      <p className="v2-quest-goal">{quest.goal}</p>
      {quest.hint !== null && quest.state === "active" && <p className="v2-small">{quest.hint}</p>}
      <div className="v2-quest-foot">
        <Ticks quest={quest} />
        <span className="v2-small">{rewardOf(quest)}</span>
        {quest.opens !== null && <span className="v2-small">Opens {quest.opens}</span>}
      </div>
      {quest.state === "active" && (
        <div className="v2-simulate">
          <button type="button" onClick={() => nudge(quest)}>
            Simulate +1
          </button>
          <button type="button" onClick={() => finish(quest)}>
            Finish
          </button>
        </div>
      )}
      {quest.state === "finished" && packWaiting && (
        <button type="button" className="v2-ink-button" onClick={() => openPack(`pack:${quest.id}`)}>
          Open its pack
        </button>
      )}
      {quest.state === "claimed" && <span className="v2-claimed">Claimed</span>}
    </article>
  );
}

export function Ticks({ quest }: { quest: Quest }) {
  return (
    <span className="v2-ticks" aria-label={`${quest.progress.done} of ${quest.progress.target}`}>
      {Array.from({ length: quest.progress.target }, (_, index) => (
        <span key={index} data-done={index < quest.progress.done} />
      ))}
    </span>
  );
}

export function EarnedHalf({ half }: { half: 0 | 1 }) {
  const { world } = useDesk();
  const middle = Math.ceil(world.achievements.length / 2);
  const ladders = half === 0 ? world.achievements.slice(0, middle) : world.achievements.slice(middle);
  return (
    <div className="v2-earned">
      {half === 0 && (
        <>
          <p className="v2-kicker">Achievements</p>
          <h2 className="v2-title">The trophy plates</h2>
        </>
      )}
      <ul className="v2-plates" data-half={half}>
        {ladders.map((ladder) => (
          <EngravedPlate key={ladder.ladder} ladder={ladder} />
        ))}
      </ul>
    </div>
  );
}

function EngravedPlate({ ladder }: { ladder: LadderCard }) {
  return (
    <li className="v2-engraved">
      <div className="v2-engraved-head">
        <span className="v2-engraved-name">{ladder.name}</span>
        <span className="v2-small">
          {ladder.count} {ladder.counts}
        </span>
      </div>
      <ol className="v2-medals">
        {ladder.tiers.map((tier) => (
          <li key={tier.tier} data-tier={tier.tier} data-earned={tier.earnedAt !== null} title={`${tier.name}: ${tier.at}`}>
            <span className="v2-medal" />
            <span className="v2-medal-at">{tier.at}</span>
          </li>
        ))}
      </ol>
      {ladder.next !== null && <p className="v2-small">Next at {ladder.next.at}</p>}
    </li>
  );
}

export function StorePacks() {
  const { world, openPack } = useDesk();
  return (
    <div className="v2-store">
      <p className="v2-kicker">Store</p>
      <h2 className="v2-title">Packs tucked in</h2>
      {world.packs.length === 0 ? (
        <p className="v2-small">No packs waiting. Finish a quest or buy one at the counter.</p>
      ) : (
        <ul className="v2-envelopes">
          {world.packs.map((pack) => (
            <li key={pack.id}>
              <button type="button" className="v2-envelope" data-kind={pack.kind} onClick={() => openPack(pack.id)}>
                <span className="v2-envelope-flap" aria-hidden="true" />
                <span className="v2-envelope-seal" aria-hidden="true">
                  H
                </span>
                <span className="v2-envelope-label">{packLabel[pack.kind]}</span>
                <span className="v2-envelope-from">{pack.from}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StoreCounter() {
  const { world, actions } = useDesk();
  const affordable = world.coins >= world.store.price;
  return (
    <div className="v2-counter">
      <div className="v2-counter-art">
        <HedgehogMoney size={120} />
      </div>
      <h3 className="v2-subtitle">The counter</h3>
      <p className="v2-coins-line">
        <span className="v2-coin" aria-hidden="true" /> {world.coins} coins in your purse
      </p>
      <button type="button" className="v2-ink-button" disabled={!affordable} onClick={() => actions.buyPack()}>
        Buy a pack · {world.store.price} coins
      </button>
      {!affordable && <p className="v2-small">Not enough coins yet.</p>}
      <h3 className="v2-subtitle">Found so far, by rarity</h3>
      <ul className="v2-odds">
        {rarityOrder.map((rarity) => {
          const share = world.rarities.find((entry) => entry.rarity === rarity)!;
          return (
            <li key={rarity} style={{ borderColor: rarityColour[rarity] }}>
              <span style={{ color: rarityColour[rarity] }}>{rarityName[rarity]}</span>
              <span className="v2-small">
                {share.owned}/{share.total} found
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ActivityReceived() {
  const { world } = useDesk();
  return (
    <div className="v2-log">
      <p className="v2-kicker">Activity</p>
      <h2 className="v2-title">Thanks you received</h2>
      <ul className="v2-letters">
        {world.received.map((entry) => (
          <li key={entry.key} className="v2-letter">
            <MemberFace face={entry.giver.face} className="v2-face-small" />
            <div>
              <p className="v2-letter-head">
                From {entry.giver.name} · {dayOf(entry.at)}
              </p>
              <p className="v2-letter-body">{plainTextOf(entry.message)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityGiven() {
  const { world } = useDesk();
  return (
    <div className="v2-log">
      <h2 className="v2-title">Thanks you gave</h2>
      <ul className="v2-letters">
        {world.given.map((entry) => (
          <li key={entry.key} className="v2-letter">
            <MemberFace face={entry.recipients[0]?.face ?? { kind: "initials", initials: "?" }} className="v2-face-small" />
            <div>
              <p className="v2-letter-head">
                To {namesOf(entry)} · {dayOf(entry.at)}
              </p>
              <p className="v2-letter-body">{plainTextOf(entry.message)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BoardPodium() {
  const { world } = useDesk();
  const podium = world.board.slice(0, 3);
  const you = world.board.find((row) => row.you);
  return (
    <div className="v2-log">
      <p className="v2-kicker">Leaderboard</p>
      <h2 className="v2-title">This week's givers</h2>
      <ol className="v2-podium">
        {[podium[1], podium[0], podium[2]].map(
          (row, step) =>
            row !== undefined && (
              <li key={row.name} data-step={step}>
                <MemberFace face={row.face} className="v2-face" />
                <span className="v2-podium-name">{row.name}</span>
                <span className="v2-podium-block">{row.rank}</span>
              </li>
            ),
        )}
      </ol>
      {you !== undefined && (
        <p className="v2-you-line">
          You are #{you.rank} with {you.kudos} kudos given.
        </p>
      )}
    </div>
  );
}

export function BoardRows() {
  const { world } = useDesk();
  return (
    <div className="v2-log">
      <ol className="v2-rows">
        {world.board.map((row) => (
          <li key={`${row.rank}-${row.name}`} data-you={row.you}>
            <span className="v2-row-rank">{row.rank}</span>
            <MemberFace face={row.face} className="v2-face-small" />
            <span className="v2-row-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="v2-leader" aria-hidden="true" />
            <span>{row.kudos}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SettingsIntro() {
  return (
    <div className="v2-plate">
      <p className="v2-kicker">Settings · admin</p>
      <div className="v2-plate-art">
        <HedgehogOrganized size={150} />
      </div>
      <h2 className="v2-title">The back pages</h2>
      <p className="v2-small">Your own settings and, for admins, the workspace's: the kudos emoji, the daily allowance, the announcement channel.</p>
      <p className="v2-small v2-hint">The sheet on the right is today's settings page, bound into the book.</p>
    </div>
  );
}

export function SettingsSheet() {
  const { settingsPage } = useDesk();
  return <div className="v2-settings-sheet">{settingsPage ?? <p className="v2-small">Turning to Settings…</p>}</div>;
}

export function Endpaper() {
  const { world } = useDesk();
  return (
    <div className="v2-endpaper">
      <HedgehogStar size={110} />
      <p className="v2-kicker">The tally</p>
      <h2 className="v2-title">
        {world.owned} of {world.total} hoggies
      </h2>
      <ul className="v2-tally">
        {world.rarities.map(({ rarity, owned, total }) => (
          <li key={rarity}>
            <span style={{ color: rarityColour[rarity] }}>{rarityName[rarity]}</span>
            <span className="v2-tally-track">
              <span style={{ width: `${total === 0 ? 0 : (owned / total) * 100}%`, background: rarityColour[rarity] }} />
            </span>
            <span className="v2-small">
              {owned}/{total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
