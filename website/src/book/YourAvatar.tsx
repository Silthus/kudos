import { Button } from "@posthog/quill";
import type { AvatarChoice } from "./avatarChoice";

export function YourAvatar({ choice: { current, pending, settled, line, choose } }: { choice: AvatarChoice }) {
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
      <p role="status" className={settled === "landed" || line === "" ? "sr-only" : "text-sm text-muted-foreground"}>
        {line}
      </p>
    </section>
  );
}
