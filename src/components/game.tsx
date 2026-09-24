import { useMutation, useQuery } from "convex/react";
import { Coins, Lock, Sprout } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { CoinBalance } from "../../convex/lib/coins";
import { nextLockedAreas, type LevelProgress } from "../../convex/lib/xp";
import { Card, CardHeader, Progress } from "@/components/ui";

/**
 * A game area the member hasn't reached yet (§G1 progressive disclosure): visible, with a lock,
 * the level it opens at and one line on how to get there. Every later game area starts as one.
 */
export function Locked({ title, level, how }: { title: string; level: number; how: string }) {
  return (
    <div
      data-locked
      role="group"
      aria-label={`${title}, opens at level ${level}`}
      className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong bg-ink/30 px-3.5 py-3 text-sm"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-faint" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-cream/70">{title}</span>
          <span className="font-mono text-[11px] text-faint">Level {level}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{how}</p>
      </div>
    </div>
  );
}

/**
 * The Hog coin wallet (§G4), from level 3: the balance and where it came from. Coins collected
 * silently before level 3 are all in it the first time it appears.
 */
export function Wallet({ wallet }: { wallet: CoinBalance }) {
  const sources = [
    `${wallet.fromKudos} from thoughtful kudos`,
    `${wallet.fromLevels} from level-ups`,
    wallet.spent ? `${wallet.spent} spent` : null,
    wallet.adjusted ? `${wallet.adjusted > 0 ? "+" : ""}${wallet.adjusted} by admins` : null,
  ].filter(Boolean);
  return (
    <div
      data-wallet
      role="group"
      aria-label={`Hog coins: ${wallet.balance}`}
      className="flex items-start gap-3 rounded-xl border border-saffron/40 bg-saffron/5 px-3.5 py-3 text-sm"
    >
      <Coins className="mt-1 h-5 w-5 shrink-0 text-saffron" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-cream tabular">{wallet.balance}</span>
          <span className="font-medium text-cream/80">Hog coins</span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{sources.join(" · ")}</p>
        {wallet.balance < 0 && (
          <p className="mt-1 text-xs text-muted">A revoked kudos took back coins it had earned. Spending waits until it's above zero again.</p>
        )}
      </div>
    </div>
  );
}

/** Your level, its title and how far it is to the next one. */
export function LevelPanel({ progress }: { progress: LevelProgress }) {
  const span = progress.next === null ? 1 : progress.next - progress.floor;
  const into = progress.next === null ? 1 : Math.max(0, progress.xp - progress.floor);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold text-cream">Level {progress.level}</span>
          <span className="text-sm text-saffron">{progress.title}</span>
        </div>
        <span className="font-mono text-xs text-muted tabular">{progress.xp} XP</span>
      </div>
      <Progress value={into} max={span} className="mt-3" height={8} />
      <div className="mt-1.5 text-xs text-muted">
        {progress.toNext === null ? "Top level reached" : `${progress.toNext} XP to level ${progress.level + 1}`}
      </div>
    </div>
  );
}

/**
 * The game on your profile (Me): level, title and the next-level bar, the wallet from level 3, the
 * next areas ahead (locked), and "Hide the game". Before a member's first kudos it only invites them to give.
 * Nothing at all while the workspace doesn't play the game.
 */
export function GameCard({ glyph }: { glyph: string }) {
  const game = useQuery(api.game.mine, {});
  const setHidden = useMutation(api.game.setHidden);
  if (!game?.enabled) return null;
  if (game.hidden) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm text-muted">
        <span>The game is hidden. Your kudos still earn XP and Hog coins.</span>
        <button type="button" className="font-medium text-saffron underline-offset-4 hover:underline" onClick={() => void setHidden({ hidden: false })}>
          Show the game
        </button>
      </div>
    );
  }
  const hide = (
    <button type="button" className="text-xs text-faint underline-offset-4 hover:text-muted hover:underline" onClick={() => void setHidden({ hidden: true })}>
      Hide the game
    </button>
  );
  if (!game.player) {
    return (
      <Card>
        <CardHeader title="You can give kudos too" icon={<Sprout className="h-4 w-4 text-saffron" />} action={hide} />
        <p className="px-5 pb-5 text-sm text-muted">
          Mention a teammate in Slack with {glyph} and a few words on why. Your first kudos starts your level; thoughtful ones earn the most.
        </p>
      </Card>
    );
  }
  const ahead = nextLockedAreas(game.player.level);
  const wallet = game.wallet ?? null;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <LevelPanel progress={game.player} />
        </div>
        {hide}
      </div>
      {(wallet || ahead.length > 0) && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {wallet && <Wallet wallet={wallet} />}
          {ahead.map((a) => (
            <Locked key={a.key} title={a.title} level={a.level} how={a.how} />
          ))}
        </div>
      )}
    </Card>
  );
}
