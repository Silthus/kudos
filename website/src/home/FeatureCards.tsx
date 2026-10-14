import type { ComponentType, ReactNode } from "react";
import { HedgehogExplorer, HedgehogMoney, HedgehogOrganized, HedgehogReading, HedgehogStar, HedgehogWizard } from "@posthog/brand/hoggies";
import { IconExternal, IconLock, IconUnlock } from "@posthog/icons";
import { buttonVariants, Card, CardContent } from "@posthog/quill";
import { AppLink } from "../AppLink";
import type { Feature } from "../../../convex/unlocks/feature";
import { openWebPagesOf, webPageOf, type OpenWebPage } from "../features";
import type { FeatureCard, MemberProfile } from "../shell";

type Hoggie = ComponentType<{ size?: number; title?: string; className?: string }>;

type About = { sentence: string; Hog: Hoggie };

const about: Record<Feature, About> = {
  quests: { sentence: "Weekly quests of your own, and one your group takes on together.", Hog: HedgehogOrganized },
  leaderboard: { sentence: "See where you and your group stand.", Hog: HedgehogStar },
  book: { sentence: "Stickers from colleagues you thanked or who thanked you, and the achievements you collect.", Hog: HedgehogReading },
  skillTree: { sentence: "Perks you choose with skill points.", Hog: HedgehogWizard },
  coins: { sentence: "Coins you spend on hedgehogs and kudos emoji.", Hog: HedgehogMoney },
  hedgehogs: { sentence: "Hedgehogs to collect, and one to pick as your avatar.", Hog: HedgehogExplorer },
};

const plainLockedCards: { feature: Feature; name: string }[] = [
  { feature: "quests", name: "Quests" },
  { feature: "leaderboard", name: "Leaderboard" },
  { feature: "book", name: "Sticker book and achievements" },
  { feature: "skillTree", name: "Skill tree" },
  { feature: "coins", name: "Coins" },
  { feature: "hedgehogs", name: "Hedgehogs" },
];

export function FeatureCards({ member }: { member: MemberProfile }) {
  if (member.features === null) return <PlainCards member={member} />;
  const withState = (state: FeatureCard["state"]) => member.features!.filter((card) => card.state === state);
  return (
    <>
      <CardGroup id="ready-title" title="Ready for you">
        {withState("ready").map((card) => (
          <ReadyCard key={card.feature} {...card} />
        ))}
      </CardGroup>
      <CardGroup id="open-title" title="Open">
        {withState("open").map((card) => (
          <OpenCard key={card.feature} {...card} chatUrl={member.chatUrl} />
        ))}
      </CardGroup>
      <CardGroup id="still-locked-title" title="Still locked">
        {withState("locked").map((card) => (
          <LockedCard key={card.feature} feature={card.feature} name={card.name} status={`Unlocks at level ${card.level}`} />
        ))}
      </CardGroup>
    </>
  );
}

function PlainCards({ member }: { member: MemberProfile }) {
  const leaderboardOpen = member.leaderboard === "open";
  return (
    <>
      <CardGroup id="open-title" title="Open">
        {openWebPagesOf(member).map((page) => (
          <WebPageCard key={page.href} {...page} />
        ))}
      </CardGroup>
      <CardGroup id="still-locked-title" title="Still locked">
        {plainLockedCards
          .filter(({ feature }) => !leaderboardOpen || feature !== "leaderboard")
          .map((card) => (
            <LockedCard key={card.feature} {...card} status="Locked" />
          ))}
      </CardGroup>
    </>
  );
}

function CardGroup({ id, title, children }: { id: string; title: string; children: ReactNode[] | ReactNode }) {
  if ([children].flat().filter(Boolean).length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="hud-label">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function ReadyCard({ feature, name }: FeatureCard) {
  const { Hog } = about[feature];
  return (
    <article>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <span aria-hidden="true" className="shrink-0">
            <Hog size={48} title="" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-medium">{name}</h3>
            <p className="text-xs text-muted-foreground">{about[feature].sentence}</p>
            <p className="text-xs font-medium">Ready for you. Open it in Slack's App Home.</p>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function OpenCard({ feature, name, chatUrl }: FeatureCard & { chatUrl: string }) {
  const page = webPageOf(feature);
  if (page !== undefined) return <WebPageCard {...page} name={name} />;
  return (
    <article>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <OpenIcon Icon={IconUnlock} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <h3 className="text-sm font-medium">{name}</h3>
            <p className="text-xs text-muted-foreground">Open. Find it in Slack's App Home.</p>
            <a href={chatUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open Slack <span className="sr-only">(opens in a new tab)</span>
              <IconExternal aria-hidden="true" className="size-4" />
            </a>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function WebPageCard({ name, href, sentence, Icon }: OpenWebPage) {
  return (
    <AppLink href={href} className="rounded-xl">
      <Card size="sm" className="h-full hover:bg-fill-hover">
        <CardContent className="flex items-center gap-3">
          <OpenIcon Icon={Icon} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-medium">{name}</h3>
            <p className="text-xs text-muted-foreground">{sentence}</p>
          </div>
        </CardContent>
      </Card>
    </AppLink>
  );
}

function OpenIcon({ Icon }: { Icon: OpenWebPage["Icon"] }) {
  return (
    <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="size-5" />
    </span>
  );
}

function LockedCard({ feature, name, status }: { feature: Feature; name: string; status: string }) {
  const { sentence, Hog } = about[feature];
  return (
    <article>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <span aria-hidden="true" className="shrink-0">
            <Hog size={48} title="" className="opacity-25 brightness-0 dark:invert" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="text-sm font-medium">{name}</h3>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <IconLock aria-hidden="true" className="size-3" />
              {status}
            </span>
            <p className="text-xs text-muted-foreground">{sentence}</p>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}
