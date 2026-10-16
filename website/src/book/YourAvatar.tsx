import { Button } from "@posthog/quill";
import { StatusLine } from "../settings/StatusLine";
import type { AvatarChoice } from "./avatarChoice";

export function YourAvatar({ choice: { current, pending, line, choose } }: { choice: AvatarChoice }) {
  return (
    <section aria-label="Your avatar" className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-sm text-muted-foreground">{current === null ? "Pick a hoggie you hold to show it in place of your Slack picture." : `${current.name} shows in place of your Slack picture.`}</p>
        {current !== null && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => choose(null)}>
            Remove avatar
          </Button>
        )}
      </div>
      <StatusLine line={line} />
    </section>
  );
}
