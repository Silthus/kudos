// PROTOTYPE (#625): the pages printed inside the Game HUD's book. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import type { CollectionHoggie, CollectionTeamPage } from "../../collectionRead";
import { HedgehogMoney, HedgehogParty } from "../../hoggies";
import type { LadderCard, Rarity } from "../../shell";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import type { Pack } from "../world";

function Page({ heading, sub, folio, children }: { heading: string; sub?: ReactNode; folio?: number; children: ReactNode }) {
  return (
    <div className="v1-page-inner">
      <header className="v1-page-head">
        <h2>{heading}</h2>
        {sub !== undefined && <span>{sub}</span>}
      </header>
      <div className="v1-page-body">{children}</div>
      {folio !== undefined && <footer className="v1-folio">{folio}</footer>}
    </div>
  );
}

export function RarityPill({ rarity }: { rarity: Rarity }) {
  return (
    <span className="v1-rarity-pill" style={{ background: `var(--rarity-${rarity})` }}>
      {rarity}
    </span>
  );
}

export function HoggiePage({ rarity, hoggies, owned, total, folio }: { rarity: Rarity; hoggies: CollectionHoggie[]; owned: number; total: number; folio: number }) {
  return (
    <Page heading={`${rarity[0]!.toUpperCase()}${rarity.slice(1)} hoggies`} sub={`${owned} / ${total} found`} folio={folio}>
      <ul className="v1-hoggie-grid" style={{ "--rarity": `var(--rarity-${rarity})` } as CSSProperties}>
        {hoggies.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} />
        ))}
      </ul>
    </Page>
  );
}

function HoggieSlot({ hoggie }: { hoggie: CollectionHoggie }) {
  const found = hoggie.count > 0;
  return (
    <li className={`v1-hoggie-slot ${found ? "" : "v1-missing"}`} title={found ? hoggie.name : "Not found yet"}>
      <span className="v1-hoggie-art">
        <HoggieArt slug={hoggie.hoggie} size={64} silhouette={!found} />
      </span>
      <span className="v1-hoggie-name">{found ? hoggie.name : "???"}</span>
      {hoggie.count > 1 && <span className="v1-hoggie-count">×{hoggie.count}</span>}
    </li>
  );
}

export function TeamCoverPage({ team }: { team: CollectionTeamPage }) {
  const leads = team.people.filter((person) => person.lead).map((person) => person.name);
  return (
    <Page heading={team.name} sub={team.mine ? "Your team" : "Team page"}>
      <div className="v1-team-cover">
        <CrestArt art={team.art} size={150} name={team.name} collected={team.crest !== null || team.complete} />
        <p className="v1-team-count">
          <strong>{team.held}</strong> of {team.total} teammates thanked
        </p>
        <Meter value={team.held} max={team.total} label={`${team.name} stickers`} />
        <p className="v1-team-note">{team.complete ? "Page complete: the crest is yours." : "Thank each teammate once to fill the page and earn the crest."}</p>
        {leads.length > 0 && <p className="v1-team-leads">Led by {leads.join(" and ")}</p>}
      </div>
    </Page>
  );
}

export function TeamPeoplePage({ team }: { team: CollectionTeamPage }) {
  return (
    <Page heading="Stickers" sub={`${team.held} / ${team.total}`}>
      <ul className={`v1-people ${team.people.length > 15 ? "v1-people-dense" : ""}`}>
        {team.people.map((person) => (
          <li key={person.key} className={person.held ? "v1-sticker" : "v1-sticker v1-missing"} title={person.held ? `${person.name}, thanked` : `${person.name}, not thanked yet`}>
            <MemberFace face={person.face} className="v1-sticker-face" />
            <span className="v1-sticker-name">{person.name.split(" ")[0]}</span>
          </li>
        ))}
      </ul>
    </Page>
  );
}

const tierColour = { bronze: "#b06a2c", silver: "#8a8f98", gold: "#c99a06", diamond: "#2b8fd6" } as const;

export function AchievementsPage({ ladders, folio }: { ladders: LadderCard[]; folio: number }) {
  return (
    <Page heading="Achievements" folio={folio}>
      <ul className="v1-ladders">
        {ladders.map((ladder) => (
          <li key={ladder.ladder} className="v1-ladder">
            <div className="v1-ladder-head">
              <strong>{ladder.name}</strong>
              <span>
                {ladder.count} {ladder.counts}
              </span>
            </div>
            <div className="v1-medals">
              {ladder.tiers.map((tier) => (
                <span key={tier.tier} className={`v1-medal ${tier.earnedAt === null ? "v1-medal-locked" : ""}`} style={{ "--metal": tierColour[tier.tier] } as CSSProperties} title={`${tier.name}: ${tier.at}`}>
                  <span className="v1-medal-disc">{tier.at}</span>
                  <span className="v1-medal-name">{tier.name}</span>
                </span>
              ))}
            </div>
            {ladder.next !== null ? <Meter value={ladder.count} max={ladder.next.at} label={`${ladder.name} to ${ladder.next.tier}`} /> : <p className="v1-ladder-done">Every tier earned</p>}
          </li>
        ))}
      </ul>
    </Page>
  );
}

export function ShopPage({ coins, price, onBuy }: { coins: number; price: number; onBuy(): void }) {
  const short = coins < price;
  return (
    <Page heading="The pack shop" sub={<Coins amount={coins} />}>
      <div className="v1-shop">
        <PackArt size={150} />
        <p className="v1-shop-name">Hoggie pack</p>
        <p className="v1-shop-odds">One hoggie of any rarity, plus XP and coins.</p>
        <button type="button" className="v1-button v1-button-gold" disabled={short} onClick={onBuy}>
          Buy for <Coins amount={price} />
        </button>
        {short && <p className="v1-shop-short">You need {price - coins} more coins.</p>}
      </div>
    </Page>
  );
}

const packLabel: Record<Pack["kind"], string> = { journey: "Journey pack", weekly: "Weekly pack", group: "Team pack", bought: "Bought pack" };

export function BagPage({ packs, onOpen }: { packs: Pack[]; onOpen(id: string): void }) {
  const shown = packs.slice(0, 5);
  return (
    <Page heading="Your bag" sub={`${packs.length} unopened`}>
      {packs.length === 0 ? (
        <div className="v1-bag-empty">
          <HedgehogMoney size={120} />
          <p>No packs waiting. Finish a quest or buy one.</p>
        </div>
      ) : (
        <ul className="v1-bag">
          {shown.map((pack) => (
            <li key={pack.id} className="v1-bag-pack">
              <PackArt size={44} />
              <span className="v1-bag-text">
                <strong>{packLabel[pack.kind]}</strong>
                <span>{pack.from}</span>
              </span>
              <button type="button" className="v1-button v1-button-gold" onClick={() => onOpen(pack.id)}>
                Open
              </button>
            </li>
          ))}
          {packs.length > shown.length && <li className="v1-bag-more">+{packs.length - shown.length} more below the fold</li>}
        </ul>
      )}
    </Page>
  );
}

export function PackArt({ size }: { size: number }) {
  return (
    <span className="v1-pack-art" style={{ width: size * 0.72, height: size }} aria-hidden="true">
      <HedgehogParty size={Math.round(size * 0.6)} />
    </span>
  );
}

export function Coins({ amount }: { amount: number }) {
  return (
    <span className="v1-coins">
      <span className="v1-coin" aria-hidden="true" />
      {amount}
      <span className="sr-only"> coins</span>
    </span>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <span className="v1-meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${share * 100}%` }} />
    </span>
  );
}
