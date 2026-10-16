import { IconExternal } from "@posthog/icons";
import { timeOf } from "./days";

export function When({ at, timeZone, className = "" }: { at: number; timeZone: string | undefined; className?: string }) {
  return (
    <time dateTime={new Date(at).toISOString()} className={`shrink-0 text-xs text-muted-foreground tabular-nums ${className}`}>
      {timeOf(at, timeZone)}
    </time>
  );
}

export function OpenInSlack({ permalink, name, className = "text-sm" }: { permalink: string; name: string; className?: string }) {
  return (
    <a href={permalink} target="_blank" rel="noreferrer" className={`inline-flex min-h-6 items-center gap-1 font-medium underline-offset-4 hover:underline ${className}`}>
      Open in Slack
      <span className="sr-only">{`: ${name} (opens in a new tab)`}</span>
      <IconExternal aria-hidden="true" className="size-3.5" />
    </a>
  );
}
