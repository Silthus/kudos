import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { Compass, Lock, Network, Sprout } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { CoinBalance } from "../../convex/lib/coins";
import { GARDEN_LEVEL } from "../../convex/lib/garden";
import { pointsOf, type Allocation } from "../../convex/lib/skills";
import { daysBetween } from "../../convex/lib/time";
import { nextLockedAreas, type LevelProgress } from "../../convex/lib/xp";
import { HogCoin } from "@/components/HogCoin";
import { RemoteArt } from "@/components/RemoteArt";
import { Avatar, Progress, Toggle } from "@/components/ui";

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
      className="flex items-start gap-3 border-2 border-dashed border-bark/40 bg-parchment-deep px-3.5 py-3 text-sm"
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink/70" aria-hidden />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-ink">{title}</span>
          <span className="pixel-chip bg-parchment px-1.5 text-[11px] font-semibold text-ink tabular">Level {level}</span>
        </div>
        <p className="mt-0.5 text-xs text-ink/75">{how}</p>
      </div>
    </div>
  );
}

/** "a, b and c". */
const inWords = (parts: string[]) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

/**
 * The Hog coin wallet (§G4), from level 3: the balance and where it came from, in a sentence.
 * Coins collected silently before level 3 are all in it the first time it appears.
 */
export function Wallet({ wallet }: { wallet: CoinBalance }) {
  const earned = [
    `${wallet.fromKudos} from thoughtful kudos`,
    wallet.fromFruit ? `${wallet.fromFruit} from garden fruit` : null,
    wallet.fromQuests ? `${wallet.fromQuests} from quests` : null,
    wallet.fromSprees ? `${wallet.fromSprees} from kudos sprees` : null,
    `${wallet.fromLevels} from level-ups`,
  ].filter((s): s is string => s !== null);
  const sentence = [
    `${inWords(earned)}.`,
    wallet.spent ? `You spent ${wallet.spent}.` : null,
    wallet.adjusted ? (wallet.adjusted > 0 ? `Admins added ${wallet.adjusted}.` : `Admins took back ${-wallet.adjusted}.`) : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div data-wallet role="group" aria-label={`Hog coins: ${wallet.balance}`} className="pixel-chip flex items-start gap-3 bg-lantern/15 px-3.5 py-3 text-sm">
      <HogCoin size={28} className="mt-0.5" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-medium text-ink tabular">{wallet.balance}</span>
          <span className="font-semibold text-ink">Hog coins</span>
        </div>
        <p className="mt-0.5 text-xs text-ink/75">{sentence}</p>
        {wallet.balance < 0 && (
          <p className="mt-1 text-xs text-ink/75">A revoked kudos took back coins it had earned. Spending waits until it's above zero again.</p>
        )}
      </div>
    </div>
  );
}

/** Your level, its title and how far it is to the next one, on a pixel meter. */
export function LevelPanel({ progress }: { progress: LevelProgress }) {
  const span = progress.next === null ? 1 : progress.next - progress.floor;
  const into = progress.next === null ? 1 : Math.max(0, progress.xp - progress.floor);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] font-medium leading-9 text-ink">Level {progress.level}</span>
          <span className="text-sm font-semibold text-soil">{progress.title}</span>
        </div>
        <span className="text-xs text-ink/75 tabular">{progress.xp} XP</span>
      </div>
      <Progress value={into} max={span} className="mt-2" height={12} />
      <div className="mt-1.5 text-xs text-ink/75">
        {progress.toNext === null ? "Top level reached" : `${progress.toNext} XP to level ${progress.level + 1}`}
      </div>
    </div>
  );
}

/** A way from the cabin to another place: a pixel-chip row with its name and one line. */
function Way({ to, icon, name, line }: { to: string; icon: ReactNode; name: string; line: string }) {
  return (
    <Link to={to} className="pixel-chip flex items-center gap-3 bg-parchment px-3.5 py-2.5 text-sm hover:bg-parchment-deep/60">
      <span className="shrink-0 text-soil">{icon}</span>
      <span className="font-semibold text-ink">{name}</span>
      <span className="min-w-0 flex-1 text-xs text-ink/75">{line}</span>
    </Link>
  );
}

/**
 * The game in your cabin: level, title and the next-level meter, the wallet from level 3, the
 * next areas ahead (locked), and the ways to your garden and skill tree. Before a member's first
 * kudos it only invites them to give; while hidden it says so. Nothing while the workspace doesn't
 * play the game. The switch that hides it is `GameSwitch`, by the cabin door.
 */
export function GameCard({ glyph }: { glyph: string }) {
  const game = useQuery(api.game.mine, {});
  const tree = useQuery(api.skills.mine, game?.player && !game.hidden ? {} : "skip");
  if (!game?.enabled) return null;
  if (game.hidden) {
    return <p className="text-sm text-ink/75">The game is hidden. Your kudos still earn XP and Hog coins. The switch by the door brings it back.</p>;
  }
  if (!game.player) {
    return (
      <div className="pixel-note px-4 py-3">
        <h4 className="flex items-center gap-2 font-display text-lg font-medium">
          <Sprout className="h-4 w-4 text-soil" aria-hidden />
          You can give kudos too
        </h4>
        <p className="mt-1 text-sm text-ink/75">
          Mention a teammate in Slack with {glyph} and a few words on why. Your first kudos starts your level, and thoughtful ones earn the most.
        </p>
      </div>
    );
  }
  const ahead = nextLockedAreas(game.player.level);
  const wallet = game.wallet ?? null;
  const available = tree ? pointsOf(tree.skills as Allocation, tree.level).available : null;
  return (
    <div className="space-y-3">
      <LevelPanel progress={game.player} />
      {(wallet || ahead.length > 0) && (
        <div className={clsx("grid gap-2", (wallet ? 1 : 0) + ahead.length > 1 && "@md:grid-cols-2")}>
          {wallet && <Wallet wallet={wallet} />}
          {ahead.map((a) => (
            <Locked key={a.key} title={a.title} level={a.level} how={a.how} />
          ))}
        </div>
      )}
      {game.player.level >= GARDEN_LEVEL && <Way to="/garden" icon={<Sprout className="h-4 w-4" aria-hidden />} name="Your garden" line="A plant for each teammate you recognise" />}
      {available !== null && (
        <Way
          to="/skills"
          icon={<Network className="h-4 w-4" aria-hidden />}
          name="Skill tree"
          line={available > 0 ? `${available} skill ${available === 1 ? "point" : "points"} to spend` : "Every level-up brings a skill point"}
        />
      )}
    </div>
  );
}

/** "Show the game": the small switch on the cabin wall. Hidden, kudos still earn. Nothing while the game is off. */
export function GameSwitch() {
  const game = useQuery(api.game.mine, {});
  const setHidden = useMutation(api.game.setHidden);
  if (!game?.enabled) return null;
  return (
    <Toggle
      label="Show the game"
      description="Your level, garden and quests in the world. Hidden, your kudos still earn XP and Hog coins."
      checked={!game.hidden}
      onChange={(show) => void setHidden({ hidden: !show })}
    />
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
    <div className="pixel-note px-4 py-3">
      <h4 className="flex items-center gap-2 font-display text-lg font-medium">
        <Compass className="h-4 w-4 text-soil" aria-hidden />
        Haven't thanked in a while
      </h4>
      <p className="text-xs text-ink/75">Only you see this. From your Lookout skill.</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink/75">Nobody right now: everyone you've thanked before heard from you in the last 30 days.</p>
      ) : (
        <ul className="mt-1">
          {rows.map((h) => (
            <li key={h.memberId} className="flex items-center gap-3 border-t border-parchment-deep py-2 first:border-t-0">
              <Avatar name={h.name} src={h.avatarUrl} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{h.name}</span>
              <span className="shrink-0 text-xs text-ink/75">{h.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
