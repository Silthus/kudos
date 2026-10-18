import { IconExternal } from "@posthog/icons";
import { buttonVariants } from "@posthog/quill";
import type { ReactNode } from "react";

type SlackLinkProps = { chatUrl: string; variant: "primary" | "outline"; size?: "default" | "sm" | "lg"; children: ReactNode };

export function SlackLink({ chatUrl, variant, size = "sm", children }: SlackLinkProps) {
  return (
    <a href={chatUrl} target="_blank" rel="noreferrer" className={`ph-no-capture ${buttonVariants({ variant, size })}`}>
      {children} <span className="sr-only">(opens in a new tab)</span>
      <IconExternal aria-hidden="true" className="size-4" />
    </a>
  );
}
