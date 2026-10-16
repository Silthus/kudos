import { Button } from "@posthog/quill";
import type { AvatarChoice } from "./avatarChoice";

export function YourAvatar({ choice: { current, pending, settled, line, choose } }: { choice: AvatarChoice }) {
  return (
    <section aria-label="Your avatar" className="flex flex-col gap-0.5 border-t pt-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs text-muted-foreground">{current === null ? "Pick a hoggie you hold to show it in place of your picture." : `${current.name} shows in place of your picture.`}</p>
        {current !== null && (
          <Button variant="link-muted" size="sm" disabled={pending} onClick={() => choose(null)}>
            Remove avatar
          </Button>
        )}
      </div>
      <p role="status" className={settled === "landed" || line === "" ? "sr-only" : "text-xs text-muted-foreground"}>
        {line}
      </p>
    </section>
  );
}
