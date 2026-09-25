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
import { Button, Card, Dialog, Empty, PageHeader, PageSkeleton, Segmented } from "@/components/ui";

type Tree = NonNullable<ReturnType<typeof useQuery<typeof api.skills.mine>>>;

const TIERS: Tier[] = [1, 2, 3, 4];
const TIER_NAME: Record<Tier, string> = { 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Capstone" };
const points = (n: number) => `${n} skill ${n === 1 ? "point" : "points"}`;

/**
 * The skill tree (#55 §G7): one point per level-up to spend on four branches, never enough for all
 * of it. Every tier is visible; the ones ahead show the level they open at. A skill opens in a
 * dialog to take it; the reset asks first, with its price. Desktop shows the branches side by side;
 * a phone shows one at a time.
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

  const header = (
    <PageHeader
      eyebrow="Your game"
      title="Skill tree"
      subtitle="Every level-up gives you a skill point. There are never enough points for the whole tree, so what you take is your choice."
    />
  );
  if (tree === null) {
    const [title, body] = !game?.enabled
      ? ["The game is off in this workspace", "An admin can switch the game on in the settings. Your kudos work as always."]
      : game.hidden
        ? ["The game is hidden", "You hid the game, so your tree is out of view. Show the game on My kudos to see it again; your XP kept counting."]
        : ["Your skill tree starts with your first kudos", "Giving a thoughtful kudos makes you a player; every level after that adds a skill point."];
    return (
      <div>
        {header}
        <Card>
          <Empty icon={<Network className="h-7 w-7 text-ink/70" />} title={title}>
            {body}{" "}
            <Link to="/me" className="text-soil underline-offset-4 hover:underline">
              Back to your kudos
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
      {header}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl font-semibold text-ink tabular">{available}</span>
          <div>
            <div className="text-sm font-medium text-ink">{available === 1 ? "skill point to spend" : "skill points to spend"}</div>
            <div className="text-xs text-ink/75">
              Level {tree.level} · {points(earned)} earned · {spent} spent
            </div>
          </div>
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
        <span className="sr-only">{`${points(available)} to spend`}</span>
      </Card>

      <div className="mb-4 lg:hidden">
        <Segmented value={branch} onChange={setBranch} options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))} wrap />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {BRANCHES.map((b) => (
          <section
            key={b.id}
            data-branch={b.id}
            aria-label={b.name}
            className={clsx("border border-parchment-deep bg-parchment p-4 lg:block", b.id === branch ? "block" : "hidden")}
          >
            <h2 className="font-display text-lg font-semibold text-ink">{b.name}</h2>
            <p className="mt-0.5 text-xs text-ink/75">{b.about}</p>
            <div className="mt-4 flex flex-col gap-4">
              {TIERS.map((tier) => (
                <TierBlock key={tier} branch={b} tier={tier} level={tree.level} alloc={alloc} onOpen={openSkill} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {open && (
        <SkillDialog
          skill={SKILLS[open]}
          alloc={alloc}
          level={tree.level}
          error={error}
          busy={busy}
          onClose={() => setOpen(null)}
          onTake={() => run(() => take({ skill: open }), () => setOpen(null))}
        />
      )}
      <ResetDialog
        price={resetPrice}
        balance={tree.balance}
        spent={spent}
        error={error}
        busy={busy}
        onClose={() => setResetPrice(null)}
        onConfirm={(cost) => run(() => reset({ cost }), () => setResetPrice(null))}
      />
    </div>
  );
}

function TierBlock({
  branch,
  tier,
  level,
  alloc,
  onOpen,
}: {
  branch: (typeof BRANCHES)[number];
  tier: Tier;
  level: number;
  alloc: Allocation;
  onOpen: (id: SkillId) => void;
}) {
  const skills = SKILL_TREE.filter((s) => s.branch === branch.id && s.tier === tier);
  const opensAt = TIER_LEVEL[tier];
  const isOpen = level >= opensAt;
  return (
    <div
      data-tier
      role="group"
      aria-label={`${branch.name} ${TIER_NAME[tier].toLowerCase()}, ${isOpen ? "open" : `opens at level ${opensAt}`}`}
      className={clsx(!isOpen && "border border-dashed border-bark/60 bg-parchment-deep/40 p-2.5")}
    >
      <div className="mb-2 flex items-center gap-1.5 tabular text-[11px] text-ink/70">
        {!isOpen && <Lock className="h-3 w-3" aria-hidden />}
        <span>{TIER_NAME[tier]}</span>
        {tier > 1 && <span>· level {opensAt}</span>}
      </div>
      {!isOpen && (
        <p className="-mt-1 mb-2 text-xs text-ink/75">
          Opens at level {opensAt}: {opensAt - level} {opensAt - level === 1 ? "level" : "levels"} to go.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {skills.map((s) => (
          <SkillNode key={s.id} skill={s} level={level} alloc={alloc} onOpen={() => onOpen(s.id)} />
        ))}
      </div>
    </div>
  );
}

function SkillNode({ skill, level, alloc, onOpen }: { skill: Skill; level: number; alloc: Allocation; onOpen: () => void }) {
  const rank = rankOf(alloc, skill.id);
  const check = canTake(alloc, level, skill.id);
  const reason = check.ok ? null : check.reason;
  const blocked = rank === 0 && reason !== null && reason !== "points";
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
  return (
    <button
      type="button"
      data-skill={skill.id}
      aria-label={label}
      onClick={onOpen}
      className={clsx(
        "group flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition",
        rank > 0 && "border-lantern/50 bg-lantern/10 hover:bg-lantern/15",
        rank === 0 && check.ok && "border-pond/50 bg-pond/5 hover:bg-pond/10",
        rank === 0 && !check.ok && "border-parchment-deep bg-parchment-deep/40 hover:bg-parchment-deep/40",
        blocked && "opacity-60",
      )}
    >
      <span
        className={clsx(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center border",
          rank > 0 ? "border-lantern bg-lantern text-ink" : check.ok ? "border-pond text-pond-deep" : "border-bark/60 text-ink/70",
        )}
        aria-hidden
      >
        {rank > 0 ? <Check className="h-3 w-3" /> : check.ok ? <Plus className="h-3 w-3" /> : reason === "tier" ? <Lock className="h-2.5 w-2.5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={clsx("text-sm font-medium", rank > 0 || check.ok ? "text-ink" : "text-ink")}>{skill.name}</span>
          {skill.ranks > 1 && (
            <span className="text-[11px] text-ink/75 tabular">
              {rank}/{skill.ranks}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-ink/75">
          {skill.arrives ? `Arrives with ${skill.arrives.with}` : skill.parent && rank === 0 && reason === "parent" ? `After ${SKILLS[skill.parent].name}` : skill.effect}
        </span>
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
      subtitle={`${branch.name} · ${TIER_NAME[skill.tier]}${skill.tier > 1 ? ` · level ${TIER_LEVEL[skill.tier]}` : ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {check.ok ? "Not now" : "Close"}
          </Button>
          {check.ok && (
            <Button variant="primary" onClick={onTake} disabled={busy}>
              Take it · {points(skill.cost)}
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
