import clsx from "clsx";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { MessageText } from "@/components/MessageText";
import { BigNumber, Card, Eyebrow, PageHeader, PageSkeleton, Progress, RarityBadge, Segmented } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { RARITY_META, RARITY_ORDER, type Rarity } from "@/lib/rarity";
import { useViewer } from "@/lib/viewer";

type Filter = "all" | "found" | "hidden";

export function Discoveries() {
  const viewer = useViewer();
  const data = useQuery(api.discoveries.gallery);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [category, setCategory] = useState<string>("all");
  const [filter, setFilter] = useState<Filter>("all");

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

  return (
    <div>
      <PageHeader
        eyebrow="Message gallery"
        title="Discoveries"
        subtitle="Every bot reply in Slack is drawn from this collection, with rarer messages showing up less often. Give and receive kudos to uncover them all."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
        <Card className="grain h-fit overflow-hidden bg-gradient-to-br from-r-epic/[0.14] via-panel to-panel p-5">
          <Eyebrow>Collection</Eyebrow>
          <div className="mt-2 flex items-baseline gap-2">
            <BigNumber value={data.discovered} className="text-6xl" />
            <span className="text-muted">/ {data.total}</span>
          </div>
          <Progress value={data.discovered} max={data.total} color="linear-gradient(90deg, var(--color-r-rare), var(--color-r-epic), var(--color-r-legendary))" className="mt-3" height={8} />
          <ul className="mt-6 space-y-3">
            {data.byRarity.map((r) => (
              <li key={r.rarity}>
                <button onClick={() => setRarity(rarity === r.rarity ? "all" : (r.rarity as Rarity))} className={clsx("w-full rounded-lg p-1 text-left transition", rarity === r.rarity && "bg-panel-3/60")}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <RarityBadge rarity={r.rarity as Rarity} size="xs" />
                    <span className="font-mono text-xs text-muted tabular">
                      {r.discovered}/{r.total}
                    </span>
                  </div>
                  <Progress value={r.discovered} max={r.total} color={RARITY_META[r.rarity as Rarity].color} height={4} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-line pt-4">
            <Eyebrow className="mb-2">By moment</Eyebrow>
            <ul className="space-y-1.5 text-sm">
              {data.categories.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setCategory(category === c.id ? "all" : c.id)} className={clsx("flex w-full items-center justify-between rounded-lg px-2 py-1 transition", category === c.id ? "bg-panel-3 text-cream" : "text-muted hover:text-cream")}>
                    <span>{c.label}</span>
                    <span className="font-mono text-xs tabular">
                      {c.discovered}/{c.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-5 text-xs text-faint">{data.collectors} teammates are collecting in {viewer.workspace.name}.</p>
        </Card>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "found", label: "Found" },
                { value: "hidden", label: "Still hidden" },
              ]}
            />
            {(rarity !== "all" || category !== "all") && (
              <button onClick={() => { setRarity("all"); setCategory("all"); }} className="rounded-lg px-3 py-1.5 text-sm text-saffron hover:bg-panel-2">
                Clear filters
              </button>
            )}
            <span className="ml-auto text-sm text-faint">{items.length} messages</span>
          </div>
          <motion.div layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {items.map((i) => {
                const meta = RARITY_META[i.rarity as Rarity];
                return (
                  <motion.article
                    layout
                    key={i.key}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className={clsx(
                      "relative flex min-h-44 flex-col rounded-2xl p-4 ring-1 ring-inset",
                      i.discovered ? ["bg-panel", meta.ring, meta.glow] : "bg-panel/40 ring-line",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <RarityBadge rarity={i.rarity as Rarity} size="xs" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{i.categoryLabel}</span>
                    </div>
                    {i.discovered && i.text ? (
                      <p className="mt-3 flex-1 text-[15px] leading-relaxed">
                        “<MessageText text={i.text} emoji={glyph} />”
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-1 flex-col justify-center gap-2" aria-label="Undiscovered message">
                        {Array.from({ length: Math.max(1, Math.round(i.length / 48)) }).map((_, n, arr) => (
                          <div key={n} className="h-3 rounded-full bg-panel-3" style={{ width: n === arr.length - 1 ? "55%" : "100%" }} />
                        ))}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                          <Lock className="h-3 w-3" /> Not discovered yet
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 font-mono text-[10px] text-faint">
                      {i.discovered ? <span>Seen {i.timesSeen}× · {relativeTime(i.lastSeenAt!)}</span> : <span>&nbsp;</span>}
                      <span title="Teammates who found this message">
                        {i.foundBy === 0 ? "Nobody has found this" : `Found by ${i.foundBy}`}
                      </span>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
