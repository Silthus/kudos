import { Button } from "@posthog/quill";

export function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Button variant="outline" onClick={onSignOut}>
      Sign out
    </Button>
  );
}
