// PROTOTYPE deep-link landing: what a member sees after clicking a Kudos link in Slack App Home, a message or a DM.
import { useState, type ReactNode } from "react";
import { deepLinks, ladders, me } from "../data/mock";
import type { DeepLink } from "../data/types";
import { useNav, type ScreenId } from "../nav";
import { Arrow, Avatar, Bubble, Button, Hand, Hog, Pill, Progress, Rarity, TierMedal } from "../ui";

type Kind = DeepLink["from"];

const kinds: Array<{ id: Kind; label: string }> = [
  { id: "app-home", label: "🏠 App Home" },
  { id: "level-up", label: "🎉 Level up" },
  { id: "kudos", label: "🙌 Kudos received" },
  { id: "achievement", label: "🏅 Achievement" },
];

const screenIds: ScreenId[] = ["profile", "skills", "stickers", "achievements", "collection", "leaderboard"];
const asScreen = (target: string): ScreenId => (screenIds.includes(target as ScreenId) ? (target as ScreenId) : "profile");

export function Landing({ param }: { param?: string }) {
  const link = deepLinks[param ?? ""] ?? deepLinks.kudos;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PrototypePicker current={link.from} />
      {link.from === "level-up" && <LevelUp link={link} />}
      {link.from === "kudos" && <KudosReceived link={link} />}
      {link.from === "achievement" && <AchievementEarned link={link} />}
      {link.from === "app-home" && <AppHomeTour link={link} />}
    </div>
  );
}

function PrototypePicker({ current }: { current: Kind }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-line-strong bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-faint">🧪 Prototype: pick a deep link</span>
        {kinds.map((k) => (
          <a
            key={k.id}
            href={`#/landing/${k.id}`}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${k.id === current ? "border-ink bg-surface text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"}`}
          >
            {k.label}
          </a>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Signed out? Clicking a deep link in Slack shows Sign in with Slack first, then lands right here.</p>
    </div>
  );
}

type Hero = {
  source: string;
  hog: ReactNode;
  bubble: ReactNode;
  title: ReactNode;
  primary: { label: string; screen: ScreenId };
  confetti?: boolean;
  children: ReactNode;
};

function Hero({ source, hog, bubble, title, primary, confetti, children }: Hero) {
  const { go } = useNav();
  const [leaving, setLeaving] = useState(false);
  return (
    <section className="relative overflow-hidden rounded-lg border border-line bg-surface shadow-ph">
      {confetti && <Confetti />}
      <div className="dotgrid relative flex flex-col items-center gap-4 border-b border-line px-5 pb-5 pt-6 sm:flex-row sm:items-end sm:px-8">
        <div className="flex shrink-0 flex-col items-center">
          <Bubble className="mb-3 max-w-[15rem] animate-pop text-center">{bubble}</Bubble>
          {hog}
        </div>
        <div className="min-w-0 flex-1 text-center sm:pb-3 sm:text-left">
          <div className="flex items-center justify-center gap-1 sm:justify-start">
            <Pill>🔗 {source}</Pill>
          </div>
          <h1 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl">{title}</h1>
        </div>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-8">{children}</div>
      <footer className="flex flex-col gap-3 border-t border-line bg-surface-2 px-5 py-4 sm:flex-row sm:items-center sm:px-8">
        <Button tone="orange" onClick={() => go(primary.screen)}>
          {primary.label} →
        </Button>
        <Button tone="plain" onClick={() => setLeaving(true)}>
          ← Back to Slack
        </Button>
        {leaving && <Hand className="text-lg sm:ml-auto">prototype: this would hop back to Slack 👋</Hand>}
      </footer>
    </section>
  );
}

function LevelUp({ link }: { link: Extract<DeepLink, { from: "level-up" }> }) {
  return (
    <Hero
      source="From your level-up DM"
      hog={<Hog size={120} mood="party" hat="party" className="animate-wiggle" />}
      bubble="Look at you go!"
      title={<>🎉 You reached <span className="marker">level {link.level}</span>!</>}
      primary={{ label: "Spend skill points", screen: "skills" }}
      confetti
    >
      <p className="text-lg font-semibold">
        You have {link.points} skill points to spend.
      </p>
      <div className="space-y-1.5">
        <Progress value={me.xp - me.xpThisLevelStart} max={me.xpNextLevel - me.xpThisLevelStart} />
        <div className="flex justify-between text-xs font-semibold text-muted">
          <span>Level {link.level}</span>
          <span>Level {link.level + 1} is {link.nextXp} XP away.</span>
        </div>
      </div>
      <p className="text-sm text-muted">Skill points buy perks in the skill tree. Pick whatever fits how you like to say thanks.</p>
    </Hero>
  );
}

function KudosReceived({ link }: { link: Extract<DeepLink, { from: "kudos" }> }) {
  const first = link.giver.name.split(" ")[0];
  return (
    <Hero
      source="From a Kudos DM in Slack"
      hog={<Hog size={110} mood="happy" />}
      bubble={<>Someone noticed! 💛</>}
      title={<>{link.giver.name} <span className="marker">thanked you</span> 🙌</>}
      primary={link.newSticker ? { label: "Open my sticker book", screen: "stickers" } : { label: "See my profile", screen: "profile" }}
    >
      <figure className="rounded-lg border border-line bg-surface-2 p-4">
        <figcaption className="flex flex-wrap items-center gap-2">
          <Avatar initials={link.giver.initials} hue={link.giver.hue} size={32} />
          <span className="font-bold">{link.giver.name}</span>
          <span className="ml-auto">
            <Pill>🔒 Only you see this page</Pill>
          </span>
        </figcaption>
        <blockquote className="mt-3 border-l-4 border-orange pl-3 text-base">“{link.text}”</blockquote>
      </figure>

      <div>
        <div className="mb-2 flex items-center gap-1">
          <Hand className="-rotate-2">and you got stuff!</Hand>
          <Arrow className="h-6 w-10" />
        </div>
        <ul className="space-y-2">
          {link.newSticker && (
            <Reward icon={<span className="inline-block rotate-[-6deg] rounded-md border-2 border-dashed border-line-strong bg-surface p-1"><Avatar initials={link.giver.initials} hue={link.giver.hue} size={26} /></span>}>
              📒 New sticker: {first}'s sticker is in your sticker book.
            </Reward>
          )}
          <Reward icon={<span className="text-2xl">🪙</span>}>
            +{link.coins} 🪙 <span className="font-normal text-muted">for the store</span>
          </Reward>
          {link.drop && (
            <Reward icon={<span className="text-2xl">🃏</span>}>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                ✨ You found {/^[aeiou]/.test(link.drop.rarity) ? "an" : "a"} <Rarity rarity={link.drop.rarity} className="text-sm" /> {link.drop.kind}: <span className="font-bold">{link.drop.name}</span>
                <a href="#/collection" className="ml-1 text-xs font-semibold text-orange underline decoration-dotted underline-offset-2">
                  see it in your collection
                </a>
              </span>
            </Reward>
          )}
        </ul>
      </div>
    </Hero>
  );
}

function Reward({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex animate-pop items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold">
      <span className="flex w-10 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function AchievementEarned({ link }: { link: Extract<DeepLink, { from: "achievement" }> }) {
  const ladder = ladders.find((l) => l.name === link.ladder);
  const next = ladder?.tiers.find((t) => !t.earned);
  return (
    <Hero
      source="From an achievement DM"
      hog={
        <div className="relative">
          <Hog size={110} mood="happy" hat="crown" />
          <span className="absolute -right-6 bottom-2 animate-pop">
            <TierMedal tier={link.tier} earned size={56} />
          </span>
        </div>
      }
      bubble="Shiny! That one's going on the shelf."
      title={
        <>
          <span className="marker">Achievement unlocked</span>, nice one!
        </>
      }
      primary={{ label: "See my achievements", screen: "achievements" }}
    >
      <p className="text-lg">
        🏅 You earned <span className="font-bold">{link.tierName}</span> ({link.ladder}, {link.tier}). It unlocked <span className="font-bold">{link.reward}</span>.
      </p>
      {ladder && next && (
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-center gap-3">
            <TierMedal tier={next.tier} earned={false} size={36} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-bold">Next up: {next.name}</div>
              <div className="text-muted">
                {next.threshold} {ladder.counts}. You're at {ladder.count}.
              </div>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={ladder.count} max={next.threshold} tone="yellow" height={10} />
          </div>
        </div>
      )}
    </Hero>
  );
}

const tour: Array<{ screen: ScreenId; icon: string; name: string; blurb: string }> = [
  { screen: "skills", icon: "🌱", name: "Skill tree", blurb: "Spend skill points on perks." },
  { screen: "stickers", icon: "📒", name: "Sticker book", blurb: "Collect a sticker from everyone you thank." },
  { screen: "collection", icon: "🎒", name: "Collection", blurb: "Try on cards, quips and titles." },
  { screen: "achievements", icon: "🏅", name: "Achievements", blurb: "Twelve ladders, four tiers each." },
  { screen: "leaderboard", icon: "🏆", name: "Leaderboard", blurb: "Groups compete on kudos given." },
];

function AppHomeTour({ link }: { link: Extract<DeepLink, { from: "app-home" }> }) {
  return (
    <Hero
      source="From Kudos in Slack App Home"
      hog={<Hog size={110} mood="wave" />}
      bubble={<>Hi {me.name.split(" ")[0]}! Come on in.</>}
      title={
        <>
          Welcome to the <span className="marker">Kudos website</span> 👋
        </>
      }
      primary={{ label: "Go to my profile", screen: asScreen(link.target) }}
    >
      <p className="text-muted">App Home shows the quick stuff. In here there's room for the rest:</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {tour.map((t) => (
          <li key={t.screen}>
            <a href={`#/${t.screen}`} className="flex items-start gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5 hover:border-line-strong">
              <span className="text-xl">{t.icon}</span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-bold">
                  {t.name}
                  {t.screen === "skills" && me.skillPointsUnspent > 0 && <Pill tone="orange">{me.skillPointsUnspent} to spend</Pill>}
                </span>
                <span className="block text-sm text-muted">{t.blurb}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </Hero>
  );
}

const confettiColours = ["var(--orange)", "var(--yellow)", "var(--blue)", "var(--green)", "var(--lemon)", "var(--violet)"];

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-72 overflow-hidden motion-reduce:hidden" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="absolute block"
          style={{
            left: `${(i * 37) % 100}%`,
            top: -16,
            width: i % 3 === 0 ? 8 : 6,
            height: i % 3 === 0 ? 8 : 12,
            borderRadius: i % 3 === 0 ? 9999 : 2,
            background: confettiColours[i % confettiColours.length],
            animation: `confetti-fall ${2.4 + (i % 5) * 0.4}s linear ${(i % 7) * 0.35}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
