import clsx from "clsx";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { BANNER_TEXT, CREW, type CrewPartKind } from "../../convex/lib/crewCatalogue";
import { formatCoins as coins } from "../../convex/lib/coins";
import { DAY_MS } from "../../convex/lib/time";
import { crewPartTitle } from "../../convex/lib/treeView";
import { RemoteArt } from "@/components/RemoteArt";
import { HogCoin } from "@/components/HogCoin";
import { Button, Card, Empty, PageSkeleton, Progress, Segmented, Toggle, inputCls } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { PixelArt } from "@/world/PixelArt";
import { partThumbnail } from "@/world/tree/crewParts";
import { useWorldNow } from "@/world/worldNow";

/**
 * The crew's plaque (#161, plan #152 S6): the window of the crew district, where the company shapes
 * its tree together.
 *
 * - **Open quests** (at most two): each part's progress, who proposed it, what you gave, and "Add
 *   coins" (5, 20, all, or any number), spent at once and never refunded. A funded one says when it's
 *   built; a banner waiting for an admin's approval says so, and admins approve or turn it down here.
 * - **Propose**: the catalogue, a pixel picture for each part and each of its options, the banner's
 *   saying, and "Propose". Admins, or players from level 8 unless the gatehouse says admins only.
 * - **The plaque**: every part the crew built, with the names of everyone who gave.
 */

type Open = FunctionReturnType<typeof api.crew.open>;
type Quest = Open["quests"][number];
type Part = Open["available"][number];

const errorText = (e: unknown) => (e instanceof ConvexError ? String(e.data) : "Something went wrong. Try again.");
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const HOUR_MS = DAY_MS / 24;

/** A part's small picture: its option's, where it has one; a statue shows its hoggie on the plinth (the art slot). */
function Thumb({ kind, id, option, label, className }: { kind: string; id: string; option?: string | null; label?: string; className?: string }) {
  const map = useMemo(() => partThumbnail(kind as CrewPartKind, id, option ?? undefined), [kind, id, option]);
  return (
    <span data-thumb={id} className={clsx("relative grid shrink-0 place-items-center bg-dusk", className ?? "h-14 w-14")}>
      <PixelArt map={map} label={label} className="h-full w-full" />
      {kind === "statue" && option && (
        <RemoteArt slot={`hoggie-${option}`} fit="contain" className="absolute inset-x-[18%] top-0 bottom-[42%] [filter:grayscale(1)_sepia(0.35)_brightness(1.05)]" />
      )}
    </span>
  );
}

/** "Stall style: blossom", "Banner: “Thanks make the tree grow”". */
function partLine(q: { name: string; option: string | null; text: string | null }) {
  return q.text ? `${q.name}: “${q.text}”` : q.option ? `${q.name}: ${q.option}` : q.name;
}

function AddCoins({ quest, wallet }: { quest: Quest; wallet: number | null }) {
  const contribute = useMutation(api.crew.contribute);
  const needed = quest.goal - quest.contributed;
  const [amount, setAmount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null);
  if (wallet === null) return <p className="mt-3 text-sm text-ink/75">Your Hog coin wallet opens at level 3. Then you can give to the crew.</p>;
  const all = Math.max(0, Math.min(wallet, needed));
  const n = Number(amount);
  const valid = Number.isInteger(n) && n >= 1;
  const onGive = async (coinsToGive: number) => {
    setBusy(true);
    setSaid(null);
    try {
      const r = await contribute({ questId: quest._id, coins: coinsToGive });
      setSaid({
        ok: true,
        text: r.funded ? `You gave ${coins(r.added)}, and that funded it. It will be built in ${plural(CREW.buildDays, "day", "days")}.` : `You gave ${coins(r.added)}.`,
      });
    } catch (e) {
      setSaid({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const id = `crew-coins-${quest._id}`;
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void onGive(n);
      }}
    >
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        Add coins
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="w-24">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            max={Math.max(1, all)}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={clsx(inputCls, "tabular-nums")}
            data-coins-input
          />
        </span>
        {[5, 20].map((q) => (
          <Button key={q} type="button" size="sm" aria-label={`Set ${q} coins`} disabled={busy || q > wallet} onClick={() => setAmount(String(Math.min(q, needed)))}>
            {q}
          </Button>
        ))}
        <Button type="button" size="sm" aria-label="Set all the coins it still needs, or all you have" disabled={busy || all < 1} onClick={() => setAmount(String(all))}>
          All
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !valid || all < 1}>
          Give {valid ? coins(Math.min(n, needed)) : "coins"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-ink/75">You have {coins(wallet)}. Coins you give are spent, and stay with the tree.</p>
      {said && (
        <p role={said.ok ? "status" : "alert"} className={clsx("mt-1 text-sm", said.ok ? "text-soil" : "text-ember-deep")}>
          {said.text}
        </p>
      )}
    </form>
  );
}

function QuestCard({ quest, wallet, isAdmin, now }: { quest: Quest; wallet: number | null; isAdmin: boolean; now: number }) {
  const approve = useMutation(api.crew.approveBanner);
  const withdraw = useMutation(api.crew.withdraw);
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>) => void fn().catch((e) => setError(errorText(e)));
  // Whole days to go, with an hour's grace: a read at a rounded-down `now` doesn't count a day too many.
  const daysLeft = quest.buildsAt === null ? 0 : Math.max(1, Math.ceil((quest.buildsAt - now - HOUR_MS) / DAY_MS));
  const pct = Math.round((quest.contributed / quest.goal) * 100);
  return (
    <Card className="p-4" data-crew-quest={quest.part}>
      <div className="flex items-start gap-3">
        <Thumb kind={quest.kind} id={quest.part} option={quest.option} label={quest.name} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-medium leading-6 text-ink break-words">{partLine(quest)}</h3>
          <p className="text-sm text-ink/75">
            Proposed by {quest.proposedBy}. {quest.contributors === 0 ? "Nobody has given yet." : `${plural(quest.contributors, "teammate has", "teammates have")} given.`}
          </p>
        </div>
      </div>
      <Progress value={quest.contributed} max={quest.goal} className="mt-3" height={10} label={`${quest.contributed} of ${quest.goal} Hog coins`} />
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink tabular-nums">
        <HogCoin size={14} />
        <span>
          {quest.contributed.toLocaleString("en-US")} of {coins(quest.goal)} ({pct} %)
          {quest.mine > 0 && <span className="text-ink/75">, {quest.mine.toLocaleString("en-US")} from you</span>}
        </span>
      </p>
      {quest.status === "funded" ? (
        <p className="mt-3 bg-sap/25 px-2 py-1.5 text-sm font-semibold text-ink">
          {quest.buildsAt !== null && quest.buildsAt <= now ? "Funded. The crew is building it now." : `Funded. The crew builds it in ${plural(daysLeft, "day", "days")}.`}
        </p>
      ) : quest.awaitingApproval ? (
        <div className="mt-3">
          <p className="text-sm text-ink">
            {quest.text === null ? "Its saying waits for an admin's approval: then it's on the board, and the crew can give to it." : "This banner waits for an admin to approve its saying before it takes coins."}
          </p>
          {isAdmin && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="primary" onClick={() => act(() => approve({ questId: quest._id }))}>
                Approve the saying
              </Button>
              <Button size="sm" onClick={() => act(() => withdraw({ questId: quest._id }))}>
                Turn it down
              </Button>
            </div>
          )}
        </div>
      ) : (
        <AddCoins quest={quest} wallet={wallet} />
      )}
      {quest.status === "proposed" && !quest.awaitingApproval && quest.contributed === 0 && (quest.proposedByMe || isAdmin) && (
        <button type="button" className="mt-2 text-xs font-semibold text-ink/75 underline" onClick={() => act(() => withdraw({ questId: quest._id }))}>
          Withdraw it
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </Card>
  );
}

/** The catalogue's entries: each structure and single part, and the districts' styles as one entry. */
type Entry = { key: string; kind: string; name: string; about: string; cost: number; thumb: Part; parts: Part[] };

function entries(parts: Part[]): Entry[] {
  const styles = parts.filter((p) => p.kind === "district_style");
  const one = (p: Part): Entry => ({ key: p.id, kind: p.kind, name: p.name, about: p.about, cost: p.cost, thumb: p, parts: [p] });
  const out = parts.filter((p) => p.kind !== "district_style").map(one);
  if (styles.length > 0) {
    const cheapest = Math.min(...styles.map((p) => p.cost));
    out.push({ key: "district_style", kind: "district_style", name: "A district's style", about: "Dress one district: mossy, lantern, blossom or crystal.", cost: cheapest, thumb: styles[0], parts: styles });
  }
  return out;
}

function ProposeForm({ entry, onDone }: { entry: Entry; onDone: (said: string) => void }) {
  const propose = useMutation(api.crew.propose);
  const [partId, setPartId] = useState<string>(entry.parts[0].id);
  const part = entry.parts.find((p) => p.id === partId) ?? entry.parts[0];
  const [option, setOption] = useState<string | null>(part.options[0] ?? null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = crewPartTitle(part.id);
  const onPropose = async () => {
    setBusy(true);
    setError(null);
    try {
      await propose({ partId: part.id, ...(option ? { option } : {}), ...(part.kind === "banner" ? { text } : {}) });
      onDone(`You proposed ${title}. It's up with the open quests.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-2 border-dusk-deep bg-parchment p-3" data-propose-form>
      {entry.parts.length > 1 && (
        <label className="block">
          <span className="text-sm font-semibold text-ink">Which district</span>
          <select value={partId} onChange={(e) => setPartId(e.target.value)} className={clsx(inputCls, "mt-1")} data-style-district>
            {entry.parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name.replace(/ style$/, "")} ({coins(p.cost)})
              </option>
            ))}
          </select>
        </label>
      )}
      {part.options.length > 0 && (
        <fieldset className="mt-2">
          <legend className="text-sm font-semibold text-ink">Choose its look</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {part.options.map((o) => (
              <button
                key={o}
                type="button"
                data-option={o}
                aria-pressed={option === o}
                onClick={() => setOption(o)}
                className={clsx("flex flex-col items-center gap-1 border-2 p-1 text-xs text-ink", option === o ? "border-dusk-deep bg-lantern/35" : "border-parchment-deep bg-parchment hover:border-bark")}
              >
                <Thumb kind={part.kind} id={part.id} option={o} className="h-12 w-12" />
                {o}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {part.kind === "banner" && (
        <label className="block">
          <span className="text-sm font-semibold text-ink">The banner's saying</span>
          <input value={text} maxLength={BANNER_TEXT.max} onChange={(e) => setText(e.target.value)} placeholder="Thanks make the tree grow" className={clsx(inputCls, "mt-1")} data-banner-text />
          <span className="mt-0.5 block text-xs text-ink/75">One line, up to {BANNER_TEXT.max} characters. It hangs across the trunk for everyone to read.</span>
        </label>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-sm text-ink tabular-nums first:mt-0">
        <HogCoin size={14} />
        Goal: {coins(part.cost)}, pooled by the crew
      </p>
      <Button variant="primary" size="sm" className="mt-2" disabled={busy || (part.kind === "banner" && text.trim() === "")} onClick={() => void onPropose()}>
        Propose it
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </div>
  );
}

function Propose({ parts, canPropose }: { parts: Part[]; canPropose: Open["canPropose"] }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const list = entries(parts);
  return (
    <Card className="p-4" data-crew-catalogue>
      <h2 className="font-display text-lg font-medium text-ink">Propose a part of the tree</h2>
      <p className="mt-1 text-sm text-ink/75">
        {canPropose.ok ? "Pick a part and the crew pools coins on it. It's built three days after it's funded, and stays." : canPropose.why}
      </p>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink/75">The crew has built everything this tree can take. More opens as the tree grows.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-2">
          {list.map((e) => (
            <Fragment key={e.key}>
              <li>
                <button
                  type="button"
                  data-part={e.key}
                  aria-expanded={picked === e.key}
                  disabled={!canPropose.ok}
                  onClick={() => {
                    setPicked(picked === e.key ? null : e.key);
                    setSaid(null);
                  }}
                  className={clsx(
                    "flex h-full w-full items-start gap-2 border-2 p-2 text-left disabled:cursor-default",
                    picked === e.key ? "border-dusk-deep bg-lantern/35" : "border-parchment-deep bg-parchment enabled:hover:border-bark",
                  )}
                >
                  <Thumb kind={e.kind} id={e.thumb.id} option={e.thumb.options[0]} className="h-12 w-12" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{e.name}</span>
                    <span className="flex items-center gap-1 text-xs text-ink tabular-nums">
                      <HogCoin size={12} />
                      {e.parts.length > 1 ? `from ${e.cost.toLocaleString("en-US")}` : e.cost.toLocaleString("en-US")}
                    </span>
                    <span className="block text-xs text-ink/75">{e.about}</span>
                  </span>
                </button>
              </li>
              {picked === e.key && canPropose.ok && (
                <li className="@md:col-span-2">
                  <ProposeForm
                    entry={e}
                    onDone={(text) => {
                      setPicked(null);
                      setSaid(text);
                    }}
                  />
                </li>
              )}
            </Fragment>
          ))}
        </ul>
      )}
      {said && (
        <p role="status" className="mt-2 text-sm text-soil">
          {said}
        </p>
      )}
    </Card>
  );
}

/** Built parts a plaque page shows; "Show more" brings the next (the server holds a page to 5). */
const PLAQUE_PAGE = 5;

function Plaque() {
  const { results: built, status, loadMore } = usePaginatedQuery(api.crew.built, {}, { initialNumItems: PLAQUE_PAGE });
  return (
    <Card className="p-4" data-plaque>
      <h2 className="font-display text-lg font-medium text-ink">The plaque</h2>
      {status === "LoadingFirstPage" ? null : built.length === 0 ? (
        <p className="mt-1 text-sm text-ink/75">Nothing built yet. The first part the crew funds gets the first line.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {built.map((b) => (
            <li key={b._id} data-plaque-line={b.part} className="border-l-4 border-bark bg-parchment-deep/40 px-3 py-2">
              <p className="font-display text-base font-medium text-ink break-words">{partLine(b)}</p>
              <p className="text-xs text-ink/75">
                Built {relativeTime(b.builtAt)} with {coins(b.contributed)}. Proposed by {b.proposedBy}.
              </p>
              <p className="mt-1 text-sm text-ink break-words">{b.contributors.join(", ")}</p>
            </li>
          ))}
        </ul>
      )}
      {status === "CanLoadMore" && (
        <Button size="sm" className="mt-3" onClick={() => loadMore(PLAQUE_PAGE)}>
          Show more of the plaque
        </Button>
      )}
    </Card>
  );
}

/**
 * The crew's open quests pinned to the notice board (#161): each one's progress, and a link to the
 * plaque to give. Nothing while none is open or the game isn't shown.
 */
export function CrewNotice() {
  const open = useQuery(api.crew.open, {});
  if (!open?.enabled || open.quests.length === 0) return null;
  return (
    <section aria-labelledby="crew-notice" data-crew-notice className="pixel-chip bg-parchment-deep/40 p-3">
      <h2 id="crew-notice" className="font-display text-base font-medium text-ink">
        The crew is building
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {open.quests.map((q) => (
          <li key={q._id} className="flex items-center gap-2">
            <Thumb kind={q.kind} id={q.part} option={q.option} className="h-9 w-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{partLine(q)}</p>
              <Progress value={q.contributed} max={q.goal} height={6} label={`${q.contributed} of ${q.goal} Hog coins`} />
              <p className="text-xs text-ink/75 tabular-nums">{q.status === "funded" ? "Funded, being built" : `${q.contributed.toLocaleString("en-US")} of ${coins(q.goal)}`}</p>
            </div>
          </li>
        ))}
      </ul>
      <Link to="/crew" className="mt-2 inline-block text-sm font-semibold text-ember-deep underline decoration-2 underline-offset-4">
        Give at the crew's plaque
      </Link>
    </section>
  );
}

/**
 * The gatehouse's crew settings (#161): who may propose crew quests, and whether a banner's saying
 * waits for an admin's approval. Each change saves at once; read-only in the shared demo.
 */
export function CrewSettings({ isDemo }: { isDemo: boolean }) {
  const open = useQuery(api.crew.open, {});
  const update = useMutation(api.crew.updateSettings);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;
  const { proposers, bannerModeration } = open.settings;
  const save = (next: { proposers: "admins" | "level"; bannerModeration: boolean }) => {
    setError(null);
    void update(next).catch((e) => setError(errorText(e)));
  };
  return (
    <Card className="p-5" data-crew-settings>
      <h2 className="font-display text-lg font-medium text-ink">Crew quests</h2>
      <p className="mt-1 text-sm text-ink/75">The whole company pools Hog coins on parts of the tree, once it's a great tree.</p>
      <p className="mt-3 text-sm font-semibold text-ink">Who proposes crew quests</p>
      <div className="mt-1">
        <Segmented
          value={proposers}
          onChange={(v) => save({ proposers: v, bannerModeration })}
          options={[
            {
              value: "level",
              label: `Admins and level ${CREW.proposeLevel}+`,
              disabled: isDemo,
            },
            { value: "admins", label: "Admins only", disabled: isDemo },
          ]}
        />
      </div>
      <div className="mt-3">
        <Toggle
          checked={bannerModeration}
          onChange={(v) => save({ proposers, bannerModeration: v })}
          disabled={isDemo}
          label="Approve banner sayings"
          description="A banner someone proposes waits for an admin's approval of its saying before the crew can give to it."
        />
      </div>
      {isDemo && <p className="mt-2 text-xs text-ink/75">Read-only in the shared demo: in your own workspace these are live.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </Card>
  );
}

export function Crew() {
  const open = useQuery(api.crew.open, {});
  const now = useWorldNow(true);
  if (open === undefined) return <PageSkeleton />;
  if (!open.enabled) {
    return <Empty title="The crew's plaque">Crew quests begin when the tree is a great tree, while the game is on. Then the whole company pools coins to shape it.</Empty>;
  }
  return (
    <div className="space-y-4">
      <section aria-labelledby="crew-open" className="space-y-3">
        <h2 id="crew-open" className="font-display text-lg font-medium text-ink">
          Open crew quests
        </h2>
        {open.quests.length === 0 ? (
          <p className="text-sm text-ink/75">No quest is open. Propose one below, and the crew pools coins on it.</p>
        ) : (
          open.quests.map((q) => <QuestCard key={q._id} quest={q} wallet={open.wallet} isAdmin={open.isAdmin} now={now} />)
        )}
      </section>
      <Propose parts={open.available} canPropose={open.canPropose} />
      <Plaque />
    </div>
  );
}
