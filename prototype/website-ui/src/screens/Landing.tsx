// PROTOTYPE deep-link landing: the page a member reaches from a link in Slack App Home, a message or a DM.
import { useState, type ComponentType, type ReactNode } from "react";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle, Progress } from "@posthog/quill";
import { IconBook, IconChevronRight, IconListTree, IconLock, IconPalette, IconRibbon, IconStar } from "@posthog/icons";
import { deepLinks, ladders, me } from "../data/mock";
import type { DeepLink } from "../data/types";
import { useNav, type ScreenId } from "../nav";
import { HedgehogHandClasp, HedgehogLevelUp, HedgehogReading, HedgehogStar, Rarity, rarityLabels, TierMedal, tierLabel } from "../ui";

type Kind = DeepLink["from"];
type Hog = ComponentType<{ size?: number; className?: string }>;

const kinds: Array<{ id: Kind; label: string }> = [
  { id: "app-home", label: "App Home" },
  { id: "level-up", label: "Level up" },
  { id: "kudos", label: "Kudos received" },
  { id: "achievement", label: "Achievement" },
];

const screenIds: ScreenId[] = ["profile", "skills", "stickers", "achievements", "collection", "leaderboard"];
const asScreen = (target: string): ScreenId => (screenIds.includes(target as ScreenId) ? (target as ScreenId) : "profile");
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

export function Landing({ param }: { param?: string }) {
  const link = deepLinks[param ?? ""] ?? deepLinks.kudos;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <PrototypePicker current={link.from} />
      {link.from === "level-up" && <LevelUp link={link} />}
      {link.from === "kudos" && <KudosReceived link={link} />}
      {link.from === "achievement" && <AchievementEarned link={link} />}
      {link.from === "app-home" && <AppHome link={link} />}
    </div>
  );
}

function PrototypePicker({ current }: { current: Kind }) {
  const { go } = useNav();
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-1">
        <span className="mr-1">Prototype: pick a deep link</span>
        {kinds.map((k) => (
          <Button key={k.id} variant={k.id === current ? "link" : "link-muted"} size="xs" aria-current={k.id === current} onClick={() => go("landing", k.id)}>
            {k.label}
          </Button>
        ))}
      </div>
      <p>A signed-out member first sees Sign in with Slack, then lands here.</p>
    </div>
  );
}

function Moment({ hog: Hog, title, description, primary, children }: { hog: Hog; title: ReactNode; description?: ReactNode; primary: { label: string; screen: ScreenId }; children: ReactNode }) {
  const { go } = useNav();
  const [leaving, setLeaving] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-col items-center gap-3 text-center">
        <Hog size={96} />
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={() => go(primary.screen)}>
          {primary.label}
        </Button>
        <Button variant="link" onClick={() => setLeaving(true)}>
          Back to Slack
        </Button>
        {leaving && <p className="text-xs text-muted-foreground">Prototype: this would return to Slack.</p>}
      </CardFooter>
    </Card>
  );
}

function LevelUp({ link }: { link: Extract<DeepLink, { from: "level-up" }> }) {
  const progress = ((me.xp - me.xpThisLevelStart) / (me.xpNextLevel - me.xpThisLevelStart)) * 100;
  return (
    <Moment hog={HedgehogLevelUp} title={`You reached level ${link.level}`} primary={{ label: "Spend skill points", screen: "skills" }}>
      <p className="text-center">You have {link.points} skill points to spend.</p>
      <div className="flex flex-col gap-1.5">
        <Progress value={progress} aria-label={`Progress to level ${link.level + 1}`} />
        <p className="text-center text-xs text-muted-foreground">
          Level {link.level + 1} is {link.nextXp} XP away.
        </p>
      </div>
    </Moment>
  );
}

function KudosReceived({ link }: { link: Extract<DeepLink, { from: "kudos" }> }) {
  const first = link.giver.name.split(" ")[0];
  return (
    <Moment
      hog={HedgehogHandClasp}
      title={`${first} thanked you`}
      primary={link.newSticker ? { label: "Open sticker book", screen: "stickers" } : { label: "See my profile", screen: "profile" }}
    >
      <figure className="flex flex-col gap-2 rounded-md bg-muted p-3">
        <blockquote>“{link.text}”</blockquote>
        <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{link.giver.name}</span>
          <span className="flex items-center gap-1">
            <IconLock className="size-3.5" /> Only you see this
          </span>
        </figcaption>
      </figure>
      <ul className="flex flex-col gap-1.5">
        {link.newSticker && <li>New sticker: {first} is in your sticker book.</li>}
        <li className="tabular-nums">+{link.coins} 🪙</li>
        {link.drop && (
          <li className="flex flex-wrap items-center gap-x-1.5">
            You found {article(rarityLabels[link.drop.rarity])} <Rarity rarity={link.drop.rarity} className="text-sm" /> {link.drop.kind}:
            <span className="font-medium">{link.drop.name}</span>
          </li>
        )}
      </ul>
    </Moment>
  );
}

function AchievementEarned({ link }: { link: Extract<DeepLink, { from: "achievement" }> }) {
  const ladder = ladders.find((l) => l.name === link.ladder);
  const next = ladder?.tiers.find((t) => !t.earned);
  return (
    <Moment hog={HedgehogStar} title="Achievement earned" primary={{ label: "See achievements", screen: "achievements" }}>
      <div className="flex items-center gap-3">
        <TierMedal tier={link.tier} earned size={36} />
        <p>
          You earned <span className="font-medium">{link.tierName}</span> ({link.ladder}, {link.tier}). It unlocked <span className="font-medium">{link.reward}</span>.
        </p>
      </div>
      {ladder && next && (
        <p className="text-xs text-muted-foreground">
          Next: {next.name} ({tierLabel[next.tier]}) at {next.threshold} {ladder.counts}. You're at {ladder.count}.
        </p>
      )}
    </Moment>
  );
}

const tour: Array<{ screen: ScreenId; Icon: ComponentType<{ className?: string }>; name: string; blurb: string }> = [
  { screen: "skills", Icon: IconListTree, name: "Skill tree", blurb: "Spend skill points on perks." },
  { screen: "stickers", Icon: IconBook, name: "Sticker book", blurb: "A sticker from everyone you thank." },
  { screen: "achievements", Icon: IconRibbon, name: "Achievements", blurb: "Twelve ladders, four tiers each." },
  { screen: "collection", Icon: IconPalette, name: "Collection", blurb: "Cards, quips and titles to wear." },
  { screen: "leaderboard", Icon: IconStar, name: "Leaderboard", blurb: "Groups compete on kudos given." },
];

function AppHome({ link }: { link: Extract<DeepLink, { from: "app-home" }> }) {
  return (
    <Moment
      hog={HedgehogReading}
      title={`Welcome, ${me.name.split(" ")[0]}`}
      description="App Home in Slack shows the quick stuff. Here there's room for the rest."
      primary={{ label: "Go to my profile", screen: asScreen(link.target) }}
    >
      <ItemGroup>
        {tour.map(({ screen, Icon, name, blurb }) => (
          <Item key={screen} size="sm" variant="pressable" render={<a href={`#/${screen}`} />}>
            <ItemMedia variant="icon">
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{name}</ItemTitle>
              <ItemDescription>{screen === "skills" && me.skillPointsUnspent > 0 ? `${me.skillPointsUnspent} skill points to spend.` : blurb}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <IconChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </Moment>
  );
}
