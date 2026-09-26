import { useMutation, useQuery } from "convex/react";
import clsx from "clsx";
import { motion, useReducedMotionConfig } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { canStartExpedition, type CreatureId } from "../../convex/lib/rpg";
import type { RuinTier } from "../../convex/lib/tree";
import { ResultsLedger, StaminaPips } from "@/components/rpg";
import { errorText } from "@/lib/errors";
import { Button, PageSkeleton, Progress } from "@/components/ui";
import { HogFrame } from "@/world/Hog";
import { PixelArt } from "@/world/PixelArt";
import type { PixelMap } from "@/world/pixels";
import { RUIN_ART, ruinIdOf, ruinPath } from "@/world/places/ruins";
import { CREATURE_ART } from "@/world/rpg/bestiary";
import { ROOM_ICONS, SCENE, sceneFor } from "@/world/rpg/scenes";

/**
 * A ruin's window (#162, plan #152 S7; `api.rpg.*`). At the entrance: the ruin, your stamina and
 * the way in. Inside: the room strip, the room as a pixel scene (the foe standing in it, a puzzle's
 * tablet, a secret's glinting chest, a rest's fire), everyone's hit points and the foe's, the
 * choices with the stat each uses, the room's log, and the way back to camp. At the end, the
 * results ledger. The server resolves every turn; this window only asks and shows.
 */

type Current = NonNullable<ReturnType<typeof useCurrent>>;
type Run = NonNullable<Current["run"]>;
/** A room the party has reached: its kind is known. */
type RoomKind = Exclude<Run["rooms"][number]["kind"], "unknown">;
const useCurrent = () => useQuery(api.rpg.current);

const TIER_NAME: Record<number, string> = { 1: "near", 2: "far", 3: "deep" };

/** The rooms of the run: those behind you and the one you're in by what they held; the ones ahead unknown. */
function RoomStrip({ run }: { run: Run }) {
  const words = { foe: "a foe", puzzle: "a puzzle", secret: "a secret room", rest: "a rest", unknown: "not reached yet" } as const;
  return (
    <ol data-room-strip aria-label="Rooms" className="flex flex-wrap gap-1.5">
      {run.rooms.map((r, i) => {
        const known = r.kind !== "unknown";
        const here = run.open && i === run.room;
        return (
          <li
            key={i}
            data-room={i}
            aria-current={here ? "step" : undefined}
            aria-label={`Room ${i + 1}: ${words[r.kind]}`}
            className={clsx(
              "grid h-8 w-8 place-items-center border-2 border-bark text-xs font-bold",
              here ? "bg-lantern text-ink" : known ? "bg-parchment-deep text-ink" : "bg-dusk text-cream/70",
            )}
          >
            {known && r.kind === "foe" && r.foe ? (
              <PixelArt map={CREATURE_ART[r.foe as CreatureId]} width={22} height={20} />
            ) : (
              <PixelArt map={ROOM_ICONS[r.kind === "foe" ? "unknown" : r.kind]} width={18} height={18} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** The room as a picture: its backdrop, you on the left, and what waits on the right. */
function Scene({ run }: { run: Run }) {
  const still = useReducedMotionConfig();
  const kind = run.rooms[run.room].kind as RoomKind;
  const backdrop = useMemo(() => sceneFor(kind, run.tier), [kind, run.tier]);
  const floor = `${((SCENE.height - SCENE.floor - 1) / SCENE.height) * 100}%`;
  return (
    <div data-scene={kind} className="relative w-full overflow-hidden border-2 border-bark bg-dusk" style={{ aspectRatio: `${SCENE.width} / ${SCENE.height}` }}>
      <PixelArt map={backdrop} className="absolute inset-0 h-full w-full" />
      <div className="absolute left-[6%] w-[22%]" style={{ bottom: floor }}>
        {/* Sized with the scene: the frame is square, so its width sets its height. */}
        <HogFrame className="!h-auto !w-full" />
      </div>
      {run.foe && (
        <motion.div
          // A new key each hit: the foe flinches once when its hit points drop.
          key={`${run.room}:${run.foe.hp}`}
          data-creature-art={run.foe.id}
          className="absolute right-[10%] w-[27%]"
          style={{ bottom: floor }}
          initial={still || run.foe.hp === run.foe.maxHp ? false : { x: 6 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <PixelArt map={CREATURE_ART[run.foe.id as CreatureId]} className="h-auto w-full" label={run.foe.name} />
        </motion.div>
      )}
      {kind === "secret" && !still && (
        <motion.span
          aria-hidden
          data-glint
          className="absolute block h-2 w-2 bg-cream"
          style={{ left: "54.5%", top: "48%" }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0.6], scale: [0.5, 1.6, 1] }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

function Meter({ name, hp, max, colour }: { name: string; hp: number; max: number; colour: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm text-ink">
        <span className="font-semibold">{name}</span>
        <span className="tabular text-ink/75">
          {hp} of {max}
        </span>
      </div>
      <Progress value={hp} max={max} color={colour} label={`${name}: ${hp} of ${max}`} height={10} />
    </div>
  );
}

/** A choice as a pixel button: the action, and under it the stat it uses. */
function Choice({ label, stat, onClick, disabled }: { label: string; stat: string; onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="primary" size="lg" className="h-auto flex-col gap-0 py-1.5" onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      <span className="text-xs font-medium tabular">{stat}</span>
    </Button>
  );
}

function Room({ run, send, busy }: { run: Run; send: (choice: Parameters<ReturnType<typeof useMutation<typeof api.rpg.act>>>[0]["choice"]) => void; busy: boolean }) {
  const kind = run.rooms[run.room].kind;
  const me = run.party[0];
  return (
    <div className="space-y-4">
      <Scene run={run} />
      <div className="flex flex-wrap gap-4">
        {run.party.map((p) => (
          <Meter key={p.memberId} name={p.name} hp={p.hp} max={p.maxHp} colour="var(--color-sap)" />
        ))}
        {run.foe && <Meter name={run.foe.name} hp={run.foe.hp} max={run.foe.maxHp} colour="var(--color-blight)" />}
      </div>
      {run.foe && (
        <p className="text-sm text-ink/75">
          {run.foe.about} Weak to {run.foe.weakness}.
        </p>
      )}
      {kind === "foe" && me && (
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-4">
          <Choice label="Strike" stat={`might ${me.stats.might}`} onClick={() => send({ kind: "strike" })} disabled={busy} />
          <Choice label="Outwit" stat={`wits ${me.stats.wits}`} onClick={() => send({ kind: "outwit" })} disabled={busy} />
          <Choice label="Calm" stat={`heart ${me.stats.heart}`} onClick={() => send({ kind: "calm" })} disabled={busy} />
          <Choice label="Rally" stat={`heals, heart ${me.stats.heart}`} onClick={() => send({ kind: "rally" })} disabled={busy} />
        </div>
      )}
      {kind === "puzzle" && run.puzzle && (
        <section data-puzzle aria-labelledby="puzzle" className="border-2 border-bark bg-parchment p-3 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
          <p className="text-xs font-semibold text-ink/70">The tablet asks about your team</p>
          <h3 id="puzzle" className="font-display text-lg font-medium text-ink">
            {run.puzzle.question}
          </h3>
          <p className="mt-1 text-sm text-ink/75">
            {run.puzzle.hint ? `Your wits rule out ${run.puzzle.options.filter((o) => o.struck).length === 1 ? "one of them" : "some of them"} (wits ${me?.stats.wits ?? 0}). ` : ""}
            {run.puzzle.triesLeft === 1 ? "One more wrong answer and the ruin turns you back." : `${run.puzzle.triesLeft} tries before the ruin turns you back.`}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-2">
            {run.puzzle.options.map((o, i) => (
              <Button key={i} onClick={() => send({ kind: "answer", option: i })} disabled={busy || o.struck || o.tried} className={clsx((o.struck || o.tried) && "line-through")}>
                {o.label}
                {o.tried && <span className="sr-only"> (answered wrong)</span>}
                {o.struck && <span className="sr-only"> (ruled out)</span>}
              </Button>
            ))}
          </div>
        </section>
      )}
      {(kind === "rest" || kind === "secret") && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" onClick={() => send({ kind: "onward" })} disabled={busy}>
            {kind === "rest" ? "Move on" : "Look closer, then move on"}
          </Button>
          <p className="text-sm text-ink/75">{kind === "rest" ? "A pool and a fire. The party gets its breath back." : "A hidden room. Something glints in the alcove."}</p>
        </div>
      )}
      {run.log.length > 0 && (
        <ol data-log aria-live="polite" aria-label="What happened" className="space-y-1 border-l-4 border-bark bg-parchment-deep/60 px-3 py-2 text-sm text-ink">
          {run.log.map((l, i) => (
            <li key={i} className={clsx(l.room < run.room && "text-ink/60")}>
              {l.line}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Entrance({ ruinId, name, tier, current, children }: { ruinId: string; name: string; tier: RuinTier; current: Current; children?: ReactNode }) {
  const start = useMutation(api.rpg.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const art: PixelMap = RUIN_ART[tier];
  const again = current.run?.ruinId === ruinId;
  const can = canStartExpedition(current, tier);
  const block = can.ok ? null : can.reason === "level" ? `The near ruins open to explorers at level 6. You're level ${current.level}.` : "You have no stamina left. Every thoughtful kudos you give restores one, and so does a moon fruit.";
  const enter = async () => {
    setBusy(true);
    setError(null);
    try {
      await start({ ruinId });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {children}
      <div className="flex items-end gap-4">
        <PixelArt map={art} width={art.rows[0].length * 3} height={art.rows.length * 3} label={name} />
        <div className="min-w-0 space-y-1 pb-1">
          <p className="text-sm text-ink">
            {name} is one of the {TIER_NAME[tier]} ruins.
          </p>
          <p className="text-sm text-ink">
            Stamina <StaminaPips stamina={current.stamina} />
          </p>
        </div>
      </div>
      {tier === 1 ? (
        <>
          <p className="text-sm text-ink">
            Three to six rooms: foes to strike, outwit or calm, puzzles about your own team's kudos, a rest, and maybe a hidden room. Falling only sends you back to camp.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => void enter()} disabled={busy || block !== null}>
              {again ? "Enter the ruin again" : "Enter the ruin"}
            </Button>
            <span className="text-sm text-ink/75">Costs 1 stamina</span>
          </div>
          {block && <p className="text-sm text-ink/75">{block}</p>}
        </>
      ) : (
        <p className="text-sm text-ink">The {TIER_NAME[tier]} ruins are for parties. Their expeditions come later, with the people you explore with.</p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-ember-deep">
          {error}
        </p>
      )}
    </div>
  );
}

export function Expedition() {
  const { ruinId: param } = useParams();
  const ruinId = ruinIdOf(`/ruins/${param ?? ""}`);
  const current = useCurrent();
  const tree = useQuery(api.tree.state);
  const act = useMutation(api.rpg.act);
  const abandon = useMutation(api.rpg.abandon);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  if (current === undefined || tree === undefined) return <PageSkeleton />;
  const site = tree?.layout.ruins.find((r) => r.id === ruinId);
  if (!ruinId || !site || current === null) return <p className="text-ink">This ruin isn't open to you.</p>;
  const run = current.run;
  const run_ = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const alert = error && (
    <p role="alert" className="text-sm font-semibold text-ember-deep">
      {error}
    </p>
  );

  if (run?.open && run.ruinId !== ruinId) {
    return (
      <p className="text-ink">
        You're exploring {run.name}.{" "}
        <Link to={ruinPath(run.ruinId)} className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
          Go back to it
        </Link>{" "}
        or return to camp there first.
      </p>
    );
  }
  if (run?.open) {
    return (
      <div data-expedition className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RoomStrip run={run} />
          {leaving ? (
            <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
              Leave? You keep what earlier rooms gave.
              <Button size="sm" variant="danger" onClick={() => void run_(() => abandon({})).then(() => setLeaving(false))} disabled={busy}>
                Return to camp
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLeaving(false)}>
                Stay
              </Button>
            </span>
          ) : (
            <Button size="sm" onClick={() => setLeaving(true)} disabled={busy}>
              Return to camp
            </Button>
          )}
        </div>
        <Room run={run} busy={busy} send={(choice) => void run_(() => act({ choice }))} />
        {alert}
      </div>
    );
  }
  const ended = run && run.ruinId === ruinId && run.state !== "open" ? run : null;
  return (
    <div data-expedition className="space-y-4">
      <Entrance ruinId={ruinId} name={site.name} tier={site.tier as RuinTier} current={current}>
        {ended && (
          <>
            <RoomStrip run={ended} />
            <ResultsLedger state={ended.state as "cleared" | "fallen" | "retreated"} loot={ended.loot} />
          </>
        )}
      </Entrance>
      {alert}
    </div>
  );
}
