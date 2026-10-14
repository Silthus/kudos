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
      You came back from Slack without being signed in, and only members of this Slack workspace can sign in.
    </MaxSays>
  );
}
