import { useMutation, useQuery } from "convex/react";
import { ChevronRight, Compass, Lock, Network, Sprout } from "lucide-react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { CoinBalance } from "../../convex/lib/coins";
import { GARDEN_LEVEL } from "../../convex/lib/garden";
import { pointsOf, type Allocation } from "../../convex/lib/skills";
import { daysBetween } from "../../convex/lib/time";
import { nextLockedAreas, type LevelProgress } from "../../convex/lib/xp";
import { HogCoin } from "@/components/HogCoin";
import { RemoteArt } from "@/components/RemoteArt";
import { Avatar, Card, CardHeader, Progress } from "@/components/ui";

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
      className="flex items-start gap-3 border border-dashed border-bark/60 bg-parchment-deep/40 px-3.5 py-3 text-sm"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink/65" aria-hidden />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-ink">{title}</span>
          <span className="tabular text-[11px] text-ink/65">Level {level}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink/75">{how}</p>
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
    wallet.fromFruit ? `${wallet.fromFruit} from garden fruit` : null,
    wallet.fromQuests ? `${wallet.fromQuests} from quests` : null,
    wallet.fromSprees ? `${wallet.fromSprees} from kudos sprees` : null,
    `${wallet.fromLevels} from level-ups`,
    wallet.spent ? `${wallet.spent} spent` : null,
    wallet.adjusted ? `${wallet.adjusted > 0 ? "+" : ""}${wallet.adjusted} by admins` : null,
  ].filter(Boolean);
  return (
    <div
      data-wallet
      role="group"
      aria-label={`Hog coins: ${wallet.balance}`}
      className="flex items-start gap-3 border border-lantern/40 bg-lantern/5 px-3.5 py-3 text-sm"
    >
      <HogCoin size={28} className="mt-0.5" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold text-ink tabular">{wallet.balance}</span>
          <span className="font-medium text-ink">Hog coins</span>
        </div>
        <p className="mt-0.5 text-xs text-ink/75">{sources.join(" · ")}</p>
        {wallet.balance < 0 && (
          <p className="mt-1 text-xs text-ink/75">A revoked kudos took back coins it had earned. Spending waits until it's above zero again.</p>
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
          <span className="font-display text-3xl font-semibold text-ink">Level {progress.level}</span>
          <span className="text-sm text-soil">{progress.title}</span>
        </div>
        <span className="text-xs text-ink/75 tabular">{progress.xp} XP</span>
      </div>
      <Progress value={into} max={span} className="mt-3" height={8} />
      <div className="mt-1.5 text-xs text-ink/75">
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
  const tree = useQuery(api.skills.mine, game?.player && !game.hidden ? {} : "skip");
  const setHidden = useMutation(api.game.setHidden);
  if (!game?.enabled) return null;
  if (game.hidden) {
    return (
      <div className="flex items-center justify-between border border-parchment-deep px-4 py-2.5 text-sm text-ink/75">
        <span>The game is hidden. Your kudos still earn XP and Hog coins.</span>
        <button type="button" className="font-medium text-soil underline-offset-4 hover:underline" onClick={() => void setHidden({ hidden: false })}>
          Show the game
        </button>
      </div>
    );
  }
  const hide = (
    <button type="button" className="text-xs text-ink/65 underline-offset-4 hover:text-ink/75 hover:underline" onClick={() => void setHidden({ hidden: true })}>
      Hide the game
    </button>
  );
  if (!game.player) {
    return (
      <Card>
        <CardHeader title="You can give kudos too" icon={<Sprout className="h-4 w-4 text-soil" />} action={hide} />
        <p className="px-5 pb-5 text-sm text-ink/75">
          Mention a teammate in Slack with {glyph} and a few words on why. Your first kudos starts your level; thoughtful ones earn the most.
        </p>
      </Card>
    );
  }
  const ahead = nextLockedAreas(game.player.level);
  const wallet = game.wallet ?? null;
  const available = tree ? pointsOf(tree.skills as Allocation, tree.level).available : null;
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
      {game.player.level >= GARDEN_LEVEL && (
        <Link
          to="/garden"
          className="mt-3 flex items-center gap-3 border border-parchment-deep px-3.5 py-2.5 text-sm transition hover:border-bark/60 hover:bg-parchment-deep/50"
        >
          <Sprout className="h-4 w-4 shrink-0 text-soil" aria-hidden />
          <span className="font-medium text-ink">Your garden</span>
          <span className="flex-1 text-xs text-ink/75">A plant for each teammate you recognise</span>
          <ChevronRight className="h-4 w-4 text-ink/65" aria-hidden />
        </Link>
      )}
      {available !== null && (
        <Link
          to="/skills"
          className="mt-3 flex items-center gap-3 border border-parchment-deep px-3.5 py-2.5 text-sm transition hover:border-bark/60 hover:bg-parchment-deep/50"
        >
          <Network className="h-4 w-4 shrink-0 text-soil" aria-hidden />
          <span className="font-medium text-ink">Skill tree</span>
          <span className="flex-1 text-xs text-ink/75">
            {available > 0 ? `${available} skill ${available === 1 ? "point" : "points"} to spend` : "Every level-up brings a skill point"}
          </span>
          <ChevronRight className="h-4 w-4 text-ink/65" aria-hidden />
        </Link>
      )}
    </Card>
  );
}

/**
 * Lookout (Scout skill): teammates you haven't thanked in 30 days or more, and with Wide net a few
 * you never have. Only you see it, and only while you have the skill.
 */
export function ScoutHints({ today }: { today: string }) {
  const hints = useQuery(api.skills.hints, { today });
  if (!hints) return null;
  const rows = [
    ...hints.quiet.map((h) => ({ ...h, note: `last thanked ${daysBetween(h.lastDay ?? today, today)} days ago` })),
    ...(hints.never ?? []).map((h) => ({ ...h, note: "never thanked yet" })),
  ];
  return (
    <Card>
      <CardHeader title="Haven't thanked in a while" subtitle="Only you see this. From your Lookout skill." icon={<Compass className="h-4 w-4 text-soil" />} />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink/75">Nobody right now: everyone you've thanked before heard from you in the last 30 days.</p>
      ) : (
        <ul className="px-5 pb-5">
          {rows.map((h) => (
            <li key={h.memberId} className="flex items-center gap-3 border-t border-parchment-deep py-2.5 first:border-t-0">
              <Avatar name={h.name} src={h.avatarUrl} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{h.name}</span>
              <span className="shrink-0 text-xs text-ink/75">{h.note}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The giver's earnings reply on the web ("+10 XP · +2 Hog coins"), led by the Hog coin (#101) when
 * it earned coins. Before the wallet opens (level 3) the reply has none, so no coin either.
 */
export function Earnings({ text }: { text: string }) {
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-soil">
      {/Hog coin/.test(text) && <HogCoin size={18} />}
      <span>{text}</span>
    </p>
  );
}

/**
 * The level-up hoggie beside a level-up DM on the web (#101): PostHog art from PostHog's servers,
 * nothing if it can't load. For DMs of gains labelled "Level up", and older `level_up` DMs.
 */
export function LevelUpHoggie({ label, category }: { label?: string; category?: string }) {
  if (label !== "Level up" && category !== "level_up") return null;
  return <RemoteArt slot="hoggie-level-up" fit="contain" className="float-right -mt-1 ml-3 h-16 w-16" />;
}

/**
 * What a bot message's event gained its member (#99): a level-up, a skill, an item, a new message
 * discovered. Shown under the message it rode along in, as the Slack DM shows it.
 */
export function GainLines({ lines }: { lines?: string[] }) {
  if (!lines || lines.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 border-t border-parchment-deep pt-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-1.5 text-sm text-soil">
          <Sprout className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
