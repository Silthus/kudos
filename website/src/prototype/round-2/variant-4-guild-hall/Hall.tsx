// PROTOTYPE (#625) round 2 variant 4: the sunlit hedgehog guild hall, every object in it a way into the game. Never merge to main.
import type { CSSProperties } from "react";
import { HedgehogMoney } from "../../../hoggies";
import type { LadderCard, TierId } from "../../../shell";
import { AchievementEmblem, CrestArt, HoggieArt } from "../../art";
import type { Quest, World } from "../../world";
import { Coins, PackArt } from "./bits";
import { questName, sourceTag, trackedQuests } from "./hud";

export const bannerColours = ["#1D4AFF", "#F54E00", "#2f9e44", "#8a3ffc", "#c2255c", "#0c8599", "#b8860b"];

type HallProps = {
  world: World;
  receded: boolean;
  onTeam(team: string): void;
  onHoggiesBook(): void;
  onTeamBook(): void;
  onStore(): void;
  onTrophies(): void;
  onBoard(): void;
  onProgress(id: string): void;
  onOpenReward(questId: string): void;
};

export function Hall(props: HallProps) {
  const { world, receded } = props;
  return (
    <div className={`gh-hall ${receded ? "gh-hall-receded" : ""}`}>
      <div className="gh-hall-art" aria-hidden="true">
        <span className="gh-wall" />
        <span className="gh-post gh-post-left" />
        <span className="gh-post gh-post-right" />
        <span className="gh-beam" />
        <span className="gh-brace gh-brace-left" />
        <span className="gh-brace gh-brace-right" />
        <Window side="left" />
        <Window side="right" />
        <span className="gh-floor" />
        <span className="gh-rug" />
        <Motes />
      </div>
      <Banners teams={world.teams} onTeam={props.onTeam} />
      <NoticeBoard quests={world.quests} onBoard={props.onBoard} onProgress={props.onProgress} onOpenReward={props.onOpenReward} />
      <Fireplace />
      <Lectern onHoggies={props.onHoggiesBook} onTeams={props.onTeamBook} owned={world.owned} total={world.total} />
      <TrophyWall ladders={world.achievements} onOpen={props.onTrophies} />
      <ShopCounter onOpen={props.onStore} price={world.store.price} />
    </div>
  );
}

function Window({ side }: { side: "left" | "right" }) {
  return (
    <>
      <span className={`gh-window gh-window-${side}`}>
        <span className="gh-window-sky" />
        <span className="gh-window-cloud" />
        <span className="gh-window-hill" />
        <span className="gh-window-mullion" />
        <span className="gh-window-transom" />
      </span>
      <span className={`gh-shaft gh-shaft-${side}`} />
    </>
  );
}

const motes = Array.from({ length: 22 }, (_, index) => ({ left: 120 + ((index * 137) % 1220), top: 220 + ((index * 89) % 420), delay: (index * 0.73) % 8, size: 2 + (index % 3) }));

function Motes() {
  return (
    <span className="gh-motes">
      {motes.map((mote, index) => (
        <span key={index} className="gh-mote" style={{ left: mote.left, top: mote.top, width: mote.size, height: mote.size, animationDelay: `${mote.delay}s` }} />
      ))}
    </span>
  );
}

function Banners({ teams, onTeam }: { teams: World["teams"]; onTeam(team: string): void }) {
  return (
    <div className="gh-banners">
      <span className="gh-banner-rod" aria-hidden="true" />
      {teams.map((team, index) => (
        <button key={team.team} type="button" className="gh-banner" style={{ "--banner": bannerColours[index % bannerColours.length], "--sway-delay": `${index * -0.6}s` } as CSSProperties} onClick={() => onTeam(team.team)} aria-label={`${team.name} banner, open its page in the team book`}>
          <span className="gh-banner-cloth">
            <CrestArt art={team.art} size={46} name={team.name} collected={team.complete || team.crest !== null} />
            <span className="gh-banner-name">{team.name}</span>
            <span className="gh-banner-count">
              {team.held}/{team.total}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

type BoardProps = { quests: Quest[]; onBoard(): void; onProgress(id: string): void; onOpenReward(questId: string): void };

function NoticeBoard({ quests, onBoard, onProgress, onOpenReward }: BoardProps) {
  const notes = trackedQuests(quests);
  return (
    <section className="gh-board" aria-label="Quest board">
      <button type="button" className="gh-board-plaque" onClick={onBoard}>
        Quest board
      </button>
      <ol className="gh-notes">
        {notes.map((quest, index) => (
          <QuestNote key={quest.id} quest={quest} tilt={((index * 5) % 7) - 3} onProgress={onProgress} onOpenReward={onOpenReward} />
        ))}
      </ol>
    </section>
  );
}

export function QuestNote({ quest, tilt, big = false, onProgress, onFinish, onOpenReward }: { quest: Quest; tilt: number; big?: boolean; onProgress(id: string): void; onFinish?: (id: string) => void; onOpenReward(questId: string): void }) {
  return (
    <li className={`gh-note gh-note-${quest.source} gh-note-${quest.state} ${big ? "gh-note-big" : ""}`} style={{ "--tilt": `${tilt}deg` } as CSSProperties}>
      <span className="gh-note-pin" aria-hidden="true" />
      <span className={`gh-note-tag gh-note-tag-${quest.source}`}>{sourceTag[quest.source]}</span>
      <h3 className="gh-note-title">{questName(quest)}</h3>
      {quest.source !== "journey" && <p className="gh-note-goal">{quest.goal}</p>}
      {big && quest.hint !== null && <p className="gh-note-hint">{quest.hint}</p>}
      <span className="gh-note-pips" aria-label={`${quest.progress.done} of ${quest.progress.target}`}>
        {Array.from({ length: quest.progress.target }, (_, index) => (
          <span key={index} className={index < quest.progress.done ? "gh-pip-done" : ""} />
        ))}
      </span>
      <p className="gh-note-reward">
        {quest.reward.xp > 0 && <span className="gh-reward-xp">+{quest.reward.xp} XP</span>}
        {quest.reward.coins > 0 && <Coins amount={quest.reward.coins} size={12} />}
        <span>+ a pack</span>
      </p>
      {big && quest.opens !== null && <p className="gh-note-opens">Finishing it opens {quest.opens}.</p>}
      {quest.state === "finished" && (
        <>
          <span className="gh-stamp" aria-hidden="true">
            Done!
          </span>
          <button type="button" className="gh-button gh-button-gold gh-button-tiny" onClick={() => onOpenReward(quest.id)}>
            Open reward
          </button>
        </>
      )}
      {quest.state === "active" && (
        <span className="gh-note-actions">
          <button type="button" className="gh-simulate" onClick={() => onProgress(quest.id)} title="Prototype only: pretend you made progress in Slack">
            Simulate +1
          </button>
          {onFinish !== undefined && (
            <button type="button" className="gh-simulate" onClick={() => onFinish(quest.id)}>
              Simulate finish
            </button>
          )}
        </span>
      )}
      {quest.state === "claimed" && <p className="gh-note-claimed">Reward claimed</p>}
    </li>
  );
}

function Fireplace() {
  return (
    <div className="gh-fireplace" aria-hidden="true">
      <span className="gh-chimney" />
      <span className="gh-mantle" />
      <span className="gh-candle gh-candle-1" />
      <span className="gh-candle gh-candle-2" />
      <span className="gh-hearth">
        <span className="gh-fire">
          <span className="gh-flame gh-flame-1" />
          <span className="gh-flame gh-flame-2" />
          <span className="gh-flame gh-flame-3" />
        </span>
        <span className="gh-logs" />
      </span>
      <span className="gh-sleeper">
        <HoggieArt slug="asleep" size={96} />
        <span className="gh-zzz">z</span>
        <span className="gh-zzz gh-zzz-2">z</span>
      </span>
    </div>
  );
}

function Lectern({ onHoggies, onTeams, owned, total }: { onHoggies(): void; onTeams(): void; owned: number; total: number }) {
  return (
    <div className="gh-lectern">
      <span className="gh-lectern-stand" aria-hidden="true" />
      <button type="button" className="gh-tome gh-tome-hoggies" onClick={onHoggies}>
        <span className="gh-tome-title">Hoggies</span>
        <span className="gh-tome-sub">
          {owned}/{total}
        </span>
      </button>
      <button type="button" className="gh-tome gh-tome-teams" onClick={onTeams}>
        <span className="gh-tome-title">Teams</span>
        <span className="gh-tome-sub">book</span>
      </button>
    </div>
  );
}

function bestTierOf(ladder: LadderCard): TierId | null {
  return ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).at(-1)?.tier ?? null;
}

function TrophyWall({ ladders, onOpen }: { ladders: LadderCard[]; onOpen(): void }) {
  const shown = ladders.toSorted((first, second) => tierRank(bestTierOf(second)) - tierRank(bestTierOf(first))).slice(0, 6);
  return (
    <button type="button" className="gh-trophies" onClick={onOpen} aria-label="Trophy wall, open your achievements">
      <span className="gh-trophies-plaque">Trophies</span>
      <span className="gh-trophies-shelf">
        {shown.map((ladder) => (
          <span key={ladder.ladder} className="gh-trophy">
            <AchievementEmblem ladder={ladder.ladder} best={bestTierOf(ladder)} size={50} />
          </span>
        ))}
      </span>
    </button>
  );
}

const tierRanks: Record<TierId, number> = { bronze: 1, silver: 2, gold: 3, diamond: 4 };

export function tierRank(tier: TierId | null) {
  return tier === null ? 0 : tierRanks[tier];
}

function ShopCounter({ onOpen, price }: { onOpen(): void; price: number }) {
  return (
    <button type="button" className="gh-counter" onClick={onOpen} aria-label="The shop counter, open the shop">
      <span className="gh-counter-sign">Shop</span>
      <span className="gh-shopkeeper" aria-hidden="true">
        <HedgehogMoney size={120} />
      </span>
      <span className="gh-counter-top" aria-hidden="true" />
      <span className="gh-counter-front" aria-hidden="true" />
      <span className="gh-counter-wares" aria-hidden="true">
        <PackArt kind="bought" width={34} />
        <PackArt kind="weekly" width={30} />
        <span className="gh-coin-pile" />
      </span>
      <span className="gh-counter-price">
        Packs <Coins amount={price} size={13} />
      </span>
    </button>
  );
}
