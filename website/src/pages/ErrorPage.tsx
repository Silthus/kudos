import { Button } from "@posthog/quill";
import { MaxSays } from "../Max";

export function ErrorPage() {
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
