import { HedgehogHandClasp } from "@posthog/brand/hoggies";
import { Button, Card, CardContent } from "@posthog/quill";
import { routeList } from "../../../convex/website/routes";
import { PageTitle } from "../PageTitle";
import { ThemeControl } from "../ThemeControl";

type SignInProps = { returnTo?: string; onSignIn: () => void };

export function SignedOutPage(props: SignInProps) {
  return (
    <div className="hud-root flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <ThemeControl />
      </div>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-24">
        <SignInCard {...props} />
      </main>
    </div>
  );
}

export function SignInCard({ returnTo, onSignIn }: SignInProps) {
  const landing = returnTo !== undefined && isDeepLink(returnTo) ? returnTo : undefined;
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <HedgehogHandClasp size={112} title="" />
        <div>
          <PageTitle tab="Sign in">HedgeHug</PageTitle>
          <p className="text-sm text-muted-foreground">Thanks a Hog</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in to see your kudos, your level and everything you've unlocked. Only members of your Slack workspace can sign in.
        </p>
        <Button variant="primary" size="lg" className="w-full" onClick={onSignIn}>
          <SlackGlyph /> Sign in with Slack
        </Button>
        {landing !== undefined && (
          <p className="text-xs text-muted-foreground">
            You'll land on <code className="font-mono">{landing}</code> afterwards.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function isDeepLink(href: string) {
  const [path = ""] = href.split("?");
  return path !== "/" && routeList.includes(path);
}

function SlackGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="10" y="2" width="4" height="9" rx="2" fill="#36C5F0" />
      <rect x="13" y="10" width="9" height="4" rx="2" fill="#2EB67D" />
      <rect x="10" y="13" width="4" height="9" rx="2" fill="#ECB22E" />
      <rect x="2" y="10" width="9" height="4" rx="2" fill="#E01E5A" />
    </svg>
  );
}
