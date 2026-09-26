import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { Check, Lock, Network, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import {
  BRANCHES,
  canTake,
  pointsOf,
  rankOf,
  resetCost,
  SKILL_TREE,
  SKILLS,
  takeBlockText,
  TIER_LEVEL,
  type Allocation,
  type BranchId,
  type Skill,
  type SkillId,
  type Tier,
} from "../../convex/lib/skills";
import { Button, Card, Dialog, Empty, PageSkeleton, Segmented } from "@/components/ui";

type Tree = NonNullable<ReturnType<typeof useQuery<typeof api.skills.mine>>>;

/** The oak grows up: the capstones at the top, tier 1 nearest the trunk. */
const TIERS_TOP_DOWN: Tier[] = [4, 3, 2, 1];
const TIER_NAME: Record<Tier, string> = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Capstone" };
const points = (n: number) => `${n} skill ${n === 1 ? "point" : "points"}`;

/**
 * The elder oak (#55 §G7, #131): the skill tree as an oak with four branches, one point per
 * level-up to spend on them, never enough for all of it. Each branch grows up from the trunk, tier 1
 * lowest and the capstone at the top; every tier is visible, and the ones ahead show the level they
 * open at. A skill opens in a dialog to take it; the reset asks first, with its price. A wide window
 * shows the four branches side by side; a narrow one shows one at a time. `SKILL_TREE` is the only
 * source of what grows where.
 */
export function Skills() {
  const tree = useQuery(api.skills.mine, {});
  const game = useQuery(api.game.mine, {});
  const take = useMutation(api.skills.take);
  const reset = useMutation(api.skills.reset);
  const [branch, setBranch] = useState<BranchId>("scout");
  const [open, setOpen] = useState<SkillId | null>(null);
  // The reset's price as shown when it was asked for: the server refuses it if it has moved since.
  const [resetPrice, setResetPrice] = useState<{ cost: number; next: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (tree === undefined || (tree === null && game === undefined)) return <PageSkeleton />;

  const intro = (
    <p className="mb-5 text-sm text-ink/75">Every level-up gives you a skill point. There are never enough points for the whole tree, so what you take is your choice.</p>
  );
  if (tree === null) {
    const [title, body] = !game?.enabled
      ? ["The game is off in this workspace", "An admin can switch the game on in the settings. Your kudos work as always."]
      : game.hidden
        ? ["The game is hidden", "You hid the game, so your tree is out of view. Show the game in your cabin to see it again; your XP kept counting."]
        : ["Your skill tree starts with your first kudos", "Giving a thoughtful kudos makes you a player; every level after that adds a skill point."];
    return (
      <div>
        {intro}
        <Card>
          <Empty icon={<Network className="h-7 w-7 text-ink/70" aria-hidden />} title={title}>
            {body}{" "}
            <Link to="/me" className="text-soil underline underline-offset-4">
              Go to your cabin
            </Link>
          </Empty>
        </Card>
      </div>
    );
  }

  const alloc = tree.skills as Allocation;
  const { earned, spent, available } = pointsOf(alloc, tree.level);
  /** One change at a time: a double tap can't spend a second point or pay twice. */
  const run = async (action: () => Promise<unknown>, done: () => void) => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await action();
      done();
    } catch (e) {
      setError(e instanceof ConvexError ? String(e.data) : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const openSkill = (id: SkillId) => {
    setError(null);
    setOpen(id);
  };

  return (
    <div>
      {intro}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* The points left, as a lantern-lit pixel counter. */}
          <span data-points aria-hidden className="pixel-chip grid h-14 min-w-14 place-items-center bg-lantern px-2 text-[40px] font-sans font-bold leading-none text-ink tabular">
            {available}
          </span>
          <div>
            <div className="font-display text-xl font-medium leading-7">{available === 1 ? "skill point to spend" : "skill points to spend"}</div>
            <div className="text-xs text-ink/75">
              Level {tree.level}. {points(earned)} earned, {spent} spent.
            </div>
          </div>
          <span className="sr-only">{`${points(available)} to spend`}</span>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            setResetPrice({ cost: tree.resetCost, next: resetCost(tree.resets + 1) });
          }}
          disabled={spent === 0}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset tree
        </Button>
      </div>

      <div className="mb-4 @lg:hidden">
        <Segmented value={branch} onChange={setBranch} options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))} wrap />
      </div>

      {/* The oak: four branches side by side over one trunk in a wide window, one branch at a time in a narrow one. */}
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-4">
        {BRANCHES.map((b) => (
          <section key={b.id} data-branch={b.id} aria-label={b.name} className={clsx("relative flex-col @lg:flex", b.id === branch ? "flex" : "hidden")}>
            {/* The branch itself: a bark limb up the middle, behind its leaves. */}
            <span aria-hidden className="absolute bottom-0 left-1/2 top-3 w-2 -translate-x-1/2 bg-bark" />
            <div className="relative flex flex-1 flex-col gap-4">
              {TIERS_TOP_DOWN.map((tier) => (
                <TierBlock key={tier} branch={b} tier={tier} level={tree.level} alloc={alloc} onOpen={openSkill} />
              ))}
            </div>
            <div className="relative mt-3 bg-bark px-2 py-1.5 text-center text-cream">
              <h2 className="font-display text-lg font-medium leading-6">{b.name}</h2>
              <p className="text-xs text-cream/80">{b.about}</p>
            </div>
          </section>
        ))}
      </div>
      {/* The trunk and its roots, where the four branches meet. */}
      <div data-trunk aria-hidden className="mx-auto h-8 w-1/3 max-w-40 bg-bark shadow-[-8px_8px_0_0_var(--color-soil),8px_8px_0_0_var(--color-soil)]" />
      <div aria-hidden className="h-2" />

      {open && (
        <SkillDialog
          skill={SKILLS[open]}
          alloc={alloc}
          level={tree.level}
          error={error}
          busy={busy}
          onClose={() => setOpen(null)}
          onTake={() =>
            run(
              () => take({ skill: open }),
              () => setOpen(null),
            )
          }
        />
      )}
      <ResetDialog
        price={resetPrice}
        balance={tree.balance}
        spent={spent}
        error={error}
        busy={busy}
        onClose={() => setResetPrice(null)}
        onConfirm={(cost) =>
          run(
            () => reset({ cost }),
            () => setResetPrice(null),
          )
        }
      />
    </div>
  );
}

function TierBlock({ branch, tier, level, alloc, onOpen }: { branch: (typeof BRANCHES)[number]; tier: Tier; level: number; alloc: Allocation; onOpen: (id: SkillId) => void }) {
  const skills = SKILL_TREE.filter((s) => s.branch === branch.id && s.tier === tier);
  const opensAt = TIER_LEVEL[tier];
  const isOpen = level >= opensAt;
  return (
    <div data-tier role="group" aria-label={`${branch.name} ${TIER_NAME[tier].toLowerCase()}, ${isOpen ? "open" : `opens at level ${opensAt}`}`}>
      <div className="mb-1.5 flex justify-center">
        <span className={clsx("pixel-chip px-1.5 py-px text-[11px] tabular", isOpen ? "bg-parchment text-ink/75" : "bg-parchment-deep text-ink/75")}>
          {TIER_NAME[tier]}
          {tier > 1 && `, level ${opensAt}`}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <SkillNode key={s.id} skill={s} level={level} alloc={alloc} onOpen={() => onOpen(s.id)} />
        ))}
      </div>
    </div>
  );
}

/** A leaf on the oak: lit in lantern once taken, outlined while it can be taken, dim until its tier opens. */
function SkillNode({ skill, level, alloc, onOpen }: { skill: Skill; level: number; alloc: Allocation; onOpen: () => void }) {
  const rank = rankOf(alloc, skill.id);
  const check = canTake(alloc, level, skill.id);
  const reason = check.ok ? null : check.reason;
  const state = rank > 0 ? "taken" : check.ok ? "open" : reason === "points" ? "waiting" : "locked";
  const label = [
    `${skill.name}, rank ${rank} of ${skill.ranks}`,
    check.ok ? "can be taken" : null,
    reason === "tier" ? `opens at level ${TIER_LEVEL[skill.tier]}` : null,
    reason === "parent" && skill.parent ? `needs ${SKILLS[skill.parent].name}` : null,
    reason === "arrives" ? `arrives with ${skill.arrives?.with}` : null,
    reason === "points" ? `needs ${points(skill.cost)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const note =
    reason === "tier"
      ? `Level ${TIER_LEVEL[skill.tier]}, ${TIER_LEVEL[skill.tier] - level} to go`
      : skill.arrives
        ? `Arrives with ${skill.arrives.with}`
        : skill.parent && rank === 0 && reason === "parent"
          ? `After ${SKILLS[skill.parent].name}`
          : skill.effect;
  return (
    <button
      type="button"
      data-skill={skill.id}
      data-state={state}
      aria-label={label}
      onClick={onOpen}
      className={clsx(
        "pixel-chip flex w-full items-start gap-2 px-2.5 py-2 text-left",
        state === "taken" && "bg-lantern text-ink shadow-[2px_2px_0_0_var(--color-soil)] hover:bg-lantern/85",
        state === "open" && "bg-parchment text-ink shadow-[inset_0_0_0_2px_var(--color-pond-deep)] hover:bg-parchment-deep",
        state === "waiting" && "bg-parchment text-ink hover:bg-parchment-deep",
        state === "locked" && "bg-parchment-deep text-ink/70 hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center",
          state === "taken" ? "bg-ink text-lantern" : state === "open" ? "bg-pond-deep text-cream" : "text-ink/70",
        )}
      >
        {state === "taken" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : state === "open" ? (
          <Plus className="h-3 w-3" strokeWidth={3} />
        ) : state === "locked" && reason === "tier" ? (
          <Lock className="h-3 w-3" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{skill.name}</span>
          {skill.ranks > 1 && (
            <span className="text-[11px] tabular">
              {rank}/{skill.ranks}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug">{note}</span>
      </span>
    </button>
  );
}

function SkillDialog({
  skill,
  alloc,
  level,
  error,
  busy,
  onClose,
  onTake,
}: {
  skill: Skill;
  alloc: Allocation;
  level: number;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onTake: () => void;
}) {
  const rank = rankOf(alloc, skill.id);
  const check = canTake(alloc, level, skill.id);
  const branch = BRANCHES.find((b) => b.id === skill.branch)!;
  const why = check.ok || check.reason === "maxed" ? null : takeBlockText(skill, check.reason, pointsOf(alloc, level).available);
  return (
    <Dialog
      open
      onClose={onClose}
      title={skill.name}
      subtitle={`${branch.name} branch, ${TIER_NAME[skill.tier].toLowerCase()}${skill.tier > 1 ? `, level ${TIER_LEVEL[skill.tier]}` : ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {check.ok ? "Not now" : "Close"}
          </Button>
          {check.ok && (
            <Button variant="primary" onClick={onTake} disabled={busy}>
              Take it for {points(skill.cost)}
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm text-ink">{skill.effect}</p>
      {skill.perRank && <p className="mt-1 text-sm text-ink/75">Each rank: {skill.perRank}</p>}
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="border border-parchment-deep px-3 py-2">
          <dt className="text-xs text-ink/75">Rank</dt>
          <dd className="font-medium tabular">
            {rank} of {skill.ranks}
          </dd>
        </div>
        <div className="border border-parchment-deep px-3 py-2">
          <dt className="text-xs text-ink/75">Cost</dt>
          <dd className="font-medium">{points(skill.cost)} per rank</dd>
        </div>
      </dl>
      {skill.parent && <p className="mt-3 text-xs text-ink/75">Follows {SKILLS[skill.parent].name}.</p>}
      {why && <p className="mt-3 border border-dashed border-bark/60 px-3 py-2 text-sm text-ink/75">{why}</p>}
      {rank === skill.ranks && <p className="mt-3 text-sm text-soil">You have every rank of it.</p>}
      {check.ok && <p className="mt-3 text-xs text-ink/75">Points stay spent until you reset the whole tree, which costs Hog coins.</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function ResetDialog({
  price,
  balance,
  spent,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  price: { cost: number; next: number } | null;
  balance: Tree["balance"];
  spent: number;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (cost: number) => void;
}) {
  const cost = price?.cost ?? 0;
  const affordable = balance !== null && balance >= cost;
  return (
    <Dialog
      open={price !== null}
      onClose={onClose}
      title="Reset your skill tree?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep my tree
          </Button>
          <Button variant="danger" onClick={() => onConfirm(cost)} disabled={!affordable || busy}>
            Reset for {cost} Hog coins
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink">All {points(spent)} come back, to spend again however you like.</p>
      <p className="mt-2 text-sm text-ink/75">
        This reset costs {cost} Hog coins; the next one will cost {price?.next}.
      </p>
      <p className="mt-2 text-sm text-ink/75">
        {balance === null
          ? "Resets cost Hog coins; your wallet opens at level 3."
          : `You have ${balance} Hog ${balance === 1 ? "coin" : "coins"}.${affordable ? "" : " Thoughtful kudos and level-ups earn more."}`}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-ember-deep">
          {error}
        </p>
      )}
    </Dialog>
  );
}
