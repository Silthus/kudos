import { Switch } from "@posthog/quill";
import { Panel } from "../home/Panel";
import type { ShellActions, WeeklyPostReply, WeeklyPostSetting } from "../shell";
import { switchLook } from "./MessageSettingRow";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type WeeklyPostProps = { setting: WeeklyPostSetting; setWeeklyPost: ShellActions["setWeeklyPost"] };

const postNamed: Record<WeeklyPostSetting["posts"], string> = { groups: "last week's top groups", topKudos: "last week's top thoughtful kudos" };

const landedLines = { on: "Switched on. The next one goes out on Monday at 9:00.", off: "Switched off. Nothing goes out until you switch it on again." };

export function WeeklyPost({ setting, setWeeklyPost }: WeeklyPostProps) {
  const { on, timeZone, posts, channelLink, cantPost } = setting;
  const { pending, settled, choose } = useSentChoice(on, async (asked: boolean) => answerOf(await setWeeklyPost(asked)));
  return (
    <Panel id="weekly-post" label="Weekly post">
      <p className="text-sm text-muted-foreground">
        Every Monday at 9:00, {timeZone.replaceAll("_", " ")} time, I {on ? "post" : "can post"} {postNamed[posts]} in <AnnouncementChannel link={channelLink} />.
      </p>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold sm:max-w-sm">
        Post it every Monday
        <Switch size="sm" className={`${switchLook} shrink-0`} checked={on} disabled={pending} onCheckedChange={(asked) => void choose(asked)} />
      </label>
      <StatusLine line={lineAfter(settled, on ? landedLines.on : landedLines.off)} />
      {cantPost && <p className="text-sm text-muted-foreground">I can't post in the announcement channel. Add me to it, or pick another channel in App Home's Admin tab.</p>}
    </Panel>
  );
}

function AnnouncementChannel({ link }: { link: string | null }) {
  if (link === null) return <>the announcement channel</>;
  return (
    <a href={link} target="_blank" rel="noreferrer" className="ph-no-capture font-medium text-foreground underline underline-offset-2">
      the announcement channel
    </a>
  );
}

function answerOf(reply: WeeklyPostReply): Answer {
  if (reply.kind === "set") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
