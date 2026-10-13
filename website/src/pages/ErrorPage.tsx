import { Button } from "@posthog/quill";
import { useEffect } from "react";
import type { Failure } from "../ErrorBoundary";
import { MaxSays } from "../Max";
import { focusPageTitle } from "../pageFocus";

export function ErrorPage({ focusWasOnPage }: Failure) {
  useEffect(() => {
    if (focusWasOnPage) focusPageTitle();
  }, [focusWasOnPage]);
  return (
    <MaxSays
      title="Something went wrong"
      tab="Error"
      action={
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try again
        </Button>
      }
    >
      Something broke on our side, so try again in a moment.
    </MaxSays>
  );
}
