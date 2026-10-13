import { MaxSays } from "../Max";
import { SignOutButton } from "../SignOutButton";

export function VerifyingPage({ onSignOut }: { onSignOut: () => void }) {
  return (
    <MaxSays title="Checking your membership…" tab="Checking your membership" action={<SignOutButton onSignOut={onSignOut} />}>
      Slack is confirming you're in this workspace, and this page moves on by itself.
    </MaxSays>
  );
}
