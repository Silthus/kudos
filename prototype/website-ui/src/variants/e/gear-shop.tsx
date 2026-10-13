// Variant E store and finds: titles, quips and kudos emoji you own, can buy with coins, or can only find as drops, with a link to equip them on the profile.
import { useState } from "react";
import { IconArrowRight, IconCheck, IconEmoji, IconQuote, IconRibbon } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { Rarity, rarityLabels } from "../../ui";
import { dropOdds, explainer, gear, gearKinds, kindName, sourceWord, type GearItem, type GearKind } from "./gear-items";
import { useGear } from "./hedgehogs";
import { CoinGlyph, Panel } from "./hud";

const kindIcon = { title: IconRibbon, quip: IconQuote, emoji: IconEmoji };

export function GearShop() {
  const [bought, setBought] = useState<string>();
  return (
    <section className="hud-rise flex flex-col gap-4" aria-labelledby="gear-shop-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="hud-label">Store and finds</div>
          <h2 id="gear-shop-title" className="hud-display mt-1 text-3xl font-bold leading-none">
            Titles, quips and emoji
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">They change how you show up, never what a kudos is worth.</p>
        </div>
        <Button variant="primary" onClick={() => (location.hash = "/profile")}>
          Equip on your profile
          <IconArrowRight />
        </Button>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        {gearKinds.map((kind) => (
          <KindPanel key={kind} kind={kind} bought={bought} onBought={setBought} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Drops: a thoughtful kudos you give can find one. {dropOdds.map((d) => `${rarityLabels[d.rarity]} ${d.chance}`).join(" · ")}.
      </p>
    </section>
  );
}

function KindPanel({ kind, bought, onBought }: { kind: GearKind; bought?: string; onBought: (id: string) => void }) {
  const Icon = kindIcon[kind];
  const items = gear.filter((g) => g.kind === kind);
  return (
    <Panel
      label={
        <>
          <Icon className="size-3" /> {kindName[kind].many}
        </>
      }
      bodyClassName="flex flex-col gap-3"
    >
      <p className="text-xs text-muted-foreground">{explainer[kind]}</p>
      <ul className="flex flex-col divide-y">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} revealed={bought === item.id} onBought={() => onBought(item.id)} />
        ))}
      </ul>
    </Panel>
  );
}

function ItemRow({ item, revealed, onBought }: { item: GearItem; revealed: boolean; onBought: () => void }) {
  const g = useGear();
  const owned = g.isOwned(item.id);
  return (
    <li className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${revealed ? "hud-pop" : ""}`}>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted ${owned ? "" : "opacity-60"}`} aria-hidden>
        <Preview item={item} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${owned ? "" : "text-muted-foreground"}`}>{item.kind === "quip" ? `“${item.name}”` : item.name}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <Rarity rarity={item.rarity} />
          {owned && <span>{sourceWord[item.source]}</span>}
        </span>
      </span>
      <Status item={item} owned={owned} equipped={g.isEquipped(item.id)} coins={g.coins} onBuy={() => (g.buy(item.id), onBought())} />
    </li>
  );
}

function Preview({ item }: { item: GearItem }) {
  if (item.kind === "emoji") return <span className="text-xl leading-none">{item.preview}</span>;
  const Icon = kindIcon[item.kind];
  return <Icon className="size-4 text-muted-foreground" />;
}

function Status({ item, owned, equipped, coins, onBuy }: { item: GearItem; owned: boolean; equipped: boolean; coins: number; onBuy: () => void }) {
  if (owned)
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        {equipped && <IconCheck className="size-3.5 text-primary" />}
        {equipped ? "Equipped" : "Owned"}
      </span>
    );
  if (item.source !== "store" || item.price === undefined) return <span className="shrink-0 text-xs text-muted-foreground">{item.source === "drop" ? "Only drops" : "Not earned yet"}</span>;
  const short = item.price - coins;
  return (
    <Button size="xs" variant={short > 0 ? "outline" : "primary"} disabled={short > 0} onClick={onBuy} title={short > 0 ? `${short.toLocaleString()} more coins to go` : undefined} className="shrink-0">
      <CoinGlyph className="size-3" />
      {item.price.toLocaleString()}
    </Button>
  );
}
