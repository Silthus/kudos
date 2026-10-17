// PROTOTYPE (#625): the paperdoll: your hoggie in an ornate frame with equipment slots, and the stats block. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import { AppLink } from "../../AppLink";
import { NamedEmoji } from "../../Emoji";
import { HedgehogWizard } from "../../hoggies";
import { CrestArt, HoggieArt } from "../art";
import { levelAt, rarityColour, type World } from "../world";
import { metalOf, packLook, rarityLabel, rarityRank, topTierOf, useTicking } from "./sheet";
import { useTip, type Tip } from "./Tooltip";

type SlotProps = { label: string; tip: Tip; glow: string; children: ReactNode; onActivate?: () => void; href?: string; wide?: boolean };

function Slot({ label, tip, glow, children, onActivate, href, wide = false }: SlotProps) {
  const tipFor = useTip();
  const className = `v4-slot ${wide ? "v4-slot-wide" : ""}`;
  const style = { "--glow": glow } as CSSProperties;
  const body = (
    <>
      <span className="v4-slot-art">{children}</span>
      <span className="v4-slot-label">{label}</span>
    </>
  );
  if (href !== undefined)
    return (
      <AppLink href={href} className={className} style={style} {...tipFor(tip)}>
        {body}
      </AppLink>
    );
  return (
    <button type="button" className={className} style={style} onDoubleClick={onActivate} onKeyDown={(event) => event.key === "Enter" && onActivate?.()} {...tipFor(tip)}>
      {body}
    </button>
  );
}

export function Paperdoll({ world, onOpenPack }: { world: World; onOpenPack: (id: string) => void }) {
  const myTeam = world.teams.find(({ mine }) => mine) ?? world.teams[0];
  const charm = world.hoggies.filter(({ count }) => count > 0).toSorted((first, second) => rarityRank[second.rarity] - rarityRank[first.rarity])[0];
  const title = topTierOf(world.achievements);
  const nextPack = world.packs[0];
  return (
    <section className="v4-panel v4-doll" aria-label="Your character">
      <header className="v4-plate">
        <span>{world.me.name}</span>
        <small>{title === null ? "Newcomer" : `${title.tier.name} of ${title.ladder.name}`}</small>
      </header>
      <div className="v4-doll-frame">
        <div className="v4-doll-column">
          {myTeam !== undefined && (
            <Slot label="Crest" glow={rarityColour.rare} tip={{ name: `${myTeam.name} Crest`, colour: rarityColour.rare, kind: "Crest · Equipped", stats: [`${myTeam.held} of ${myTeam.total} teammates thanked`], flavour: "Worn by everyone who has thanked the whole team." }} href={`/book#teams/${myTeam.team}`}>
              <CrestArt art={myTeam.art} size={46} name={myTeam.name} />
            </Slot>
          )}
          <Slot label="Title" glow={title === null ? rarityColour.common : rarityColour[metalOf[title.tier.tier].rarity]} tip={title === null ? { name: "No title yet", colour: rarityColour.common, kind: "Title", flavour: "Earn an achievement tier to wear a title." } : { name: title.tier.name, colour: rarityColour[metalOf[title.tier.tier].rarity], kind: `Title · ${title.tier.tier} tier`, stats: [`${title.ladder.name}: ${title.ladder.count} ${title.ladder.counts}`], flavour: "Your highest achievement tier." }} href="/book/earned">
            <span className="v4-medal" style={{ "--metal": title === null ? "#9a9a8e" : metalOf[title.tier.tier].colour } as CSSProperties}>
              ★
            </span>
          </Slot>
          <Slot label="Emoji" glow={rarityColour.uncommon} tip={{ name: `:${world.me.kudosEmoji}:`, colour: rarityColour.uncommon, kind: "Kudos emoji · Equipped", stats: [`${world.me.allowance.left} of ${world.me.allowance.base} charges left today`], flavour: "React with it in Slack to thank someone." }}>
            <span className="v4-emoji">
              <NamedEmoji name={world.me.kudosEmoji} />
            </span>
          </Slot>
        </div>
        <div className="v4-doll-figure" aria-hidden="true">
          <span className="v4-doll-halo" />
          <HedgehogWizard size={190} />
        </div>
        <div className="v4-doll-column">
          {charm !== undefined && (
            <Slot label="Charm" glow={rarityColour[charm.rarity]} tip={{ name: charm.name, colour: rarityColour[charm.rarity], kind: `Charm · ${rarityLabel[charm.rarity]} hoggie`, stats: [`Held ×${charm.count}`], flavour: "The rarest hoggie you own." }}>
              <HoggieArt slug={charm.hoggie} size={48} />
            </Slot>
          )}
          {myTeam !== undefined && (
            <Slot label="Banner" glow={myTeam.complete ? rarityColour.legendary : rarityColour.epic} tip={{ name: `${myTeam.name} Banner`, colour: rarityColour.epic, kind: "Banner · Your team", stats: [`${myTeam.people.length} teammates on the page`, myTeam.complete ? "Team page complete" : `${myTeam.total - myTeam.held} still to thank`] }} href={`/book#teams/${myTeam.team}`}>
              <span className="v4-banner">{myTeam.name.slice(0, 2)}</span>
            </Slot>
          )}
          <Slot
            label={`Pack ×${world.packs.length}`}
            glow={nextPack === undefined ? rarityColour.common : rarityColour[packLook[nextPack.kind].rarity]}
            tip={nextPack === undefined ? { name: "Empty pack slot", colour: rarityColour.common, kind: "Pack", flavour: "Finish a quest or visit the store." } : { name: packLook[nextPack.kind].name, colour: rarityColour[packLook[nextPack.kind].rarity], kind: "Pack · Double-click to open", stats: [`From: ${nextPack.from}`, `${world.packs.length} waiting`], action: { label: "Open pack", run: () => onOpenPack(nextPack.id) } }}
            onActivate={() => nextPack !== undefined && onOpenPack(nextPack.id)}
          >
            {nextPack === undefined ? <span className="v4-pack v4-pack-empty" /> : <span className="v4-pack v4-pack-small" style={{ "--pack": packLook[nextPack.kind].colour } as CSSProperties} />}
          </Slot>
        </div>
        <Slot wide label="Tome of Hoggies" glow={rarityColour.legendary} tip={{ name: "Tome of Hoggies", colour: rarityColour.legendary, kind: "Book · Click to open", stats: [`${world.owned} of ${world.total} hoggies`, `${world.teams.length} team pages`], flavour: "Every hoggie you find, every teammate you thank." }} href="/book">
          <span className="v4-tome-icon">❦</span>
        </Slot>
      </div>
      <Stats world={world} />
    </section>
  );
}

function Stats({ world }: { world: World }) {
  const xp = useTicking(world.level.xp, 1200);
  const coins = useTicking(world.coins);
  const climbing = levelAt(xp);
  const teamsDone = world.teams.filter(({ complete }) => complete).length;
  const tipFor = useTip();
  return (
    <div className="v4-stats">
      <div className="v4-level" tabIndex={0} {...tipFor({ name: `Level ${climbing.level}`, colour: rarityColour.legendary, kind: "Character level", stats: [`${xp} XP`, `${climbing.toNext} XP to level ${climbing.level + 1}`], flavour: "Thank people. Open packs. Climb." })}>
        <span className="v4-level-medallion" key={climbing.level}>
          {climbing.level}
        </span>
        <div className="v4-level-bar">
          <p>
            <strong>Level {climbing.level}</strong>
            <span>
              {xp - climbing.startsAt} / {climbing.nextAt - climbing.startsAt} XP
            </span>
          </p>
          <span className="v4-xp" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(climbing.progress * 100)}>
            <span style={{ width: `${climbing.progress * 100}%` }} />
          </span>
        </div>
      </div>
      <dl className="v4-stat-rows">
        <Stat name="Coins" tip={{ name: "Coins", colour: "#8a6300", kind: "Currency", flavour: `Spend them at the vendor. A pack costs ${world.store.price}.` }}>
          <span className="v4-coin" aria-hidden="true" /> {coins}
        </Stat>
        <Stat name="Kudos charges" tip={{ name: "Kudos charges", colour: rarityColour.uncommon, kind: "Daily allowance", stats: [`${world.me.allowance.left} of ${world.me.allowance.base} left today`], flavour: "They refill every workday." }}>
          {Array.from({ length: world.me.allowance.base }, (_, index) => (
            <span key={index} className={`v4-charge ${index < world.me.allowance.left ? "v4-charge-full" : ""}`} aria-hidden="true" />
          ))}
          <span className="sr-only">
            {world.me.allowance.left} of {world.me.allowance.base}
          </span>
        </Stat>
        <Stat name="Given" tip={{ name: "Kudos given", colour: rarityColour.rare, kind: "This week · lifetime", stats: [`${world.me.thisWeek.given} this week`, `${world.me.lifetime.given} lifetime`] }}>
          {world.me.thisWeek.given} <small>/ {world.me.lifetime.given}</small>
        </Stat>
        <Stat name="Received" tip={{ name: "Kudos received", colour: rarityColour.rare, kind: "This week · lifetime", stats: [`${world.me.thisWeek.received} this week`, `${world.me.lifetime.received} lifetime`] }}>
          {world.me.thisWeek.received} <small>/ {world.me.lifetime.received}</small>
        </Stat>
        <Stat name="Hoggies" tip={{ name: "Hoggies", colour: rarityColour.epic, kind: "Collection", stats: world.rarities.map(({ rarity, owned, total }) => `${rarityLabel[rarity]}: ${owned} / ${total}`) }}>
          {world.owned} <small>/ {world.total}</small>
        </Stat>
        <Stat name="Teams done" tip={{ name: "Team pages", colour: rarityColour.epic, kind: "Collection", stats: world.teams.map(({ name, held, total }) => `${name}: ${held} / ${total}`) }}>
          {teamsDone} <small>/ {world.teams.length}</small>
        </Stat>
      </dl>
    </div>
  );
}

function Stat({ name, tip, children }: { name: string; tip: Tip; children: ReactNode }) {
  const tipFor = useTip();
  return (
    <div className="v4-stat" tabIndex={0} {...tipFor(tip)}>
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  );
}
