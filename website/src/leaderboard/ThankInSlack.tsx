import { IconExternal } from "@posthog/icons";
import { buttonVariants } from "@posthog/quill";

export function ThankInSlack({ chatUrl, variant }: { chatUrl: string; variant: "primary" | "outline" }) {
  return (
    <a href={chatUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant, size: "sm" })}>
      Thank someone in Slack <span className="sr-only">(opens in a new tab)</span>
      <IconExternal aria-hidden="true" className="size-4" />
    </a>
  );
}
