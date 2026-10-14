import { IconExternal } from "@posthog/icons";
import { Button } from "@posthog/quill";
import { KudosMessage } from "../activity/KudosMessage";
import { namesOf } from "../activity/People";
import { MemberFace } from "../Face";
import { MaxLine } from "../Max";
import type { SpotlightDraw, SpotlightKudos } from "../spotlightRead";
import { SidePanel } from "./SidePanel";
import { useSpotlight } from "./useSpotlight";

export function Spotlight({ draw }: { draw: SpotlightDraw }) {
  const { shown, notice, drawing, pressed, attempts, next, tryAgain } = useSpotlight(draw);
  if (shown === undefined || shown.kind === "hidden") return null;
  return (
    <SidePanel id="spotlight-title" label="A thank-you from your workspace">
      <div aria-live={pressed ? "polite" : undefined} aria-atomic={pressed || undefined} className="flex flex-col gap-3">
        {shown.kind === "kudos" && <ThankYou key={shown.kudos.after} kudos={shown.kudos} />}
        {shown.kind === "empty" && <MaxLine>Thank-yous from public channels show here.</MaxLine>}
        {shown.kind === "missed" && <MaxLine key={attempts}>Couldn't find a thank-you just now.</MaxLine>}
      </div>
      <p role="status" className={notice === undefined ? "sr-only" : "text-muted-foreground"}>
        {notice !== undefined && <span key={attempts}>{notice}</span>}
      </p>
      {shown.kind === "kudos" && <DrawButton drawing={drawing} onPress={next}>Next</DrawButton>}
      {shown.kind === "missed" && <DrawButton drawing={drawing} onPress={tryAgain}>Try again</DrawButton>}
    </SidePanel>
  );
}

function ThankYou({ kudos: { giver, recipients, message, at, permalink } }: { kudos: SpotlightKudos }) {
  return (
    <>
      <p className="flex items-center gap-3 font-medium">
        <MemberFace face={giver.face} className="size-8" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{`${giver.name} thanked ${namesOf(recipients)}`}</span>
      </p>
      <blockquote className="border-l-2 border-foreground/20 pl-3 text-base leading-relaxed">
        <KudosMessage message={message} clamped={false} />
      </blockquote>
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <When at={at} />
        {permalink !== null && <OpenInSlack permalink={permalink} giver={giver.name} />}
      </p>
    </>
  );
}

function OpenInSlack({ permalink, giver }: { permalink: string; giver: string }) {
  return (
    <a href={permalink} target="_blank" rel="noreferrer" aria-label={`Open in Slack: the kudos from ${giver} (opens in a new tab)`} className="inline-flex min-h-6 items-center gap-1 font-medium text-foreground underline underline-offset-4">
      Open in Slack
      <IconExternal aria-hidden="true" className="size-3.5" />
    </a>
  );
}

function DrawButton({ drawing, onPress, children }: { drawing: boolean; onPress: () => void; children: string }) {
  return (
    <Button variant="outline" size="sm" className="self-start" aria-disabled={drawing || undefined} onClick={onPress}>
      {children}
    </Button>
  );
}

const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const dayMonthAndYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

function When({ at }: { at: number }) {
  const date = new Date(at);
  const format = date.getFullYear() === new Date().getFullYear() ? dayAndMonth : dayMonthAndYear;
  return (
    <time dateTime={date.toISOString()} className="tabular-nums">
      {format.format(date)}
    </time>
  );
}
