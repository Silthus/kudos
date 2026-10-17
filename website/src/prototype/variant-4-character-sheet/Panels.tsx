// PROTOTYPE (#625): the panels that replace the inventory side: vendor, achievements, combat log, ladder and options. Never merge to main.
import { useState, type CSSProperties, type ReactNode } from "react";
import { catalogue, rarities } from "../../../../convex/hoggies/catalogue";
import { AppLink } from "../../AppLink";
import { TextWithEmoji } from "../../Emoji";
import { HedgehogMoney } from "../../hoggies";
import { MemberFace } from "../art";
import { rarityColour, type World, type WorldActions } from "../world";
import { dayOf, metalOf, packLook, rarityLabel, textOf } from "./sheet";

function Panel({ title, detail, children, className = "" }: { title: string; detail?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`v4-panel v4-side-panel ${className}`} aria-label={title}>
      <header className="v4-plate">
        <span>{title}</span>
        {detail !== undefined && <small>{detail}</small>}
        <AppLink href="/" className="v4-plate-close" aria-label="Back to inventory">
          ✕
        </AppLink>
      </header>
      <div className="v4-side-body">{children}</div>
    </section>
  );
}

export function StorePanel({ world, actions, onOpenPack }: { world: World; actions: WorldActions; onOpenPack: (id: string) => void }) {
  const [bought, setBought] = useState(0);
  const price = world.store.price;
  const affordable = world.coins >= price;
  const weightTotal = rarities.reduce((sum, { weight }) => sum + weight, 0);
  return (
    <Panel title="Vendor" detail={`${world.coins} coins`} className="v4-store">
      <div className="v4-vendor">
        <HedgehogMoney size={150} />
        <p className="v4-vendor-says">“Packs, fresh from the warren. One hoggie in every pack, and a little XP for your trouble.”</p>
      </div>
      <div className="v4-ware">
        <span className="v4-pack v4-pack-big" style={{ "--pack": packLook.bought.colour } as CSSProperties} aria-hidden="true" />
        <div>
          <p className="v4-ware-name" style={{ color: rarityColour.epic }}>
            Store Pack
          </p>
          <p className="v4-ware-kind">Pack · {catalogue.cratePrice} coins</p>
          <ul className="v4-ware-odds">
            {rarities.map(({ rarity, weight }) => (
              <li key={rarity} style={{ color: rarityColour[rarity] }}>
                {rarityLabel[rarity]} {Math.round((weight / weightTotal) * 100)}%
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="v4-button v4-button-gold"
            disabled={!affordable}
            onClick={() => {
              if (actions.buyPack()) setBought((count) => count + 1);
            }}
          >
            {affordable ? `Buy for ${price} coins` : `Needs ${price - world.coins} more coins`}
          </button>
          {bought > 0 && (
            <p className="v4-ware-bought">
              {bought} {bought === 1 ? "pack" : "packs"} added to your bag.
            </p>
          )}
        </div>
      </div>
      <div className="v4-store-bag">
        <p>Packs in your bag · click one to open it here</p>
        <ul>
          {world.packs.map((pack) => (
            <li key={pack.id}>
              <button type="button" className="v4-store-pack" onClick={() => onOpenPack(pack.id)} aria-label={`Open ${packLook[pack.kind].name}`}>
                <span className="v4-pack" style={{ "--pack": packLook[pack.kind].colour } as CSSProperties} />
                <small>{packLook[pack.kind].name}</small>
              </button>
            </li>
          ))}
          {world.packs.length === 0 && <li className="v4-store-empty">No packs yet.</li>}
        </ul>
      </div>
    </Panel>
  );
}

export function AchievementsPanel({ world }: { world: World }) {
  return (
    <Panel title="Achievements" detail={`${world.achievements.length} ladders`}>
      <ul className="v4-ladders">
        {world.achievements.map((ladder) => {
          const nextTier = ladder.tiers.find(({ earnedAt }) => earnedAt === null);
          return (
            <li key={ladder.ladder} className="v4-ladder">
              <div className="v4-ladder-head">
                <p>{ladder.name}</p>
                <small>
                  {ladder.count} {ladder.counts}
                  {ladder.next !== null && ` · next at ${ladder.next.at}`}
                </small>
              </div>
              <ol className="v4-ladder-tiers">
                {ladder.tiers.map((tier) => {
                  const earned = tier.earnedAt !== null;
                  return (
                    <li key={tier.tier} className={earned ? "" : "v4-ladder-locked"} aria-current={tier === nextTier ? "step" : undefined}>
                      <span className="v4-medal" style={{ "--metal": earned ? metalOf[tier.tier].colour : "#a3a39a" } as CSSProperties}>
                        {tier.tier.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="v4-ladder-tier-name" style={{ color: earned ? rarityColour[metalOf[tier.tier].rarity] : undefined }}>
                        {tier.name}
                      </span>
                      <small>{earned ? new Date(tier.earnedAt ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : `at ${tier.at}`}</small>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ActivityPanel({ world }: { world: World }) {
  const lines = [
    ...world.received.map((entry) => ({ key: entry.key, at: entry.at, kind: "received" as const, who: entry.giver.name, text: textOf(entry.message) })),
    ...world.given.map((entry) => ({ key: entry.key, at: entry.at, kind: "given" as const, who: entry.recipients.map(({ name }) => name).join(", "), text: textOf(entry.message), xp: entry.earned?.xp ?? null })),
  ].toSorted((first, second) => second.at - first.at);
  return (
    <Panel title="Combat log" detail="Recent kudos" className="v4-activity">
      <ol className="v4-log">
        {lines.map((line) => (
          <li key={line.key} className={`v4-log-line v4-log-${line.kind}`}>
            <time>[{dayOf(line.at)}]</time>{" "}
            {line.kind === "received" ? (
              <>
                <strong>{line.who}</strong> thanks <em>you</em>
              </>
            ) : (
              <>
                <em>You</em> thank <strong>{line.who}</strong>
              </>
            )}
            : <q>
              <TextWithEmoji text={line.text} />
            </q>
            {"xp" in line && line.xp !== null && <span className="v4-log-xp"> +{line.xp} XP</span>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function LeaderboardPanel({ world }: { world: World }) {
  return (
    <Panel title="Ladder" detail="Kudos received this period">
      <ol className="v4-board">
        {world.board.map((row) => (
          <li key={`${row.rank}-${row.name}`} className={`v4-board-row ${row.you ? "v4-board-you" : ""} ${row.rank <= 3 ? `v4-board-top v4-board-${row.rank}` : ""}`}>
            <span className="v4-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="v4-face" />
            <span className="v4-board-name">
              {row.name}
              {row.you && " (you)"}
            </span>
            <span className="v4-board-kudos">{row.kudos}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function SettingsPanel({ todaysPage }: { todaysPage: ReactNode }) {
  return (
    <Panel title="Options" detail="Workspace and personal settings" className="v4-options">
      <div className="v4-options-embed">{todaysPage}</div>
    </Panel>
  );
}
