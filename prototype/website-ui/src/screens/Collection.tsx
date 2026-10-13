// PROTOTYPE collection and loadout: owned cosmetics, a live Slack preview, drop odds and boosters.
import { useState, type ReactNode } from "react";
import { cosmetics, dropOdds, me } from "../data/mock";
import type { Cosmetic, CosmeticKind, CosmeticSource, Rarity as RarityKind } from "../data/types";
import { Arrow, Button, Hand, Hog, Panel, Pill, Rarity, rarityBorder } from "../ui";
import { SlackPreview, type ShownLoadout } from "./collection/SlackPreview";

type Loadout = { title: string; card: string; quips: string[]; emoji: string[] };

const kindLabel: Record<CosmeticKind, string> = { quip: "Quips", card: "Cards", title: "Titles", emoji: "Kudos emoji" };
const sourceLabel: Record<CosmeticSource, string> = { store: "Store", achievement: "Achievement", drop: "Drop", expression: "Expression perk" };
const notYetHint: Record<CosmeticSource, string> = {
  store: "In the store",
  achievement: "From an achievement",
  drop: "Found as a drop",
  expression: "Pick with an Expression perk",
};
const rarities: RarityKind[] = ["common", "uncommon", "rare", "epic", "legendary"];
const kinds: CosmeticKind[] = ["title", "card", "quip", "emoji"];

const byId = (id: string) => cosmetics.find((c) => c.id === id)!;
const idOf = (kind: CosmeticKind, match: (c: Cosmetic) => boolean) => cosmetics.find((c) => c.kind === kind && match(c))!.id;
const owned = (kind: CosmeticKind) => cosmetics.filter((c) => c.kind === kind && c.owned);

const startingLoadout: Loadout = {
  title: idOf("title", (c) => c.name === me.loadout.title),
  card: idOf("card", (c) => c.name === me.loadout.card),
  quips: me.loadout.quips.map((q) => idOf("quip", (c) => c.name === q)),
  emoji: me.loadout.emoji.map((e) => idOf("emoji", (c) => c.preview === e)),
};

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export function Collection(_props: { param?: string }) {
  const [loadout, setLoadout] = useState<Loadout>(startingLoadout);
  const [animate, setAnimate] = useState(false);
  const [trying, setTrying] = useState<Cosmetic | null>(null);
  const [quipTurn, setQuipTurn] = useState(0);
  const [emojiShown, setEmojiShown] = useState(0);

  const equip = (c: Cosmetic) => {
    setTrying(null);
    setLoadout((l) => {
      if (c.kind === "title") return { ...l, title: c.id };
      if (c.kind === "card") return { ...l, card: c.id };
      if (c.kind === "quip") return { ...l, quips: toggle(l.quips, c.id) };
      return { ...l, emoji: l.emoji.length === 1 && l.emoji[0] === c.id ? l.emoji : toggle(l.emoji, c.id) };
    });
  };

  const shown = shownLoadout(loadout, trying, quipTurn, emojiShown);

  return (
    <div className="space-y-6">
      <Intro />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LoadoutPanel loadout={loadout} setLoadout={setLoadout} equip={equip} animate={animate} setAnimate={setAnimate} />
        <PreviewPanel
          shown={shown}
          animate={animate}
          trying={trying}
          stopTrying={() => setTrying(null)}
          quipCount={loadout.quips.length}
          nextQuip={() => setQuipTurn((t) => t + 1)}
          emoji={loadout.emoji}
          emojiShown={emojiShown}
          setEmojiShown={setEmojiShown}
        />
      </div>
      <CollectionPanel loadout={loadout} equip={equip} tryOn={setTrying} trying={trying} />
      <div className="grid gap-6 md:grid-cols-2">
        <DropOdds />
        <Boosters />
      </div>
    </div>
  );
}

function shownLoadout(loadout: Loadout, trying: Cosmetic | null, quipTurn: number, emojiShown: number): ShownLoadout {
  const quips = loadout.quips.map(byId);
  const emoji = loadout.emoji.map(byId);
  const base: ShownLoadout = {
    title: byId(loadout.title),
    card: byId(loadout.card),
    quip: quips.length ? quips[quipTurn % quips.length] : undefined,
    emoji: emoji.length ? emoji[emojiShown % emoji.length].preview : "🦔",
  };
  if (!trying) return base;
  if (trying.kind === "title") return { ...base, title: trying };
  if (trying.kind === "card") return { ...base, card: trying };
  if (trying.kind === "quip") return { ...base, quip: trying };
  return { ...base, emoji: trying.preview };
}

function Intro() {
  const ownedCount = cosmetics.filter((c) => c.owned).length;
  return (
    <Panel bodyClass="p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Hog size={96} mood="happy" hat="glasses" className="shrink-0 self-center" />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Your <span className="marker">collection</span>
          </h1>
          <p className="text-sm text-muted">
            {ownedCount} cosmetics so far. They change how your kudos look, never what they're worth. Pick a loadout and your next kudos shows it off in Slack.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="marker">🔒 Only you can see your collection</Pill>
            <Pill tone="green">Equipping, previewing and switching off animation are free and instant</Pill>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function OptionChip({ cosmetic, on, onClick }: { cosmetic: Cosmetic; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex cursor-pointer items-center gap-2 rounded-md border-2 px-2.5 py-1.5 text-left text-sm font-semibold ${on ? `${rarityBorder[cosmetic.rarity]} bg-marker/50` : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink"}`}
    >
      <span>{cosmetic.preview}</span>
      <span className="min-w-0">
        <span className="block truncate">{cosmetic.kind === "quip" ? `“${cosmetic.name}”` : cosmetic.name}</span>
        <Rarity rarity={cosmetic.rarity} className="font-medium text-muted" />
      </span>
    </button>
  );
}

function LoadoutRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-faint">{label}</h3>
        {hint && <span className="text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function LoadoutPanel({
  loadout,
  setLoadout,
  equip,
  animate,
  setAnimate,
}: {
  loadout: Loadout;
  setLoadout: (f: (l: Loadout) => Loadout) => void;
  equip: (c: Cosmetic) => void;
  animate: boolean;
  setAnimate: (v: boolean) => void;
}) {
  const favourites = loadout.quips.map(byId);
  const spareQuips = owned("quip").filter((q) => !loadout.quips.includes(q.id));
  return (
    <Panel title="Loadout" bodyClass="p-4 sm:p-5 space-y-5">
      <LoadoutRow label="Title" hint="one">
        <div className="flex flex-wrap gap-2">
          {owned("title").map((c) => (
            <OptionChip key={c.id} cosmetic={c} on={loadout.title === c.id} onClick={() => equip(c)} />
          ))}
        </div>
      </LoadoutRow>
      <LoadoutRow label="Card" hint="one">
        <div className="flex flex-wrap gap-2">
          {owned("card").map((c) => (
            <OptionChip key={c.id} cosmetic={c} on={loadout.card === c.id} onClick={() => equip(c)} />
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm">
          <input type="checkbox" className="size-4 accent-orange" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
          Animate my card <span className="text-xs text-faint">(cards are still by default)</span>
        </label>
      </LoadoutRow>
      <LoadoutRow label="Quips" hint="none, one or a few favourites">
        {favourites.length === 0 ? (
          <p className="rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-muted">No quips. That's fine too.</p>
        ) : (
          <ol className="space-y-1.5">
            {favourites.map((q, i) => (
              <li key={q.id} className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2 py-1.5">
                <span className="w-5 text-center font-display text-sm font-black text-faint">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">“{q.name}”</span>
                  <Rarity rarity={q.rarity} className="font-medium text-muted" />
                </span>
                <IconButton label="Move up" disabled={i === 0} onClick={() => setLoadout((l) => ({ ...l, quips: move(l.quips, i, i - 1) }))}>
                  ↑
                </IconButton>
                <IconButton label="Move down" disabled={i === favourites.length - 1} onClick={() => setLoadout((l) => ({ ...l, quips: move(l.quips, i, i + 1) }))}>
                  ↓
                </IconButton>
                <IconButton label="Remove" onClick={() => equip(q)}>
                  ✕
                </IconButton>
              </li>
            ))}
          </ol>
        )}
        {favourites.length > 1 && <p className="text-xs text-muted">Your kudos take turns through these, top to bottom.</p>}
        {spareQuips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {spareQuips.map((q) => (
              <button key={q.id} onClick={() => equip(q)} className="cursor-pointer rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink">
                + “{q.name}”
              </button>
            ))}
          </div>
        )}
      </LoadoutRow>
      <LoadoutRow label="Kudos emoji" hint="every one is worth 1 kudos">
        <div className="flex flex-wrap gap-2">
          {owned("emoji").map((c) => {
            const on = loadout.emoji.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => equip(c)}
                aria-pressed={on}
                title={c.name}
                className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-md border-2 px-2.5 py-1.5 ${on ? `${rarityBorder[c.rarity]} bg-marker/50` : "border-line bg-surface-2 opacity-70 hover:opacity-100"}`}
              >
                <span className="text-2xl">{c.preview}</span>
                <Rarity rarity={c.rarity} className="text-[10px] font-medium text-muted" />
              </button>
            );
          })}
        </div>
      </LoadoutRow>
    </Panel>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded border border-line bg-surface text-sm font-bold text-muted hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function PreviewPanel({
  shown,
  animate,
  trying,
  stopTrying,
  quipCount,
  nextQuip,
  emoji,
  emojiShown,
  setEmojiShown,
}: {
  shown: ShownLoadout;
  animate: boolean;
  trying: Cosmetic | null;
  stopTrying: () => void;
  quipCount: number;
  nextQuip: () => void;
  emoji: string[];
  emojiShown: number;
  setEmojiShown: (i: number) => void;
}) {
  return (
    <Panel title="How it looks in Slack" bodyClass="p-4 sm:p-5 space-y-3">
      <div className="flex items-end gap-1">
        <Hand className="text-lg">everyone in the channel sees this</Hand>
        <Arrow className="hidden -rotate-12 sm:block" />
      </div>
      {trying && (
        <div className="flex items-center gap-2 rounded-md bg-marker px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            Previewing <b>{trying.name}</b>
            {!trying.owned && <span className="text-muted"> · not yours yet, {notYetHint[trying.source].toLowerCase()}</span>}
          </span>
          <Button small tone="plain" onClick={stopTrying}>
            Stop
          </Button>
        </div>
      )}
      <SlackPreview shown={shown} animate={animate} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {quipCount > 1 && (
          <Button small tone="plain" onClick={nextQuip}>
            ↻ Next quip
          </Button>
        )}
        {emoji.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted">Kudos with</span>
            {emoji.map((id, i) => (
              <button
                key={id}
                onClick={() => setEmojiShown(i)}
                aria-pressed={i === emojiShown % emoji.length}
                className={`cursor-pointer rounded px-1 text-lg ${i === emojiShown % emoji.length ? "bg-surface-2 ring-1 ring-line-strong" : "opacity-60"}`}
              >
                {byId(id).preview}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted">The app posts this as one reply under your kudos message, only when you have a quip picked.</p>
    </Panel>
  );
}

function CollectionPanel({ loadout, equip, tryOn, trying }: { loadout: Loadout; equip: (c: Cosmetic) => void; tryOn: (c: Cosmetic) => void; trying: Cosmetic | null }) {
  const [kind, setKind] = useState<CosmeticKind | "all">("all");
  const [rarity, setRarity] = useState<RarityKind | "all">("all");
  const [showNotYet, setShowNotYet] = useState(true);
  const list = cosmetics.filter((c) => (kind === "all" || c.kind === kind) && (rarity === "all" || c.rarity === rarity) && (showNotYet || c.owned));
  const equipped = (c: Cosmetic) => [loadout.title, loadout.card, ...loadout.quips, ...loadout.emoji].includes(c.id);

  return (
    <Panel title="Everything you own" bodyClass="p-4 sm:p-5 space-y-4">
      <div className="space-y-2">
        <FilterRow>
          <FilterChip on={kind === "all"} onClick={() => setKind("all")}>
            All kinds
          </FilterChip>
          {kinds.map((k) => (
            <FilterChip key={k} on={kind === k} onClick={() => setKind(k)}>
              {kindLabel[k]}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow>
          <FilterChip on={rarity === "all"} onClick={() => setRarity("all")}>
            Any rarity
          </FilterChip>
          {rarities.map((r) => (
            <FilterChip key={r} on={rarity === r} onClick={() => setRarity(r)}>
              <Rarity rarity={r} />
            </FilterChip>
          ))}
        </FilterRow>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-orange" checked={showNotYet} onChange={(e) => setShowNotYet(e.target.checked)} />
          Show ones you don't have yet
        </label>
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nothing here with these filters.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((c) => (
            <CosmeticCard key={c.id} cosmetic={c} equipped={equipped(c)} previewing={trying?.id === c.id} equip={() => equip(c)} tryOn={() => tryOn(c)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function FilterRow({ children }: { children: ReactNode }) {
  return <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">{children}</div>;
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${on ? "border-ink bg-ink text-bg" : "border-line bg-surface-2 text-muted hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function CosmeticCard({ cosmetic: c, equipped, previewing, equip, tryOn }: { cosmetic: Cosmetic; equipped: boolean; previewing: boolean; equip: () => void; tryOn: () => void }) {
  const kindSingular = { quip: "Quip", card: "Card", title: "Title", emoji: "Kudos emoji" }[c.kind];
  return (
    <article className={`flex flex-col rounded-lg border-2 bg-surface p-3 ${c.owned ? rarityBorder[c.rarity] : "border-dashed border-line"}`}>
      <div className={`mb-2 flex h-16 items-center justify-center rounded-md bg-surface-2 text-3xl ${c.owned ? "" : "opacity-40 grayscale"}`}>
        {c.kind === "quip" ? <span className="px-2 text-center text-sm font-semibold italic">“{c.name}”</span> : c.preview}
      </div>
      <div className={`min-w-0 flex-1 space-y-1 ${c.owned ? "" : "opacity-70"}`}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-faint">{kindSingular}</div>
        {c.kind !== "quip" && <div className="truncate font-display text-sm font-extrabold">{c.name}</div>}
        <Rarity rarity={c.rarity} />
        <div className="text-xs text-muted">{c.owned ? sourceLabel[c.source] : notYetHint[c.source]}</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {c.owned ? <OwnedActions kind={c.kind} equipped={equipped} equip={equip} /> : <NotYetActions source={c.source} previewing={previewing} tryOn={tryOn} />}
      </div>
    </article>
  );
}

function OwnedActions({ kind, equipped, equip }: { kind: CosmeticKind; equipped: boolean; equip: () => void }) {
  const single = kind === "title" || kind === "card";
  if (equipped && single) return <Pill tone="green">✓ Equipped</Pill>;
  return (
    <Button small tone={equipped ? "plain" : "yellow"} onClick={equip}>
      {equipped ? "Take off" : single ? "Equip" : "Add"}
    </Button>
  );
}

function NotYetActions({ source, previewing, tryOn }: { source: CosmeticSource; previewing: boolean; tryOn: () => void }) {
  return (
    <>
      <Pill>Not yet</Pill>
      {source === "store" && (
        <Button small tone="plain" onClick={tryOn} disabled={previewing}>
          {previewing ? "Previewing" : "Preview"}
        </Button>
      )}
    </>
  );
}

function DropOdds() {
  return (
    <Panel title="Drop odds">
      <p className="mb-3 text-sm text-muted">The long-run chance that a thoughtful kudos you give finds a cosmetic, by rarity. The chance creeps up after every miss, and you never find the same one twice.</p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {dropOdds.map((d) => (
          <li key={d.rarity} className="flex items-center justify-between px-3 py-2">
            <Rarity rarity={d.rarity} className="text-sm" />
            <span className="font-mono text-sm font-semibold tabular-nums">{d.chance}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Rarity never changes what a kudos is worth. A legendary card and a common one both say thanks the same.</p>
    </Panel>
  );
}

function Boosters() {
  const [boosters, setBoosters] = useState(me.boosters);
  const switchOn = (name: string) => setBoosters((list) => list.map((b) => (b.name === name ? { ...b, state: "running" as const } : b)));
  return (
    <Panel title="Boosters">
      <p className="mb-3 text-sm text-muted">Boosters you hold. A waiting one keeps until you switch it on, whenever suits you.</p>
      <ul className="space-y-2">
        {boosters.map((b) => (
          <li key={b.name} className="flex items-center gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5">
            <span className="text-xl">{b.name.includes("Lantern") ? "🏮" : "⚡"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{b.name}</div>
              <div className="text-xs text-muted">{b.state === "waiting" ? "Waiting to be switched on" : b.endsIn ? `Running, for about ${b.endsIn} more` : "Running"}</div>
            </div>
            {b.state === "running" ? (
              <Pill tone="green">Running</Pill>
            ) : (
              <Button small onClick={() => switchOn(b.name)}>
                Switch on
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
