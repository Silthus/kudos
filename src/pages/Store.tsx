import clsx from "clsx";
import { useQuery } from "convex/react";
import { motion } from "motion/react";
import { Clock, Info, MessageCircleQuestion } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { BigNumber, Button, Card, Empty, PageHeader, PageSkeleton, Progress } from "@/components/ui";
import { nf } from "@/lib/format";
import { useViewer } from "@/lib/viewer";

export type RewardLike = {
  name: string;
  emoji: string;
  cost: number;
  description?: string;
  stock?: number;
  maxPerMember?: number;
  prompt?: string;
};

/** Stock and limit badges, most urgent first. */
function rewardBadge(r: RewardLike & { soldOut?: boolean }) {
  if (r.soldOut || r.stock === 0) return { label: "Sold out", tone: "muted" as const };
  if (r.stock !== undefined && r.stock <= 10) return { label: `${nf.format(r.stock)} left`, tone: "ember" as const };
  if (r.maxPerMember !== undefined) return { label: `${r.maxPerMember} per person`, tone: "teal" as const };
  return null;
}

/** One reward as members see it; also the live preview in the admin editor. */
export function RewardCard({
  reward,
  glyph,
  balance,
  action,
  className,
}: {
  reward: RewardLike & { soldOut?: boolean; limitReached?: boolean };
  glyph: string;
  /** Omit to render without the "need more" progress (e.g. the admin preview). */
  balance?: number;
  action?: React.ReactNode;
  className?: string;
}) {
  const badge = rewardBadge(reward);
  const short = balance !== undefined ? Math.max(0, reward.cost - balance) : 0;
  const dimmed = reward.soldOut || reward.stock === 0;
  return (
    <article
      className={clsx(
        "group relative flex h-full flex-col rounded-2xl border border-line bg-panel/80 p-4 transition-colors hover:border-line-strong",
        dimmed && "opacity-70",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <motion.span
          whileHover={{ rotate: -6, scale: 1.06 }}
          transition={{ type: "spring", bounce: 0.5, duration: 0.4 }}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-saffron/10 text-[30px] ring-1 ring-saffron/20"
          aria-hidden
        >
          {reward.emoji || "🎁"}
        </motion.span>
        {badge && (
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ring-1 ring-inset",
              badge.tone === "ember" && "bg-ember/10 text-ember ring-ember/30",
              badge.tone === "teal" && "bg-teal/15 text-teal-soft ring-teal/30",
              badge.tone === "muted" && "bg-panel-3 text-muted ring-line-strong",
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold leading-snug tracking-tight text-cream">{reward.name || "Untitled reward"}</h3>
      {reward.description && <p className="mt-1 text-sm leading-relaxed text-muted">{reward.description}</p>}
      {reward.prompt && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Asks: {reward.prompt}
        </p>
      )}
      <div className="mt-auto pt-4">
        {short > 0 && (
          <div className="mb-3">
            <div className="mb-1.5 flex justify-between text-xs text-muted">
              <span>
                Need {nf.format(short)} more {glyph}
              </span>
              <span className="font-mono tabular">
                {nf.format(Math.max(0, balance ?? 0))}/{nf.format(reward.cost)}
              </span>
            </div>
            <Progress value={Math.max(0, balance ?? 0)} max={reward.cost} height={4} />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="font-display text-xl font-semibold tabular text-saffron">
            {nf.format(reward.cost)} <span className="text-base">{glyph}</span>
          </span>
          {action}
        </div>
      </div>
    </article>
  );
}

export function Store() {
  const viewer = useViewer();
  const data = useQuery(api.store.catalog);
  if (!data) return <PageSkeleton />;
  const glyph = viewer.workspace.emojiGlyph;

  if (!data.enabled) {
    return (
      <Card>
        <Empty icon="🎁" title="The store is closed">
          Your admins haven't opened the rewards store in {viewer.workspace.name}.
        </Empty>
      </Card>
    );
  }

  const { balance, rewards } = data;
  const affordable = rewards.filter((r) => r.affordable && !r.soldOut).length;

  return (
    <div>
      <PageHeader
        eyebrow="Rewards store"
        title={
          <>
            You have <BigNumber value={balance} className={balance < 0 ? "text-down" : "text-saffron"} /> {glyph} to spend
          </>
        }
        subtitle="Every kudos your teammates give you lands here. Spending never changes your received totals."
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-panel-2 px-3 py-1.5 text-xs text-muted">
            <Clock className="h-3.5 w-3.5 text-saffron" /> Redeeming opens soon
          </span>
        }
      />

      {balance < 0 && (
        <p className="mb-5 flex items-start gap-2.5 rounded-xl border border-line-strong bg-panel-2/60 px-4 py-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
          <span>
            Your balance is {nf.format(balance)} {glyph} because some kudos you received were revoked after you spent them. New kudos bring it back up.
          </span>
        </p>
      )}

      {rewards.length === 0 ? (
        <Card>
          <Empty icon="🛍️" title="The shelves are empty">
            Your admins are still stocking the store.{" "}
            {viewer.member.isAdmin && (
              <Link to="/admin?tab=store" className="font-medium text-saffron underline-offset-4 hover:underline">
                Add rewards
              </Link>
            )}
          </Empty>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-faint">
            {rewards.length} {rewards.length === 1 ? "reward" : "rewards"} · you can afford {affordable}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rewards.map((r, i) => (
              <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}>
                <RewardCard
                  reward={r}
                  glyph={glyph}
                  balance={balance}
                  action={
                    // Disabled buttons don't show tooltips, so the wrapper carries it.
                    <span title="Redeeming arrives in the next release">
                      <Button size="sm" disabled>
                        Coming soon
                      </Button>
                    </span>
                  }
                />
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
