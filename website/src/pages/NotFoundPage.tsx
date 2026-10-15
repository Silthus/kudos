import { buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { MaxSays } from "../Max";

export function NotFoundPage() {
  return (
    <MaxSays
      title="Page not found"
      tab="Not found"
      action={
        <AppLink href="/" className={buttonVariants({ variant: "outline" })}>
          Back to your profile
        </AppLink>
      }
    >
      There's nothing here, so let's head back home.
    </MaxSays>
  );
}
