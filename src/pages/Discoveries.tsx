import clsx from "clsx";
import { useQuery } from "convex/react";
import { Lock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { MessageText } from "@/components/MessageText";
import { BigNumber, Button, PageSkeleton, Progress, RarityBadge, Segmented } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { CATEGORY_HINT, RARITY_META, RARITY_ORDER, type Rarity } from "@/lib/rarity";
import { useViewer } from "@/lib/viewer";

type Filter = "all" | "found" | "hidden";

/**
 * A picture frame in a rarity's colour: a 2 px moulding (legendary adds an ember one round it) and
 * a pixel step onto the wall. All box-shadows, so it takes no layout.
 */
function frameShadow(rarity: Rarity, { step = true } = {}) {
  const colour = RARITY_META[rarity].color;
  const moulding = rarity === "legendary" ? [`0 0 0 2px ${colour}`, "0 0 0 4px var(--color-ember)"] : [`0 0 0 2px ${colour}`, "0 0 0 3px var(--color-bark)"];
  const drop = rarity === "legendary" ? "5px 5px 0 0 var(--color-dusk-deep)" : "4px 4px 0 0 var(--color-dusk-deep)";
  return [...moulding, ...(step ? [drop] : [])].join(", ");
}

const teammates = (n: number) => `${n} ${n === 1 ? "teammate" : "teammates"}`;

/** The keys this member had seen by their last visit, or null if there's no record (or no storage). */
function readSeen(storageKey: string): Set<string> | null {
  try {
    const seen: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return Array.isArray(seen) ? new Set(seen.filter((k): k is string => typeof k === "string")) : null;
  } catch {
    return null;
  }
}

/**
 * The messages found since the last visit to the gallery, tagged for this visit only: the
 * discovered keys are kept per member in this browser. What had been seen is read once when the
 * gallery opens (again if another member signs in); with no record yet, that's everything found so
 * far, so a first visit tags nothing, and a message found while the gallery is open is new.
 */
function useNewSinceLastVisit(memberId: string, discovered: string[] | null) {
  const storageKey = `kudos.gallery.seen.${memberId}`;
  const before = useRef<{ key: string; seen: Set<string> } | null>(null);
  if (discovered && before.current?.key !== storageKey) before.current = { key: storageKey, seen: readSeen(storageKey) ?? new Set(discovered) };
  const signature = discovered?.join(",");
  useEffect(() => {
    if (!discovered) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...new Set([...(readSeen(storageKey) ?? []), ...discovered])]));
    } catch {
      // Private mode or a full store: the tag just won't show next time.
    }
  }, [storageKey, signature]);
  const seen = before.current?.seen;
  return new Set(seen && discovered ? discovered.filter((k) => !seen.has(k)) : []);
}

/**
 * The gallery (#126, #131): every bot reply in Slack is a message in this collection, hung on the
 * gallery's wall in a frame of its rarity's colour. Messages you haven't found are empty frames.
 * The rarity legend picks a rarity; tabs pick a moment and found or hidden.
 */
export function Discoveries() {
  const viewer = useViewer();
  const data = useQuery(api.discoveries.gallery);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [params] = useSearchParams();
  const [category, setCategory] = useState<string>(() => params.get("category") ?? "all"); // deep link, e.g. from a quest
  const [filter, setFilter] = useState<Filter>("all");
  const discoveredKeys = useMemo(() => (data ? data.items.filter((i) => i.discovered).map((i) => i.key) : null), [data]);
  const fresh = useNewSinceLastVisit(viewer.member?._id ?? "me", discoveredKeys);

  const items = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((i) => rarity === "all" || i.rarity === rarity)
      .filter((i) => category === "all" || i.category === category)
      .filter((i) => filter === "all" || (filter === "found" ? i.discovered : !i.discovered))
      .sort((a, b) => RARITY_ORDER.indexOf(b.rarity as Rarity) - RARITY_ORDER.indexOf(a.rarity as Rarity) || Number(b.discovered) - Number(a.discovered));
  }, [data, rarity, category, filter]);

  if (!data) return <PageSkeleton />;
  const glyph = viewer.workspace.emojiGlyph;
  const questsOn = viewer.workspace.questsEnabled;
  // Quest messages already found stay in the collection when an admin turns quests off; the rest can't be found then.
  const hint = (category: string) => (category === "quest_complete" && !questsOn ? "Weekly quests are off in this workspace" : (CATEGORY_HINT[category] ?? "Not discovered yet"));
  const filtered = rarity !== "all" || category !== "all" || filter !== "all";

  return (
    <div className="space-y-6">
      <section aria-label="Your collection" className="space-y-3">
        <p className="text-sm text-ink/75">
          Every bot reply in Slack comes from this collection, and rarer messages show up less often.{" "}
          {questsOn ? "Give and receive kudos, and complete weekly quests, to find them all." : "Give and receive kudos to find them all."}
        </p>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="flex items-baseline gap-2">
            <BigNumber value={data.discovered} className="text-[40px] leading-none" />
            <span className="text-ink/75">of {data.total} found</span>
          </p>
          <p className="text-xs text-ink/70 @sm:ml-auto">
            {teammates(data.collectors)} {data.collectors === 1 ? "is" : "are"} collecting in {viewer.workspace.name}.
          </p>
        </div>
        <Progress value={data.discovered} max={data.total} color="var(--color-r-epic)" height={8} />
      </section>

      <div data-legend role="group" aria-label="Show one rarity" className="flex flex-wrap gap-3 px-1">
        {data.byRarity.map((r) => {
          const id = r.rarity as Rarity;
          const on = rarity === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setRarity(on ? "all" : id)}
              className={clsx("flex items-center gap-2 px-2 py-1.5 text-left text-sm", on ? "bg-bark text-cream" : "bg-parchment-deep text-ink hover:bg-parchment")}
            >
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 bg-parchment"
                style={{
                  boxShadow: frameShadow(id, { step: false }),
                }}
              />
              <span className={clsx("font-semibold", id === "legendary" && !on && "legendary-text")}>{RARITY_META[id].label}</span>
              <span className="text-xs tabular opacity-80">
                {r.discovered} of {r.total}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          wrap
          label="Moment"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All moments" },
            ...data.categories.map((c) => ({
              value: c.id,
              label: (
                <>
                  {c.label} <span className="font-normal tabular opacity-75">{`${c.discovered} of ${c.total}`}</span>
                </>
              ),
            })),
          ]}
        />
        <Segmented
          size="sm"
          label="Found or hidden"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "found", label: "Found" },
            { value: "hidden", label: "Still hidden" },
          ]}
        />
        {filtered && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRarity("all");
              setCategory("all");
              setFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="ml-auto text-sm text-ink/75 tabular">{items.length === 1 ? "1 message" : `${items.length} messages`}</span>
      </div>

      <ul className="grid grid-cols-1 gap-5 p-1 @md:grid-cols-2">
        {items.map((i) => {
          const r = i.rarity as Rarity;
          const isNew = fresh.has(i.key);
          return (
            <li
              key={i.key}
              data-frame={i.key}
              data-rarity={r}
              className={clsx("relative flex min-h-40 flex-col p-4", i.discovered ? "bg-parchment" : "bg-parchment-deep")}
              style={{ boxShadow: frameShadow(r) }}
            >
              {!i.discovered && <span className="sr-only">{`Undiscovered ${RARITY_META[r].label.toLowerCase()} message.`}</span>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RarityBadge rarity={r} size="xs" />
                <span className="text-xs text-ink/70">{i.categoryLabel}</span>
              </div>
              {i.discovered && i.text ? (
                <p data-user-text className="mt-3 flex-1 text-[15px] leading-relaxed">
                  “<MessageText text={i.text} emoji={glyph} />”
                </p>
              ) : (
                <p className="mt-3 flex flex-1 items-center gap-1.5 text-xs text-ink/75">
                  <Lock className="h-3 w-3 shrink-0" aria-hidden /> {hint(i.category)}
                </p>
              )}
              <div className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-bark/30 pt-2 text-xs text-ink/70 tabular">
                {i.discovered && i.lastSeenAt ? (
                  <span>
                    Seen {i.timesSeen === 1 ? "once" : `${i.timesSeen} times`}, last {relativeTime(i.lastSeenAt)}
                  </span>
                ) : null}
                <span className="ml-auto">{i.foundBy === 0 ? "Nobody has found this yet" : `Found by ${teammates(i.foundBy)}`}</span>
              </div>
              {isNew && (
                <span data-new className="pixel-chip absolute -top-3 right-3 bg-ember px-1.5 py-px font-display text-xs font-medium text-ink">
                  New
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
