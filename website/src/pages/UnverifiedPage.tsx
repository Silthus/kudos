import { Button } from "@posthog/quill";
import { MaxSays } from "../Max";
import { SignOutButton } from "../SignOutButton";

export function UnverifiedPage({ onSignIn, onSignOut }: { onSignIn: () => void; onSignOut: () => void }) {
  return (
    <MaxSays
      title="Membership not checked"
      tab="Membership not checked"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={onSignIn}>
            Sign in again
          </Button>
          <SignOutButton onSignOut={onSignOut} />
        </div>
      }
    >
      We couldn't check your membership right now.
    </MaxSays>
  );
}
