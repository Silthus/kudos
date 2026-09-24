import { useQuery } from "convex/react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import { Logo } from "@/components/KudosMark";
import { Button, Card, CardHeader, Eyebrow } from "@/components/ui";
import { siteUrl } from "@/lib/viewer";
import { SlackMark } from "./Landing";

function Status({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <li className="flex items-center gap-3 py-2 text-sm">
      <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? "bg-up/20 text-up" : "bg-panel-3 text-faint"}`}>
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <code className="font-mono text-[13px]">{label}</code>
    </li>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-up" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function Setup() {
  const status = useQuery(api.session.setupStatus);
  const site = status?.siteUrl || siteUrl();
  const [manifest, setManifest] = useState<string>("");
  useEffect(() => {
    fetch(`${site}/slack/manifest.json`)
      .then((r) => r.json())
      .then((m) => setManifest(JSON.stringify(m, null, 2)))
      .catch(() => setManifest(""));
  }, [site]);
  const createUrl = manifest ? `https://api.slack.com/apps?new_app=1&manifest_json=${encodeURIComponent(JSON.stringify(JSON.parse(manifest)))}` : "#";
  const envCmd = "npx convex env set --prod SLACK_CLIENT_ID=<id>\nnpx convex env set --prod SLACK_CLIENT_SECRET=<secret>\nnpx convex env set --prod SLACK_SIGNING_SECRET=<signing secret>";

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex items-center justify-between">
        <Link to="/">
          <Logo />
        </Link>
      </div>
      <div className="mt-12">
        <Eyebrow>Install guide</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Connect Kudos to Slack</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Kudos runs entirely on this Convex deployment: the web app, the database and Slack's Events API webhooks. Setting it up takes three steps.
        </p>
      </div>

      <div className="mt-10 space-y-5">
        <Card>
          <CardHeader title="1 · Create the Slack app from the manifest" subtitle="All URLs already point at this deployment. Slack verifies the events URL automatically." />
          <div className="space-y-4 px-5 pb-5">
            <div className="flex flex-wrap gap-2">
              <a href={createUrl} target="_blank" rel="noreferrer">
                <Button variant="primary">
                  <SlackMark /> Create app from manifest <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
              {manifest && <CopyButton text={manifest} label="Copy manifest JSON" />}
            </div>
            <pre className="max-h-72 overflow-auto rounded-xl border border-line bg-ink/70 p-4 font-mono text-xs leading-relaxed text-muted">{manifest || "Loading manifest…"}</pre>
          </div>
        </Card>

        <Card>
          <CardHeader title="2 · Add the app credentials to Convex" subtitle="From Basic Information → App Credentials. Secrets never leave the Convex deployment." />
          <div className="grid grid-cols-1 gap-6 px-5 pb-5 md:grid-cols-[1fr_1.4fr]">
            <ul>
              <Status ok={status?.slackClientId} label="SLACK_CLIENT_ID" />
              <Status ok={status?.slackClientSecret} label="SLACK_CLIENT_SECRET" />
              <Status ok={status?.slackSigningSecret} label="SLACK_SIGNING_SECRET" />
            </ul>
            <div>
              <pre className="rounded-xl border border-line bg-ink/70 p-4 font-mono text-xs leading-relaxed text-muted">{envCmd}</pre>
              <div className="mt-2">
                <CopyButton text={envCmd} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="3 · Install to your workspace" subtitle="Use this link rather than Slack's 'Install to Workspace' button, so Kudos stores the bot token for your team." />
          <div className="flex flex-wrap items-center gap-3 px-5 pb-5">
            <a href={`${site}/slack/install`}>
              <Button variant="primary">
                <SlackMark /> Add to Slack
              </Button>
            </a>
            <span className="text-sm text-muted">
              Then <code className="rounded bg-panel-3 px-1.5 py-0.5 font-mono text-xs">/invite @Kudos</code> to the channels where people celebrate each other.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
