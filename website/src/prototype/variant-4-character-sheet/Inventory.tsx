// PROTOTYPE (#625): the inventory grid: a fixed 10×6 bag with tabs for hoggies, team stickers, packs and medals. Never merge to main.
import type { CSSProperties, ReactNode } from "react";
import { AppLink, useNavigate } from "../../AppLink";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import { rarityColour, type World } from "../world";
import { metalOf, packLook, rarityLabel } from "./sheet";
import { tomeHrefOfHoggie } from "./tomeSpreads";
import { useTip, type Tip } from "./Tooltip";

export type BagTab = "bag" | "stickers" | "packs" | "medals";

const tabs: { tab: BagTab; label: string }[] = [
  { tab: "bag", label: "Hoggies" },
  { tab: "stickers", label: "Team stickers" },
  { tab: "packs", label: "Packs" },
  { tab: "medals", label: "Medals" },
];

const columns = 10;
const rows = 6;
const capacity = columns * rows;

type Item = { key: string; size: [number, number]; glow: string; tip: Tip; art: ReactNode; corner?: ReactNode; mark?: "new" | "glint" | "dropping"; dim?: boolean; onActivate?: () => void };

export type BagMarks = { newSlugs: ReadonlySet<string>; glint: string | null; settledPacks: ReadonlySet<string>; onPackSettled: (id: string) => void };

type InventoryProps = { world: World; tab: BagTab; onTab: (tab: BagTab) => void; onOpenPack: (id: string) => void; marks: BagMarks };

export function Inventory({ world, tab, onTab, onOpenPack, marks }: InventoryProps) {
  const navigate = useNavigate();
  const items = itemsOf(tab, world, { onOpenPack, navigate, marks });
  const used = items.reduce((sum, { size: [width, height] }) => sum + width * height, 0);
  const shown = used > capacity ? fitting(items) : items;
  const overflow = items.length - shown.length;
  const free = Math.max(0, capacity - shown.reduce((sum, { size: [width, height] }) => sum + width * height, 0) - (overflow > 0 ? 1 : 0));
  return (
    <section className="v4-panel v4-inventory" aria-label="Inventory">
      <header className="v4-plate">
        <span>Inventory</span>
        <small>
          {Math.min(used, capacity)} / {capacity} cells
        </small>
      </header>
      <div className="v4-tabs" role="tablist">
        {tabs.map(({ tab: each, label }) => (
          <button key={each} type="button" role="tab" aria-selected={each === tab} className="v4-tab" onClick={() => onTab(each)}>
            {label}
            {each === "packs" && world.packs.length > 0 && <span className="v4-tab-count">{world.packs.length}</span>}
          </button>
        ))}
      </div>
      <div className="v4-grid" style={{ "--columns": columns, "--rows": rows } as CSSProperties}>
        {shown.map((item) => (
          <Cell key={item.key} item={item} onSettled={item.mark === "dropping" ? () => marks.onPackSettled(item.key) : undefined} />
        ))}
        {overflow > 0 && (
          <AppLink href="/book" className="v4-cell v4-cell-more">
            +{overflow}
          </AppLink>
        )}
        {Array.from({ length: free }, (_, index) => (
          <span key={`free-${index}`} className="v4-cell" aria-hidden="true" />
        ))}
      </div>
      <p className="v4-inventory-help">Hover or focus an item to inspect it. Double-click, right-click or press Enter to use it.</p>
    </section>
  );
}

function fitting(items: Item[]) {
  const kept: Item[] = [];
  let used = 1;
  for (const item of items) {
    const area = item.size[0] * item.size[1];
    if (used + area > capacity) break;
    kept.push(item);
    used += area;
  }
  return kept;
}

function Cell({ item, onSettled }: { item: Item; onSettled?: () => void }) {
  const tipFor = useTip();
  const [width, height] = item.size;
  const use = () => item.onActivate?.();
  return (
    <button
      type="button"
      className={`v4-cell v4-item ${item.dim === true ? "v4-item-dim" : ""} ${item.mark === "dropping" ? "v4-item-dropping" : ""} ${item.mark === "glint" ? "v4-item-glint" : ""}`}
      style={{ gridColumn: `span ${width}`, gridRow: `span ${height}`, "--glow": item.glow } as CSSProperties}
      aria-label={`${item.tip.name}, ${item.tip.kind}`}
      onDoubleClick={use}
      onContextMenu={(event) => {
        if (item.onActivate === undefined) return;
        event.preventDefault();
        use();
      }}
      onKeyDown={(event) => event.key === "Enter" && use()}
      onAnimationEnd={onSettled}
      {...tipFor(item.tip)}
    >
      {item.art}
      {item.corner !== undefined && <span className="v4-item-corner">{item.corner}</span>}
      {item.mark === "new" && <span className="v4-item-new">NEW</span>}
    </button>
  );
}

type Wiring = { onOpenPack: (id: string) => void; navigate: (href: string) => void; marks: BagMarks };

function itemsOf(tab: BagTab, world: World, wiring: Wiring): Item[] {
  if (tab === "stickers") return stickerItemsOf(world);
  if (tab === "packs") return packItemsOf(world, wiring);
  if (tab === "medals") return medalItemsOf(world, wiring);
  return [...hoggieItemsOf(world, wiring), ...packItemsOf(world, wiring)];
}

function hoggieItemsOf(world: World, { navigate, marks }: Wiring): Item[] {
  return world.hoggies
    .filter(({ count }) => count > 0)
    .toSorted((first, second) => (first.firstAt ?? 0) - (second.firstAt ?? 0))
    .map((hoggie): Item => ({
      key: `hoggie:${hoggie.hoggie}`,
      size: [1, 1],
      glow: rarityColour[hoggie.rarity],
      art: <HoggieArt slug={hoggie.hoggie} size={44} />,
      corner: hoggie.count > 1 ? `×${hoggie.count}` : undefined,
      mark: marks.newSlugs.has(hoggie.hoggie) ? "new" : marks.glint === hoggie.hoggie ? "glint" : undefined,
      tip: { name: hoggie.name, colour: rarityColour[hoggie.rarity], kind: `${rarityLabel[hoggie.rarity]} hoggie`, stats: [`Held ×${hoggie.count}`, hoggie.firstAt === null ? "Just found" : `First found ${new Date(hoggie.firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`], flavour: "Double-click to find its page in the Tome." },
      onActivate: () => navigate(tomeHrefOfHoggie(world, hoggie.hoggie)),
    }));
}

function packItemsOf(world: World, { onOpenPack, marks }: Wiring): Item[] {
  return world.packs.map((pack): Item => {
    const look = packLook[pack.kind];
    return {
      key: pack.id,
      size: [1, 2],
      glow: rarityColour[look.rarity],
      art: <span className="v4-pack" style={{ "--pack": look.colour } as CSSProperties} />,
      mark: marks.settledPacks.has(pack.id) ? undefined : "dropping",
      tip: { name: look.name, colour: rarityColour[look.rarity], kind: "Pack · Unopened", stats: [`From: ${pack.from}`, "Holds one hoggie, XP and coins"], flavour: look.flavour, action: { label: "Open pack", run: () => onOpenPack(pack.id) } },
      onActivate: () => onOpenPack(pack.id),
    };
  });
}

function stickerItemsOf(world: World): Item[] {
  const crests: Item[] = world.teams
    .filter(({ crest, complete }) => crest !== null || complete)
    .map((team): Item => ({
      key: `crest:${team.team}`,
      size: [2, 2],
      glow: rarityColour.legendary,
      art: <CrestArt art={team.art} size={92} name={team.name} />,
      tip: { name: `${team.name} Crest`, colour: rarityColour.legendary, kind: "Team crest", stats: [`${team.held} / ${team.total} teammates`], flavour: "Collected by thanking the whole team." },
    }));
  const stickers: Item[] = world.stickers.map((sticker): Item => ({
    key: `sticker:${sticker.key}`,
    size: [1, 1],
    glow: rarityColour.uncommon,
    art: <MemberFace face={sticker.face} className="v4-face" />,
    tip: { name: sticker.name, colour: rarityColour.uncommon, kind: "Team sticker", stats: [`First thanked ${new Date(sticker.firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`], flavour: "One sticker for every teammate you thank." },
  }));
  return [...crests, ...stickers];
}

function medalItemsOf(world: World, { navigate }: Wiring): Item[] {
  return world.achievements.flatMap((ladder) =>
    ladder.tiers.map((tier): Item => {
      const metal = metalOf[tier.tier];
      const earned = tier.earnedAt !== null;
      return {
        key: `medal:${ladder.ladder}:${tier.tier}`,
        size: [1, 1],
        glow: earned ? rarityColour[metal.rarity] : rarityColour.common,
        dim: !earned,
        art: (
          <span className="v4-medal" style={{ "--metal": earned ? metal.colour : "#a3a39a" } as CSSProperties}>
            {ladder.name.slice(0, 1)}
          </span>
        ),
        tip: { name: tier.name, colour: earned ? rarityColour[metal.rarity] : rarityColour.common, kind: `${ladder.name} · ${tier.tier} medal`, stats: [earned ? `Earned ${new Date(tier.earnedAt ?? 0).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : `Needs ${tier.at} ${ladder.counts}`, `You have ${ladder.count}`] },
        onActivate: () => navigate("/book/earned"),
      };
    }),
  );
}

