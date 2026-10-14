import { IconMessage } from "@posthog/icons";
import { SlackLink } from "../SlackLink";
import type { MemberProfile } from "../shell";

export function hasGivenNoKudos(member: MemberProfile) {
  return member.lifetime.given === 0;
}

export function FirstKudosNudge({ member }: { member: MemberProfile }) {
  return (
    <section aria-labelledby="first-kudos-title" className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-muted-foreground bg-muted">
        <IconMessage aria-hidden="true" className="size-5 text-foreground" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <h2 id="first-kudos-title" className="hud-display text-lg font-bold leading-tight">
          Give your first kudos in Slack
        </h2>
        <p className="text-sm text-muted-foreground">{teachingFor(member)}</p>
        <div className="mt-2">
          <SlackLink chatUrl={member.chatUrl} variant="primary">
            Thank someone in Slack
          </SlackLink>
        </div>
      </div>
    </section>
  );
}

function teachingFor({ kudosEmoji, progression }: MemberProfile) {
  const how = `Mention a teammate in a Slack message with :${kudosEmoji}: and say why in five words or more.`;
  if (progression === null) return how;
  return `${how} Every kudos earns XP toward level ${progression.level + 1}.`;
}
