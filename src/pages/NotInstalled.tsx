import { useAuthActions } from "@convex-dev/auth/react";
import { Logo } from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { siteUrl } from "@/lib/viewer";
import { SlackMark } from "./Landing";

export function NotInstalled({ name }: { name: string | null }) {
  const { signOut } = useAuthActions();
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <Card className="max-w-md p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Almost there{name ? `, ${name.split(" ")[0]}` : ""}!</h1>
        <p className="mt-2 text-ink/75">
          You're signed in, but Kudos isn't installed in your Slack workspace yet. Add it to Slack, then sign in again.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a href={`${siteUrl()}/slack/install`}>
            <Button variant="primary" size="lg" className="w-full">
              <SlackMark className="h-5 w-5" /> Add Kudos to Slack
            </Button>
          </a>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
