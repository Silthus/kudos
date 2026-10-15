import { IconTrending } from "@posthog/icons";

export function ClimbSummary({ text }: { text: string }) {
  return (
    <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm font-medium tabular-nums">
      <IconTrending aria-hidden="true" className="size-4" />
      {text}
    </p>
  );
}
