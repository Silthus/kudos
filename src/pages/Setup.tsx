import { useQuery } from "convex/react";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui";
import { siteUrl } from "@/lib/viewer";
import { SlackMark } from "./Landing";
import { ParchmentPage } from "./signedOut";

function Status({ ok, label }: { ok: boolean | undefined; label: string }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-sm">
      <span className={`pixel-chip grid h-5 w-5 place-items-center ${ok ? "bg-hedge text-cream" : "bg-parchment-deep text-ink"}`}>
        {ok ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : <X className="h-3 w-3" strokeWidth={3} aria-hidden />}
      </span>
      <code className="tabular text-[13px] text-ink">{label}</code>
      <span className="sr-only">{ok ? "is set" : "is not set yet"}</span>
    </li>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-hedge-deep" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** One step of the guide, under a parchment-deep rule. */
function Step({ title, children, intro }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t-2 border-parchment-deep pt-5">
      <h2 className="font-display text-xl font-medium leading-7 text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink/75">{intro}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A command or a file to copy: it scrolls in its own box, so a long line never widens the page (#109). */
const codeBox = "overflow-auto bg-parchment-deep/50 p-4 tabular text-xs leading-relaxed text-ink shadow-[inset_0_0_0_1px_var(--color-parchment-deep)]";

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
    <ParchmentPage>
      <h1 className="font-display text-[28px] font-medium leading-9 text-ink sm:text-[40px] sm:leading-[48px]">Connect Kudos to Slack</h1>
      <p className="mt-2 max-w-2xl text-ink/75">
        Kudos runs entirely on this Convex deployment: the web app, the database and Slack's Events API webhooks. Setting it up takes three steps.
      </p>

      <div className="mt-8 space-y-8">
        <Step title="Step 1: create the Slack app from the manifest" intro="All the URLs already point at this deployment. Slack checks the events URL on its own.">
          <div className="flex flex-wrap gap-4">
            <a href={createUrl} target="_blank" rel="noreferrer" className="pixel-btn inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold">
              <SlackMark /> Create the app from the manifest <ExternalLink className="h-3.5 w-3.5" aria-label="(opens Slack)" />
            </a>
            {manifest && <CopyButton text={manifest} label="Copy the manifest" />}
          </div>
          <pre className={`mt-4 max-h-72 ${codeBox}`}>{manifest || "Loading the manifest…"}</pre>
        </Step>

        <Step title="Step 2: add the app's credentials to Convex" intro="You'll find them in Slack under Basic Information, in App Credentials. The secrets never leave the Convex deployment.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <ul>
              <Status ok={status?.slackClientId} label="SLACK_CLIENT_ID" />
              <Status ok={status?.slackClientSecret} label="SLACK_CLIENT_SECRET" />
              <Status ok={status?.slackSigningSecret} label="SLACK_SIGNING_SECRET" />
            </ul>
            <div className="min-w-0">
              <pre className={codeBox}>{envCmd}</pre>
              <div className="mt-4">
                <CopyButton text={envCmd} label="Copy the commands" />
              </div>
            </div>
          </div>
        </Step>

        <Step title="Step 3: install Kudos in your workspace" intro="Use this link rather than Slack's own Install to Workspace button, so Kudos keeps the bot token for your team.">
          <div className="flex flex-wrap items-center gap-4">
            <a href={`${site}/slack/install`} className="pixel-btn inline-flex h-10 items-center gap-2 px-4 text-sm font-semibold">
              <SlackMark /> Add to Slack
            </a>
            <span className="text-sm text-ink/75">
              Then <code className="bg-parchment-deep px-1.5 py-0.5 tabular text-xs text-ink">/invite @Kudos</code> to the channels where people thank each other.
            </span>
          </div>
        </Step>
      </div>
    </ParchmentPage>
  );
}
