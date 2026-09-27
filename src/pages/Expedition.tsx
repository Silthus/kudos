import { useMutation, useQuery } from "convex/react";
import clsx from "clsx";
import { motion, useReducedMotionConfig } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { PARTY, tierForLevel, type CreatureId } from "../../convex/lib/rpg";
import { startBlock, TIER_WORD, tierLevel } from "../../convex/lib/ruinWords";
import { isRaidId, type RuinTier } from "../../convex/lib/tree";
import { ResultsLedger, StaminaPips } from "@/components/rpg";
import { errorText } from "@/lib/errors";
import { Button, PageSkeleton, Progress } from "@/components/ui";
import { HogFrame } from "@/world/Hog";
import { PixelArt } from "@/world/PixelArt";
import type { PixelMap } from "@/world/pixels";
import { RUIN_ART, ruinIdOf, ruinPath } from "@/world/places/ruins";
import { CREATURE_ART } from "@/world/rpg/bestiary";
import { ROOM_ICONS, SCENE, sceneFor } from "@/world/rpg/scenes";
import { secondsLeft, useWorldNow } from "@/world/worldNow";

/**
 * A ruin's window (#162, #163, plan #152 S7; `api.rpg.*`). At the entrance: the ruin, your stamina,
 * and two ways in: form a party (the players standing within reach, each with an Invite button, the
 * party as it gathers with everyone's level, and Set out for the leader) or go alone. Inside: the
 * room strip, the room as a pixel scene (the party on the left, the foe on the right), everyone's
 * hit points and whether they've chosen, the choices with the stat each uses, "Waiting for Ben…"
 * with the seconds before the room resolves without them, the room's log, and the way back to
 * camp. At the end, the results ledger. The server resolves every turn; this window only asks and shows.
 */

type Current = NonNullable<ReturnType<typeof useCurrent>>;
type Run = NonNullable<Current["run"]>;
type Choice = Parameters<ReturnType<typeof useMutation<typeof api.rpg.act>>>[0]["choice"];
/** A room the party has reached: its kind is known. */
type RoomKind = Exclude<Run["rooms"][number]["kind"], "unknown">;
const useCurrent = () => useQuery(api.rpg.current);

const TIER_ABOUT: Record<number, string> = {
  1: "Three to six rooms: foes to strike, outwit or calm, puzzles about your own team's kudos, a rest, and maybe a hidden room.",
  2: "Longer and harder than the near ruins: tougher foes, rarer gear. Better with company.",
  3: "The deepest ruins. Few come back alone: bring a party.",
};

/** A list of names as a sentence says them: "Ana", "Ana and Ben", "Ana, Ben and Cleo". */
const listed = (names: string[]) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
/** "Ben goes on", "Ben and Cleo go on". */
const goOn = (names: string[]) => `${listed(names)} ${names.length === 1 ? "goes" : "go"} on`;

/** Runs a mutation with the window's busy state and error line. */
function useSend() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (f: () => Promise<unknown>) => {
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
  return { busy, send, alert };
}

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

/** The room as a picture: its backdrop, the party standing on the left, and what waits on the right. */
function Scene({ run }: { run: Run }) {
  const still = useReducedMotionConfig();
  const kind = run.rooms[run.room].kind as RoomKind;
  const backdrop = useMemo(() => sceneFor(kind, run.tier), [kind, run.tier]);
  const floor = `${((SCENE.height - SCENE.floor - 1) / SCENE.height) * 100}%`;
  // Everyone still standing in the room, the viewer in front.
  const here = run.party.filter((p) => !p.left && p.hp > 0).sort((a, b) => Number(a.you) - Number(b.you));
  return (
    <div data-scene={kind} className="relative w-full overflow-hidden border-2 border-bark bg-dusk" style={{ aspectRatio: `${SCENE.width} / ${SCENE.height}` }}>
      <PixelArt map={backdrop} className="absolute inset-0 h-full w-full" />
      {here.map((p, i) => (
        // A party stands in a staggered line: each one a step further back and to the left.
        <div key={p.memberId} data-scene-hog={p.name} className="absolute" style={{ bottom: `calc(${floor} + ${(here.length - 1 - i) * 3}%)`, left: `${2 + i * 7}%`, width: `${here.length > 1 ? 17 : 22}%` }}>
          {/* Sized with the scene: the frame is square, so its width sets its height. */}
          <HogFrame className="!h-auto !w-full" />
        </div>
      ))}
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

function Meter({ name, hp, max, colour, note }: { name: string; hp: number; max: number; colour: string; note?: ReactNode }) {
  return (
    <div className="min-w-32 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm text-ink">
        <span className="font-semibold">
          {name}
          {note}
        </span>
        <span className="whitespace-nowrap tabular text-ink/75">
          {hp} of {max}
        </span>
      </div>
      <Progress value={hp} max={max} color={colour} label={`${name}: ${hp} of ${max}`} height={10} />
    </div>
  );
}

/** Where a member of a party stands this turn, next to their name. */
function MemberNote({ p, party }: { p: Run["party"][number]; party: boolean }) {
  const word = p.left ? "at camp" : p.hp <= 0 ? "fell" : party ? (p.chosen ? "chosen" : "choosing") : null;
  if (!word) return null;
  return (
    <span data-member-state={word} className={clsx("ml-1.5 whitespace-nowrap border px-1 text-xs font-semibold", p.chosen && !p.left && p.hp > 0 ? "border-bark bg-sap/60 text-ink" : "border-bark/40 text-ink/70")}>
      {word}
    </span>
  );
}

/** A choice as a pixel button: the action, and under it the stat it uses. */
function ChoiceButton({ label, stat, onClick, disabled }: { label: string; stat: string; onClick: () => void; disabled: boolean }) {
  return (
    <Button variant="primary" size="lg" className="h-auto flex-col gap-0 py-1.5" onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      <span className="text-xs font-medium tabular">{stat}</span>
    </Button>
  );
}

/**
 * In a party, who the room is waiting for: "Waiting for Ben…" once you've chosen, "Ana has chosen"
 * while you haven't, with the seconds before it resolves without the ones still choosing.
 */
function Waiting({ run }: { run: Run }) {
  const now = useWorldNow(run.decideBy !== null, 1000);
  const me = run.party.find((p) => p.you);
  const standing = run.party.filter((p) => !p.left && p.hp > 0);
  if (standing.length < 2 || !me || run.decideBy === null) return null;
  const waitingOn = standing.filter((p) => !p.chosen && !p.you).map((p) => p.name);
  const chosen = standing.filter((p) => p.chosen && !p.you).map((p) => p.name);
  const left = secondsLeft(run.decideBy, now);
  // The seconds tick in place without being read out each time (the sentence around them is).
  const clock = <span aria-live="off" className="tabular">{left === 1 ? "1 second" : `${left} seconds`}</span>;
  return (
    <p data-waiting aria-live="polite" className="border-2 border-bark bg-parchment-deep/70 px-3 py-2 text-sm text-ink">
      {me.chosen ? (
        <>
          Waiting for {listed(waitingOn)}… The room goes on without them in {clock}.
        </>
      ) : (
        <>
          {listed(chosen)} {chosen.length === 1 ? "has" : "have"} chosen. Choose within {clock}, or the room goes on without you.
        </>
      )}
    </p>
  );
}

function Room({ run, send, busy }: { run: Run; send: (choice: Choice) => void; busy: boolean }) {
  const kind = run.rooms[run.room].kind;
  const me = run.party.find((p) => p.you);
  const party = run.party.length > 1;
  // Only someone still standing in the run sees its room (the window shows the rest the entrance).
  return (
    <div className="space-y-4">
      <Scene run={run} />
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {run.party.map((p) => (
          <Meter key={p.memberId} name={p.name} hp={p.hp} max={p.maxHp} colour="var(--color-sap)" note={<MemberNote p={p} party={party} />} />
        ))}
        {run.foe && <Meter name={run.foe.name} hp={run.foe.hp} max={run.foe.maxHp} colour="var(--color-blight)" />}
      </div>
      {run.foe && (
        <p className="text-sm text-ink/75">
          {run.foe.about} Weak to {run.foe.weakness}.
        </p>
      )}
      <Waiting run={run} />
      {kind === "foe" && me && (
        <div className="grid grid-cols-2 gap-2 @md:grid-cols-4">
          <ChoiceButton label="Strike" stat={`might ${me.stats.might}`} onClick={() => send({ kind: "strike" })} disabled={busy} />
          <ChoiceButton label="Outwit" stat={`wits ${me.stats.wits}`} onClick={() => send({ kind: "outwit" })} disabled={busy} />
          <ChoiceButton label="Calm" stat={`heart ${me.stats.heart}`} onClick={() => send({ kind: "calm" })} disabled={busy} />
          <ChoiceButton label="Rally" stat={`heals, heart ${me.stats.heart}`} onClick={() => send({ kind: "rally" })} disabled={busy} />
        </div>
      )}
      {kind === "puzzle" && run.puzzle && (
        <section data-puzzle aria-labelledby="puzzle" className="border-2 border-bark bg-parchment p-3 shadow-[3px_3px_0_0_var(--color-dusk-deep)]">
          <p className="text-xs font-semibold text-ink/70">The tablet asks about your team{party ? ": the first answer speaks for the party" : ""}</p>
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

const REASON: Record<string, (level: number, tier: number) => string> = {
  level: (level, tier) => `Level ${level}: needs ${tierLevel(tier as RuinTier)}`,
  stamina: () => "No stamina left",
  too_far: () => "Too far away",
  full: () => "The party is full",
  busy: () => "On another expedition",
};

/**
 * A party gathering at the entrance: who's in with their levels, who's been asked (and for how much
 * longer), and for the leader the players standing within reach with an Invite button each, and
 * Set out. Everyone else waits for the leader, or leaves.
 */
function Forming({ run, current }: { run: Run; current: Current }) {
  const now = useWorldNow(true, 1000);
  const reach = useQuery(api.rpg.reach, run.leader ? { now: Math.floor(now / 5000) * 5000 } : "skip");
  const invite = useMutation(api.rpg.invite);
  const setOut = useMutation(api.rpg.setOut);
  const abandon = useMutation(api.rpg.abandon);
  const { busy, send, alert } = useSend();
  // The leader forms the party and is first in it; a leader who leaves disbands it.
  const leader = run.party[0];
  const asked = run.invited.filter((i) => i.expiresAt > now);
  const others = (reach ?? []).filter((r) => !run.party.some((p) => p.memberId === r.memberId));
  const full = run.party.length >= PARTY.max;
  return (
    <section data-forming aria-labelledby="forming" className="space-y-3">
      <h3 id="forming" className="font-display text-lg font-medium text-ink">
        {run.leader ? "Your party" : `${leader.name}'s party`} for {run.name}
      </h3>
      <ul data-party aria-label="The party" className="divide-y-2 divide-bark/20 border-2 border-bark bg-parchment">
        {run.party.map((p) => (
          <li key={p.memberId} data-party-member={p.name} className="flex items-center gap-3 px-3 py-2 text-sm text-ink">
            <span className="shrink-0">
              <HogFrame className="!h-9 !w-9" />
            </span>
            <span className="min-w-0 flex-1 font-semibold">
              {p.name}
              {p.you && <span className="font-normal text-ink/70"> (you)</span>}
            </span>
            <span className="tabular text-ink/80">Level {p.level}</span>
            {p === leader && <span className="border border-bark bg-lantern/70 px-1 text-xs font-semibold">Leader</span>}
          </li>
        ))}
        {asked.map((i) => (
          <li key={i.memberId} data-invited={i.name} className="flex items-center gap-3 px-3 py-2 text-sm text-ink/75">
            <span className="min-w-0 flex-1">Invited {i.name}: waiting for an answer</span>
            <span className="tabular">{secondsLeft(i.expiresAt, now)} s</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink/75">
        {run.party.length} of {PARTY.max}. Everyone spends one stamina when the party sets out. Each of you chooses in every room; a room waits up to a minute for everyone.
      </p>
      {run.leader && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-ink">Within {PARTY.inviteRadius} tiles of the entrance</h4>
          {others.length === 0 ? (
            <p data-nobody className="text-sm text-ink/75">Nobody else is standing here. Teammates who walk up to the entrance show here.</p>
          ) : (
            <ul data-reach className="space-y-1.5">
              {others.map((r) => {
                const open = r.canJoin && !full;
                return (
                  <li key={r.memberId} data-reach-member={r.name} className="flex flex-wrap items-center gap-3 text-sm text-ink">
                    <span className="min-w-0 flex-1 font-semibold">
                      {r.name} <span className="font-normal tabular text-ink/75">level {r.level}</span>
                    </span>
                    {!open && <span className="text-ink/70">{REASON[full ? "full" : (r.reason ?? "full")](r.level, run.tier)}</span>}
                    <Button size="sm" onClick={() => void send(() => invite({ memberId: r.memberId }))} disabled={busy || !open}>
                      {r.invited ? "Invite again" : "Invite"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {run.leader ? (
          <>
            <Button variant="primary" size="lg" onClick={() => void send(() => setOut({}))} disabled={busy || startBlock(current, run.tier as RuinTier) !== null}>
              {run.party.length === 1 ? "Set out alone" : `Set out with ${run.party.length}`}
            </Button>
            <Button onClick={() => void send(() => abandon({}))} disabled={busy}>
              Disband the party
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Waiting for {leader.name} to set out.</p>
            <Button onClick={() => void send(() => abandon({}))} disabled={busy}>
              Leave the party
            </Button>
          </>
        )}
      </div>
      {alert}
    </section>
  );
}

function Entrance({ ruinId, name, tier, current, children }: { ruinId: string; name: string; tier: RuinTier; current: Current; children?: ReactNode }) {
  const start = useMutation(api.rpg.start);
  const form = useMutation(api.rpg.form);
  const { busy, send, alert } = useSend();
  const art: PixelMap = RUIN_ART[tier];
  const again = current.run?.ruinId === ruinId;
  const block = startBlock(current, tier);
  return (
    <div className="space-y-4">
      {children}
      <div className="flex items-end gap-4">
        <PixelArt map={art} width={art.rows[0].length * 3} height={art.rows.length * 3} label={name} />
        <div className="min-w-0 space-y-1 pb-1">
          <p className="text-sm text-ink">
            {name} is one of the {TIER_WORD[tier]} ruins{tier > 1 ? `, from level ${tierLevel(tier)}` : ""}.
          </p>
          <p className="text-sm text-ink">
            Stamina <StaminaPips stamina={current.stamina} />
          </p>
        </div>
      </div>
      <p className="text-sm text-ink">{TIER_ABOUT[tier]} Falling only sends you back to camp.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={() => void send(() => form({ ruinId }))} disabled={busy || block !== null}>
          Form a party
        </Button>
        <Button size="lg" onClick={() => void send(() => start({ ruinId }))} disabled={busy || block !== null}>
          {again ? "Go alone again" : "Go alone"}
        </Button>
        <span className="text-sm text-ink/75">Costs 1 stamina each</span>
      </div>
      {block && <p className="text-sm text-ink/75">{block}</p>}
      {!block && tierForLevel(current.level) >= tier && (
        <p className="text-sm text-ink/75">A party is you and up to three teammates standing near the entrance. They get an invite on their screen.</p>
      )}
      {alert}
    </div>
  );
}

/** Where a run is played: its ruin's window, or the blight stone's for the blight raid (#164). */
export const runPath = (ruinId: string) => (isRaidId(ruinId) ? "/blight" : ruinPath(ruinId));

/** The run the viewer is in now (forming or under way, still standing in it), or null. */
export const activeRun = (run: Run | null | undefined) => (run && (run.open || run.state === "forming") && run.party.some((p) => p.you && !p.left && p.hp > 0) ? run : null);

/** A run under way: the room strip, the way back to camp (leaving the party, if there is one), the room with its choices. */
export function OpenRun({ run }: { run: Run }) {
  const act = useMutation(api.rpg.act);
  const abandon = useMutation(api.rpg.abandon);
  const { busy, send, alert } = useSend();
  const [leaving, setLeaving] = useState(false);
  const alone = run.party.filter((p) => !p.left).length === 1;
  return (
    <div data-expedition className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RoomStrip run={run} />
        {leaving ? (
          <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
            {alone ? "Leave? You keep what earlier rooms gave." : "Leave the party? You keep what earlier rooms gave; they go on."}
            <Button size="sm" variant="danger" onClick={() => void send(() => abandon({})).then(() => setLeaving(false))} disabled={busy}>
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
      <Room run={run} busy={busy} send={(choice) => void send(() => act({ choice, at: { room: run.room, turn: run.turn } }))} />
      {alert}
    </div>
  );
}

/** How a run you were in went: its rooms, the results ledger, and with whom. */
export function RunResults({ run }: { run: Run }) {
  return (
    <>
      <RoomStrip run={run} />
      <ResultsLedger state={run.state as "cleared" | "fallen" | "retreated"} loot={run.loot} />
      {run.party.length > 1 && <p className="text-sm text-ink/75">With {listed(run.party.filter((p) => !p.you).map((p) => p.name))}. Each of you found your own.</p>}
    </>
  );
}

/** You're in a run (or a party forming) somewhere else: the way back to it. */
export function ElsewhereRun({ run }: { run: Run }) {
  return (
    <p className="text-ink">
      {run.state === "forming" ? `You're in a party for ${run.name}.` : `You're exploring ${run.name}.`}{" "}
      <Link to={runPath(run.ruinId)} className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
        Go back to it
      </Link>{" "}
      or return to camp there first.
    </p>
  );
}

export function Expedition() {
  const { ruinId: param } = useParams();
  const ruinId = ruinIdOf(`/ruins/${param ?? ""}`);
  const current = useCurrent();
  const tree = useQuery(api.tree.state);
  if (current === undefined || tree === undefined) return <PageSkeleton />;
  const site = tree?.layout.ruins.find((r) => r.id === ruinId);
  if (!ruinId || !site || current === null) return <p className="text-ink">This ruin isn't open to you.</p>;
  const run = current.run;
  const active = activeRun(run);
  if (active && active.ruinId !== ruinId) return <ElsewhereRun run={active} />;
  if (active?.state === "forming") return <Forming run={active} current={current} />;
  if (active?.open) return <OpenRun run={active} />;
  const ended = run && run.ruinId === ruinId && (run.state === "cleared" || run.state === "fallen" || run.state === "retreated") ? run : null;
  // You fell or went back to camp while your party goes on: you're at the entrance again.
  const without = run?.open && run.ruinId === ruinId ? run : null;
  const me = without?.party.find((p) => p.you);
  return (
    <div data-expedition className="space-y-4">
      <Entrance ruinId={ruinId} name={site.name} tier={site.tier as RuinTier} current={current}>
        {without && me && (
          <p data-party-goes-on className="border-2 border-bark bg-parchment-deep/70 px-3 py-2 text-sm font-semibold text-ink">
            {me.left ? "You returned to camp." : "You fell and woke at camp."} {goOn(without.party.filter((p) => !p.you && !p.left && p.hp > 0).map((p) => p.name))} without you.
          </p>
        )}
        {ended && <RunResults run={ended} />}
      </Entrance>
    </div>
  );
}
