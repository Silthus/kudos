import type { ReactNode } from "react";
import { IconLock, IconUnlock } from "@posthog/icons";
import { Card, CardContent } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { Crate } from "../crates/Crate";
import { featureCardAttributes } from "../crates/moments";
import { aboutOf, plainFeatures, webPageOf, type OpenWebPage } from "../features";
import { openFeaturePagesOf } from "../nav/entries";
import type { Feature, FeatureCard, MemberProfile } from "../shell";
import { SlackLink } from "../SlackLink";

export function FeatureCards({ member }: { member: MemberProfile }) {
  const { features } = member;
  if (features === null) return <PlainCards member={member} />;
  const withState = (state: FeatureCard["state"]) => features.filter((card) => card.state === state);
  return (
    <>
      <CardGroup id="ready-title" title="Ready for you">
        {withState("ready").map((card) => (
          <Crate key={card.feature} card={card} heading="h3" open="outline" artWidth={72} />
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
  const leaderboardOpen = member.leaderboard.kind === "open";
  return (
    <>
      <CardGroup id="open-title" title="Open">
        {openFeaturePagesOf(member).map((page) => (
          <WebPageCard key={page.href} {...page} />
        ))}
      </CardGroup>
      <CardGroup id="still-locked-title" title="Still locked">
        {plainFeatures
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

function OpenCard({ feature, name, chatUrl }: FeatureCard & { chatUrl: string }) {
  const page = webPageOf(feature);
  if (page !== undefined) return <WebPageCard {...page} feature={feature} name={name} />;
  return (
    <article tabIndex={-1} className="rounded-xl" {...featureCardAttributes(feature)}>
      <Card size="sm" className="h-full">
        <CardContent className="flex items-center gap-3">
          <OpenIcon Icon={IconUnlock} />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <h3 className="text-sm font-medium">{name}</h3>
            <p className="text-xs text-muted-foreground">Open. Find it in Slack's App Home.</p>
            <SlackLink chatUrl={chatUrl} variant="outline">
              Open Slack
            </SlackLink>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

function WebPageCard({ feature, name, href, sentence, Icon }: OpenWebPage) {
  return (
    <AppLink href={href} className="rounded-xl" {...featureCardAttributes(feature)}>
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
  const { sentence, Hog } = aboutOf(feature);
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
