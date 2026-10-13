// PROTOTYPE collection and loadout: what a member owns, what they wear, and how it shows in Slack.
import { useState, type ReactNode } from "react";
import {
  Avatar,
  AvatarFallback,
  Badge as Tag,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ThreadItem,
  ThreadItemAuthor,
  ThreadItemBody,
  ThreadItemContent,
  ThreadItemGroup,
  ThreadItemGutter,
  ThreadItemHeader,
  ThreadItemMention,
  ThreadItemTimestamp,
  ToggleGroup,
  ToggleGroupItem,
} from "@posthog/quill";
import { IconCheck, IconTriangleDown, IconTriangleUp } from "@posthog/icons";
import { cosmetics, dropOdds, me, members } from "../data/mock";
import type { Cosmetic, CosmeticKind, CosmeticSource, Me } from "../data/types";
import { HedgehogExplorer, PageHeader, Rarity } from "../ui";

type Loadout = Me["loadout"];
type KindFilter = CosmeticKind | "all";

const kindLabel: Record<CosmeticKind, string> = { title: "Title", card: "Card", quip: "Quip", emoji: "Kudos emoji" };
const sourceLabel: Record<CosmeticSource, string> = { store: "Store", achievement: "Achievement", drop: "Drop", expression: "Expression perk" };
const filters: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "title", label: "Titles" },
  { value: "card", label: "Cards" },
  { value: "quip", label: "Quips" },
  { value: "emoji", label: "Kudos emoji" },
];
const recipients = [members[0], members[1]];

const byName = (kind: CosmeticKind, name: string) => cosmetics.find((c) => c.kind === kind && c.name === name)!;
const emojiByGlyph = (glyph: string) => cosmetics.find((c) => c.kind === "emoji" && c.preview === glyph)!;
const isSingle = (kind: CosmeticKind) => kind === "title" || kind === "card";

function isEquipped(loadout: Loadout, c: Cosmetic) {
  if (c.kind === "title") return loadout.title === c.name;
  if (c.kind === "card") return loadout.card === c.name;
  if (c.kind === "quip") return loadout.quips.includes(c.name);
  return loadout.emoji.includes(c.preview);
}

const toggled = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

function equip(loadout: Loadout, c: Cosmetic): Loadout {
  if (c.kind === "title") return { ...loadout, title: c.name };
  if (c.kind === "card") return { ...loadout, card: c.name };
  if (c.kind === "quip") return { ...loadout, quips: toggled(loadout.quips, c.name) };
  return { ...loadout, emoji: toggled(loadout.emoji, c.preview) };
}

function moved(list: string[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function Collection(_props: { param?: string }) {
  const [loadout, setLoadout] = useState<Loadout>(me.loadout);
  const ownedCount = cosmetics.filter((c) => c.owned).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collection"
        hog={HedgehogExplorer}
        description={`${ownedCount} cosmetics so far. They change how your kudos look, never what they're worth. Equipping, previewing and switching off animation are free and instant.`}
      />
      <LoadoutCard loadout={loadout} moveQuip={(from, to) => setLoadout((l) => ({ ...l, quips: moved(l.quips, from, to) }))} />
      <CollectionTable loadout={loadout} onEquip={(c) => setLoadout((l) => equip(l, c))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <DropOdds />
        <Boosters />
      </div>
    </div>
  );
}

function LoadoutCard({ loadout, moveQuip }: { loadout: Loadout; moveQuip: (from: number, to: number) => void }) {
  const title = byName("title", loadout.title);
  const card = byName("card", loadout.card);
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Loadout</CardTitle>
        <CardDescription>What your next kudos wears.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <dl className="flex flex-col gap-4 text-sm">
          <LoadoutField label="Title">
            <NameWithRarity name={title.name} cosmetic={title} />
          </LoadoutField>
          <LoadoutField label="Card">
            <NameWithRarity name={`${card.preview} ${card.name}`} cosmetic={card} />
          </LoadoutField>
          <LoadoutField label="Quips" hint="They take turns, in this order.">
            {loadout.quips.length === 0 ? (
              <span className="text-muted-foreground">None. Your kudos go out without one.</span>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {loadout.quips.map((name, i) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="w-4 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">“{name}”</span>
                    <Button variant="outline" size="icon-xs" aria-label="Move up" disabled={i === 0} onClick={() => moveQuip(i, i - 1)}>
                      <IconTriangleUp />
                    </Button>
                    <Button variant="outline" size="icon-xs" aria-label="Move down" disabled={i === loadout.quips.length - 1} onClick={() => moveQuip(i, i + 1)}>
                      <IconTriangleDown />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </LoadoutField>
          <LoadoutField label="Kudos emoji" hint="Each one is worth 1 kudos.">
            <span className="flex flex-wrap gap-2 text-lg">
              {loadout.emoji.map((glyph) => (
                <span key={glyph} title={emojiByGlyph(glyph).name}>
                  {glyph}
                </span>
              ))}
            </span>
          </LoadoutField>
        </dl>
        <SlackPreview loadout={loadout} />
      </CardContent>
    </Card>
  );
}

function LoadoutField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{label}</dt>
      <dd className="flex flex-col gap-1">
        {children}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

function NameWithRarity({ name, cosmetic }: { name: string; cosmetic: Cosmetic }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-medium">{name}</span>
      <Rarity rarity={cosmetic.rarity} className="text-muted-foreground" />
    </span>
  );
}

function SlackPreview({ loadout }: { loadout: Loadout }) {
  const card = byName("card", loadout.card);
  const emoji = loadout.emoji[0] ?? "🦔";
  const quip = loadout.quips[0];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">How it shows in Slack</h3>
      <div className="rounded-md border bg-background p-3">
        <ThreadItemGroup>
          <ThreadItem>
            <ThreadItemGutter>
              <Avatar size="sm">
                <AvatarFallback>{me.initials}</AvatarFallback>
              </Avatar>
            </ThreadItemGutter>
            <ThreadItemContent>
              <ThreadItemHeader>
                <ThreadItemAuthor>{me.name}</ThreadItemAuthor>
                <ThreadItemTimestamp>10:42</ThreadItemTimestamp>
              </ThreadItemHeader>
              <ThreadItemBody>
                <Mentions /> thanks for untangling the release {emoji}
              </ThreadItemBody>
            </ThreadItemContent>
          </ThreadItem>
          <ThreadItem>
            <ThreadItemGutter>
              <Avatar size="sm">
                <AvatarFallback>HH</AvatarFallback>
              </Avatar>
            </ThreadItemGutter>
            <ThreadItemContent>
              <ThreadItemHeader>
                <ThreadItemAuthor>HedgeHug</ThreadItemAuthor>
                <Tag>App</Tag>
                <ThreadItemTimestamp>10:42</ThreadItemTimestamp>
              </ThreadItemHeader>
              <ThreadItemBody className="flex flex-col gap-1.5">
                <span className="inline-flex w-fit items-center gap-2 rounded-md border bg-muted px-2.5 py-1.5 text-xs font-medium">
                  <span className="text-base">{card.preview}</span>
                  {card.name}
                </span>
                <span>
                  {emoji} <b>{me.name} · {loadout.title}</b> → <Mentions />
                </span>
                {quip && <span className="text-muted-foreground">“{quip}”</span>}
              </ThreadItemBody>
            </ThreadItemContent>
          </ThreadItem>
        </ThreadItemGroup>
      </div>
      <p className="text-xs text-muted-foreground">The bot's reply under your kudos message. It shows your first quip; the next kudos uses the next one.</p>
    </div>
  );
}

function Mentions() {
  return (
    <>
      {recipients.map((r, i) => (
        <span key={r.id}>
          {i > 0 && " "}
          <ThreadItemMention>@{r.name}</ThreadItemMention>
        </span>
      ))}
    </>
  );
}

function CollectionTable({ loadout, onEquip }: { loadout: Loadout; onEquip: (c: Cosmetic) => void }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const shown = cosmetics.filter((c) => kind === "all" || c.kind === kind);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium">Everything you've found</h2>
        <ToggleGroup variant="outline" size="sm" value={[kind]} onValueChange={(v) => v[0] && setKind(v[0] as KindFilter)} className="flex-wrap">
          {filters.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value}>
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Card size="sm" flush>
        <Table size="sm" fullWidth>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Kind</TableHead>
              <TableHead>Rarity</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className={`flex items-center gap-2 ${c.owned ? "" : "text-muted-foreground"}`}>
                    {(c.kind === "card" || c.kind === "emoji") && <span className="text-base">{c.preview}</span>}
                    <span className="font-medium">{c.kind === "quip" ? `“${c.name}”` : c.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground sm:hidden">
                    {kindLabel[c.kind]} · {sourceLabel[c.source]}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{kindLabel[c.kind]}</TableCell>
                <TableCell>
                  <Rarity rarity={c.rarity} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{sourceLabel[c.source]}</TableCell>
                <TableCell className="text-right">
                  <EquipAction cosmetic={c} equipped={isEquipped(loadout, c)} onEquip={() => onEquip(c)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

function EquipAction({ cosmetic, equipped, onEquip }: { cosmetic: Cosmetic; equipped: boolean; onEquip: () => void }) {
  if (!cosmetic.owned) return <span className="whitespace-nowrap text-xs text-muted-foreground">Not found yet</span>;
  if (!equipped)
    return (
      <Button variant="outline" size="xs" onClick={onEquip}>
        Equip
      </Button>
    );
  const single = isSingle(cosmetic.kind);
  return (
    <Button variant="default" size="xs" onClick={single ? undefined : onEquip} disabled={single} aria-pressed={!single || undefined} title={single ? undefined : "Take off"}>
      <IconCheck />
      Equipped
    </Button>
  );
}

function DropOdds() {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Drop odds</CardTitle>
        <CardDescription>The long-run chance that a thoughtful kudos you give finds a cosmetic.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="flex flex-col divide-y text-sm">
          {dropOdds.map((d) => (
            <div key={d.rarity} className="flex items-center justify-between py-1.5">
              <dt>
                <Rarity rarity={d.rarity} />
              </dt>
              <dd className="tabular-nums">{d.chance}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">Rarity never changes what a kudos is worth. A legendary card says thanks the same as a common one.</p>
      </CardContent>
    </Card>
  );
}

function Boosters() {
  const [boosters, setBoosters] = useState(me.boosters);
  const switchOn = (name: string) => setBoosters((list) => list.map((b) => (b.name === name ? { ...b, state: "running" as const } : b)));
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Boosters</CardTitle>
        <CardDescription>A waiting booster keeps until you switch it on, whenever suits you.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {boosters.map((b) => (
            <Item key={b.name} size="sm">
              <ItemContent>
                <ItemTitle>{b.name}</ItemTitle>
                <ItemDescription>{b.state === "running" ? "Running" : "Waiting"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={b.state === "running"} disabled={b.state === "running"} onCheckedChange={(on) => on && switchOn(b.name)} aria-label={`Switch on ${b.name}`} />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
