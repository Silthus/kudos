import { AppLink } from "../AppLink";
import { MaxSays } from "../Max";

export function NotFoundPage() {
  return (
    <MaxSays
      title="Page not found"
      tab="Not found"
      action={
        <AppLink href="/" className="text-sm font-medium underline underline-offset-4">
          Go to Home
        </AppLink>
      }
    >
      There's nothing here, so let's head back home.
    </MaxSays>
  );
}
