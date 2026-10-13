// Variant E deep-link landings: one celebratory moment per Slack link, a cover band over a HUD panel, including the moment a feature unlocks; locked features stay locked in every moment.
import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Button } from "@posthog/quill";
import { HedgehogHeart, HedgehogLevelUp, HedgehogMagnifyingGlass, HedgehogReading, HedgehogStampApproved } from "@posthog/brand/hoggies";
import { IconArrowRight, IconCheck, IconLock, IconRefresh, IconUnlock } from "@posthog/icons";
import { useNav, type ScreenId } from "../../nav";
import { Rarity, TierMedal, tierLabel } from "../../ui";
import type { Rarity as RarityKind } from "../../data/types";
import { CoinGlyph, ResourceChip, SkillPointGlyph, useHud } from "../b/hud";
import { hedgehogs, sourceLabel, useHogs } from "./hedgehogs";
import { Chest, Egg, useBeat, useOpenable } from "./moments-chest";
import { achievement, asMomentKind, asUnlockFeature, discovery, kudos, levelUp, momentKinds, newHogId, tour, unlockMoments, type MomentKind, type TourStop } from "./moments-data";
import { featureLook, nextUnlock, unlocksAtLevel } from "./unlock-features";
import { setPreviewLevel, unlockOf, unlocks, usePreviewLevel, useUnlocked, type Feature, type Unlock } from "./unlocks";
import "./moments.css";

type Ink = "tangerine" | "lemon" | "blue";
type HogArt = ComponentType<{ size?: number; className?: string; title?: string }>;
type Primary = { label: string; onClick: () => void; done?: boolean };

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function Moments({ param }: { param?: string }) {
  useHud();
  const kind = asMomentKind(param);
  const [run, setRun] = useState(0);
  const replay = () => setRun((r) => r + 1);
  const Moment = moments[kind];
  const feature = kind === "unlock" ? unlockSegment() : undefined;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Picker current={kind} feature={feature} />
      <Moment key={`${kind}-${feature}-${run}`} onReplay={replay} />
    </div>
  );
}

type MomentProps = { onReplay: () => void };

const moments: Record<MomentKind, ComponentType<MomentProps>> = {
  "level-up": LevelUpMoment,
  unlock: UnlockMoment,
  achievement: AchievementMoment,
  discovery: DiscoveryMoment,
  hedgehog: HedgehogMoment,
  kudos: KudosMoment,
  "app-home": AppHomeMoment,
};

const unlockSegment = () => asUnlockFeature(location.hash.replace(/^#\/?/, "").split("/")[2]);

function Picker({ current, feature }: { current: MomentKind; feature?: Feature }) {
  return (
    <nav aria-label="Prototype moments" className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Prototype: pick a moment</span>
        {momentKinds.map((k) => (
          <a key={k.id} href={`#/landing/${k.id}`} aria-current={k.id === current ? "page" : undefined} className={k.id === current ? "font-semibold text-foreground underline underline-offset-4" : "hover:text-foreground hover:underline hover:underline-offset-4"}>
            {k.label}
          </a>
        ))}
      </div>
      {feature && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>Unlock:</span>
          {unlocks.map((u) => (
            <a key={u.feature} href={`#/landing/unlock/${u.feature}`} aria-current={u.feature === feature ? "page" : undefined} className={u.feature === feature ? "font-semibold text-foreground underline underline-offset-4" : "hover:text-foreground hover:underline hover:underline-offset-4"}>
              {u.name} · {u.level}
            </a>
          ))}
        </div>
      )}
      <p>A signed-out member first sees Sign in with Slack, then lands here.</p>
    </nav>
  );
}

function MomentShell({ ink, kicker, aside, headline, hog: Hog, stage, primary, onReplay, children }: { ink: Ink; kicker: string; aside?: ReactNode; headline: ReactNode; hog?: HogArt; stage?: ReactNode; primary: Primary; onReplay: () => void; children: ReactNode }) {
  return (
    <article className="hud-panel relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <section className={`mo-band mo-band-${ink} px-5 pb-8 pt-6 md:px-10 md:pb-10 md:pt-8`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span className="hud-label" style={{ color: "inherit", opacity: 0.8 }}>
            {kicker}
          </span>
          {aside}
        </div>
        <div className="mt-4 flex items-end gap-4">
          <h1 className="mo-headline mo-headline-in min-w-0 flex-1 text-[clamp(2.5rem,9vw,5rem)]">{headline}</h1>
          {Hog && <Hog size={200} className="mo-hog h-auto w-20 shrink-0 sm:w-28 md:w-36" title="" />}
        </div>
        {stage && <div className="mt-8 flex justify-center">{stage}</div>}
      </section>
      <div className="flex flex-col gap-5 p-5 md:p-8">
        {children}
        <Actions primary={primary} onReplay={onReplay} />
      </div>
    </article>
  );
}

function Actions({ primary, onReplay }: { primary: Primary; onReplay: () => void }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="flex flex-col gap-2 border-t pt-5">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center justify-center gap-1 sm:justify-start">
          <Button variant="link-muted" size="sm" onClick={() => setLeaving(true)}>
            Back to Slack
          </Button>
          <Button variant="link-muted" size="sm" onClick={onReplay}>
            <IconRefresh className="size-3.5" />
            Replay
          </Button>
        </div>
        <Button variant={primary.done ? "outline" : "primary"} className="sm:ml-auto" onClick={primary.onClick} disabled={primary.done}>
          {primary.done && <IconCheck className="size-4" />}
          {primary.label}
          {!primary.done && <IconArrowRight className="size-4" />}
        </Button>
      </div>
      {leaving && <p className="text-center text-xs text-muted-foreground sm:text-left">Prototype: this would return to Slack.</p>}
    </div>
  );
}

function useGo() {
  const { go } = useNav();
  return (screen: ScreenId, param?: string) => () => go(screen, param);
}

function Count({ to, at }: { to: number; at: number }) {
  return (
    <>
      <span className="mo-count tabular-nums" style={{ "--to": to, ...delay(at) } as CSSProperties} aria-hidden />
      <span className="sr-only">{to}</span>
    </>
  );
}

function LevelTicker({ from, to }: { from: number; to: number }) {
  return (
    <span className="mo-tick-wrap">
      <span className="mo-tick-burst" aria-hidden />
      <span className="mo-tick-ring" aria-hidden />
      <span className="mo-tick" aria-hidden>
        <span className="mo-tick-reel">
          <span>{from}</span>
          <span>{to}</span>
        </span>
      </span>
      <span className="sr-only">{to}</span>
    </span>
  );
}

function LevelUpMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const reached = Math.max(2, usePreviewLevel());
  const next = reached + 1;
  const skills = unlockOf("skills");
  const treeOpen = reached >= skills.level;
  const opened = unlocksAtLevel(reached);
  const pointsLine = !treeOpen
    ? `Skill points wait for you until the skill tree opens at level ${skills.level}.`
    : reached === skills.level
      ? "The skill tree is open, and every skill point you banked is ready to spend."
      : reached === levelUp.to
      ? `You have ${levelUp.pointsToSpend} skill points to spend.`
      : "Your new skill point is ready to spend.";
  return (
    <MomentShell
      ink="tangerine"
      kicker="Level up"
      headline={
        <>
          You reached level <LevelTicker from={reached - 1} to={reached} />
        </>
      }
      hog={HedgehogLevelUp}
      primary={treeOpen ? { label: "Spend skill points", onClick: to("skills") } : { label: "Go to my profile", onClick: to("profile") }}
      onReplay={onReplay}
      stage={
        <div className="w-full max-w-xl">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="mo-in font-semibold uppercase tracking-[0.18em]" style={delay(1.1)}>
              Level {reached}
            </span>
            <span className="mo-in" style={delay(1.7)}>
              <span className="font-semibold tabular-nums">{levelUp.xpToNext} XP</span> to level {next}
            </span>
          </div>
          <div className="mo-xp-track mt-2" role="progressbar" aria-valuenow={levelUp.barAfter} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to level ${next}`}>
            <div className="mo-xp-fill" style={{ "--from": `${levelUp.barBefore}%`, "--to": `${levelUp.barAfter}%` } as CSSProperties} />
            <div className="mo-xp-flash" />
          </div>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
        <span className="mo-fly inline-flex" style={{ ...delay(1.55), "--fy": "-110px" } as CSSProperties}>
          <ResourceChip icon={<SkillPointGlyph />} title={treeOpen ? "Skill point gained" : "Skill point banked"}>
            +{levelUp.pointsGained} skill point{treeOpen ? "" : ", banked"}
          </ResourceChip>
        </span>
        <p className="mo-in text-sm md:text-base" style={delay(2.1)}>
          {pointsLine} Level {next} is <span className="tabular-nums">{levelUp.xpToNext}</span> XP away.
        </p>
      </div>
      {opened.length > 0 && <OpenedAtLevel level={reached} opened={opened} />}
    </MomentShell>
  );
}

function OpenedAtLevel({ level, opened }: { level: number; opened: Unlock[] }) {
  return (
    <section className="mo-in flex flex-col gap-2" style={delay(2.4)} aria-label={`Level ${level} unlocks`}>
      <span className="hud-label">Level {level} unlocks</span>
      <ul className="flex flex-col gap-2">
        {opened.map((u) => {
          const { Icon } = featureLook[u.feature];
          return (
            <li key={u.feature}>
              <a href={`#/landing/unlock/${u.feature}`} className="hud-lift flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-fill-hover">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.teaser}</span>
                </span>
                <IconArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const unlockInk: Record<Feature, Ink> = { book: "lemon", gear: "blue", skills: "tangerine", coins: "lemon", collection: "blue" };

function UnlockMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const feature = unlockSegment();
  const unlock = unlockOf(feature);
  const facts = unlockMoments[feature];
  const { Icon, Hog, screen, param } = featureLook[feature];
  const open = useBeat(1100);
  const level = usePreviewLevel();
  const after = nextUnlock(unlock.level);
  useEffect(() => {
    if (level < unlock.level) setPreviewLevel(unlock.level);
  }, [level, unlock.level]);
  return (
    <MomentShell
      ink={unlockInk[feature]}
      kicker={`Unlocked at level ${unlock.level}`}
      headline={facts.headline}
      hog={Hog}
      primary={{ label: facts.cta, onClick: to(screen, param) }}
      onReplay={onReplay}
      stage={
        <Chest
          open={open}
          width={168}
          label={`Unlocked: ${unlock.name}`}
          item={
            <div className="mb-1 flex w-[min(19rem,80vw)] items-start gap-3 rounded-2xl bg-card p-4 text-left text-card-foreground shadow-xl">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <IconUnlock className="size-3.5 shrink-0" />
                  {unlock.name}
                </span>
                <span className="text-xs leading-snug text-muted-foreground">{unlock.teaser}</span>
              </span>
            </div>
          }
        />
      }
    >
      <section className="flex flex-col gap-2.5" aria-label="Waiting for you">
        <span className="hud-label">Waiting for you</span>
        <ul className="flex flex-col gap-2">
          {facts.waiting.map((line, i) => (
            <li key={line} className="mo-in flex items-start gap-2.5 text-sm md:text-base" style={delay(1.2 + i * 0.15)}>
              <IconCheck className="mt-1 size-4 shrink-0 text-muted-foreground" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mo-in text-sm text-muted-foreground" style={delay(1.6)}>
          {unlock.how}
        </p>
      </section>
      {after && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconLock className="size-3.5 shrink-0" />
          Next: {after.name} at level {after.level}
        </p>
      )}
    </MomentShell>
  );
}

function FoundCard({ preview, name, kind, rarity }: { preview: string; name: string; kind: string; rarity: RarityKind }) {
  return (
    <div className={`mo-glow-${rarity === "rare" ? "rare" : "uncommon"} flex items-center gap-3 rounded-xl bg-card px-3.5 py-2.5 text-left text-card-foreground shadow-lg`}>
      <span className="text-3xl leading-none">{preview}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">{name}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {kind} <Rarity rarity={rarity} />
        </span>
      </span>
    </div>
  );
}

function AchievementMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const bookOpen = useUnlocked("book");
  const open = useBeat(1250);
  const { reward } = achievement;
  return (
    <MomentShell
      ink="lemon"
      kicker={`Achievement · ${achievement.ladder}`}
      headline={`You earned ${achievement.name}`}
      hog={HedgehogStampApproved}
      primary={bookOpen ? { label: "See achievements", onClick: to("achievements") } : { label: "Go to my profile", onClick: to("profile") }}
      onReplay={onReplay}
      stage={
        <div className="flex flex-wrap items-end justify-center gap-x-8 gap-y-6 sm:gap-x-14">
          <div className="flex flex-col items-center gap-2">
            <div className="mo-plaque-shake">
              <div className="mo-plaque size-28 sm:size-32">
                <span className="mo-plaque-dust" aria-hidden />
                <span className="mo-stamp inline-flex">
                  <TierMedal tier={achievement.tier} earned size={84} />
                </span>
              </div>
            </div>
            <span className="text-sm font-semibold">
              {tierLabel[achievement.tier]} · {achievement.ladder}
            </span>
          </div>
          <Chest open={open} width={136} label={`Reward: ${reward.name}`} item={<FoundCard {...reward} />} />
        </div>
      }
    >
      <p className="mo-in text-sm md:text-base" style={delay(2)}>
        {achievement.counts}. The <span className="font-semibold">{reward.name}</span> {reward.kind.toLowerCase()} is in your inventory.
      </p>
    </MomentShell>
  );
}

function DiscoveryMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const gear = unlockOf("gear");
  const gearOpen = useUnlocked("gear");
  const { open, openNow } = useOpenable(1600);
  return (
    <MomentShell
      ink="blue"
      kicker={`Drop · ${discovery.foundWhile}`}
      headline={`You found a new ${discovery.kind.toLowerCase()}`}
      hog={HedgehogMagnifyingGlass}
      primary={gearOpen ? { label: "Equip it", onClick: to("profile", "inventory") } : { label: "Go to my profile", onClick: to("profile") }}
      onReplay={onReplay}
      stage={
        <Chest
          open={open}
          onOpen={openNow}
          width={200}
          label="Open the chest"
          tapHint="Tap to open"
          item={
            <div className="mo-glow-rare mb-1 w-[min(18rem,78vw)] rounded-2xl bg-card p-4 text-left text-card-foreground shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <span className="hud-label">{discovery.kind}</span>
                <Rarity rarity={discovery.rarity} />
              </div>
              <p className="mo-headline mt-2 text-2xl md:text-3xl">“{discovery.text}”</p>
            </div>
          }
        />
      }
    >
      {open ? (
        <p className="mo-in text-sm md:text-base" style={delay(0.9)}>
          {gearOpen ? "A new quip for your inventory. Equip it and it can ride along on the kudos you give." : `A new quip. It waits for you until your inventory opens at level ${gear.level}.`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground md:text-base">Something dropped while you gave kudos.</p>
      )}
    </MomentShell>
  );
}

function HedgehogMoment({ onReplay }: MomentProps) {
  const { equipped, equip } = useHogs();
  const { open, openNow } = useOpenable(1300);
  const hog = hedgehogs.find((h) => h.id === newHogId) ?? hedgehogs[0];
  const isAvatar = equipped.id === hog.id;
  return (
    <MomentShell
      ink="lemon"
      kicker="New hedgehog"
      headline="A new hedgehog joined you"
      primary={isAvatar ? { label: "It's your avatar", onClick: () => {}, done: true } : { label: "Make it my avatar", onClick: () => equip(hog.id) }}
      onReplay={onReplay}
      stage={<Egg open={open} onOpen={openNow} width={168} label="Hatch the egg" tapHint="Tap to hatch" item={<hog.Art size={220} title={hog.name} className={`h-auto w-44 mo-hog-glow-${hog.rarity}`} />} />}
    >
      <div className={`flex flex-col gap-1 ${open ? "mo-in" : "invisible"}`} style={delay(0.8)}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="hud-display text-2xl font-bold">{hog.name}</span>
          <Rarity rarity={hog.rarity} />
        </div>
        <p className="text-sm text-muted-foreground">
          {sourceLabel(hog.source)}. {isAvatar ? `${hog.name} is your avatar everywhere in HedgeHug.` : "Make it your avatar and teammates see it on your profile card."}
        </p>
      </div>
    </MomentShell>
  );
}

function KudosMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const book = unlockOf("book");
  const bookOpen = useUnlocked("book");
  const coinsOpen = useUnlocked("coins");
  const open = useBeat(1850);
  return (
    <MomentShell
      ink="tangerine"
      kicker="Kudos"
      aside={
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
          <IconLock className="size-3.5" />
          Only you see this
        </span>
      }
      headline={`${kudos.first} thanked you`}
      hog={HedgehogHeart}
      primary={bookOpen ? { label: "Open sticker book", onClick: to("stickers") } : { label: "Go to my profile", onClick: to("profile") }}
      onReplay={onReplay}
      stage={
        <figure className="mo-in flex w-full flex-col gap-3" style={delay(0.4)}>
          <blockquote className="mo-headline text-[clamp(1.35rem,4.5vw,2.1rem)] leading-[1.1]">“{kudos.text}”</blockquote>
          <figcaption className="text-sm">
            <span className="font-semibold">{kudos.giver}</span>
            <span className="opacity-75"> · just now</span>
          </figcaption>
        </figure>
      }
    >
      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
        <ul className="flex flex-col gap-2.5">
          <li className="mo-chip-pop flex items-center gap-3" style={delay(0.85)}>
            <ResourceChip icon={<SkillPointGlyph className="size-3.5 text-primary" />} title="XP gained">
              <span>
                +<Count to={kudos.xp} at={0.85} /> XP
              </span>
            </ResourceChip>
          </li>
          {coinsOpen && (
            <li className="mo-chip-pop flex items-center gap-3" style={delay(1.1)}>
              <ResourceChip icon={<CoinGlyph />} title="Coins gained">
                <span>
                  +<Count to={kudos.coins} at={1.1} /> coins
                </span>
              </ResourceChip>
            </li>
          )}
          <li className="flex items-center gap-3">
            <span className="mo-sticker inline-flex size-10 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md ring-1 ring-black/10" style={{ background: `hsl(${kudos.hue} 70% 48%)`, ...delay(1.35) }} aria-hidden>
              {kudos.initials}
            </span>
            <span className="mo-in text-sm" style={delay(1.45)}>
              {bookOpen ? (
                <>
                  New sticker: <span className="font-semibold">{kudos.first}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{kudos.first}</span>'s sticker waits for the Book, which opens at level {book.level}
                </>
              )}
            </span>
          </li>
        </ul>
        <div className="mo-in isolate flex flex-col items-center gap-4 overflow-hidden rounded-xl bg-muted px-6 pb-4 pt-3" style={{ ...delay(1.5), "--mo-ray": "var(--border)" } as CSSProperties}>
          <span className="hud-label">You found</span>
          <Chest open={open} width={104} label={`Found: ${kudos.drop.name}`} item={<FoundCard {...kudos.drop} />} />
        </div>
      </div>
    </MomentShell>
  );
}

function AppHomeMoment({ onReplay }: MomentProps) {
  const to = useGo();
  const level = usePreviewLevel();
  return (
    <MomentShell ink="blue" kicker="From App Home" headline="There's more here than App Home" hog={HedgehogReading} primary={{ label: "Go to my profile", onClick: to("profile") }} onReplay={onReplay}>
      <div className="flex flex-col gap-3">
        <span className="hud-label">What's here</span>
        <ul className="grid gap-1 sm:grid-cols-2">
          {tour.map((stop, i) => (
            <li key={stop.href} className="mo-in" style={delay(0.3 + i * 0.08)}>
              <TourEntry {...stop} level={level} />
            </li>
          ))}
        </ul>
      </div>
    </MomentShell>
  );
}

function TourEntry({ href, label, blurb, Icon, feature, level }: TourStop & { level: number }) {
  const unlock = feature && unlockOf(feature);
  if (unlock && level < unlock.level)
    return (
      <span role="link" aria-disabled="true" className="flex items-start gap-3 rounded-lg p-2.5 text-muted-foreground">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed bg-muted">
          <IconLock className="size-4" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{label}</span>
          <span className="text-xs">Unlocks at level {unlock.level}</span>
        </span>
      </span>
    );
  return (
    <a href={href} className="hud-lift flex items-start gap-3 rounded-lg p-2.5 hover:bg-fill-hover">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-card">
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{blurb}</span>
      </span>
    </a>
  );
}
