import { Button } from "@posthog/quill";
import { MaxSays } from "../Max";

export function SignInUnfinishedPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <MaxSays
      title="Sign-in didn't finish"
      tab="Sign-in didn't finish"
      action={
        <Button variant="primary" size="lg" onClick={onSignIn}>
          Try again
        </Button>
      }
    >
      Slack sent you back before you were signed in, so let's give it another go.
    </MaxSays>
  );
}
