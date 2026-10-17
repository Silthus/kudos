import { Button } from "@posthog/quill";
import { useEffect, useRef } from "react";
import { Panel } from "../home/Panel";
import { panelTargetAttributes } from "../linkTarget";
import type { CompanyProfileSetting, ShellActions } from "../shell";
import { PeopleFinder, PersonSummary } from "./PeopleFinder";
import { StatusLine } from "./StatusLine";
import { useSentLink, type RefusalLines } from "./useSentLink";

type CompanyProfileSectionProps = { setting: CompanyProfileSetting; linkMyCompanyProfile: ShellActions["linkMyCompanyProfile"] };

const refusalLines: RefusalLines<"matched" | "taken" | "unknown"> = {
  matched: "You're already matched, so only a workspace admin can change it.",
  taken: "Someone else already holds that profile. If it's you, ask a workspace admin.",
  unknown: "That profile isn't on posthog.com any more.",
  off: "Matching isn't open for you right now.",
};

const sectionHeadingId = "company-profile-panel-title";

export function CompanyProfileSection({ setting, linkMyCompanyProfile }: CompanyProfileSectionProps) {
  const { mine, by, choices } = setting;
  const ownPick = by === "self" ? (mine?.profile ?? null) : null;
  const { pending, lineOnceLanded, choose } = useSentLink(ownPick, linkMyCompanyProfile, refusalLines);
  const press = useFocusKeptAfterPress((profile: number | null) => void choose(profile));
  const picksForThemselves = by === null || by === "self";
  return (
    <Panel id="company-profile" label="This is me on posthog.com" target={panelTargetAttributes("company-profile")}>
      <p className="text-sm text-muted-foreground">Team pages in the Book count you once you're matched to your profile on posthog.com.</p>
      {mine !== null && (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <PersonSummary person={mine} heading="h3" />
          {by === "self" && (
            <Button variant="link-muted" size="sm" disabled={pending} onClick={() => press(null)}>
              That isn't me
            </Button>
          )}
        </div>
      )}
      <p className="text-sm">{matchLineOf(setting)}</p>
      {picksForThemselves && (
        <PeopleFinder
          searchLabel="Find yourself on posthog.com"
          people={choices.filter(({ profile }) => profile !== mine?.profile)}
          heading="h3"
          actionOf={(person) => (
            <Button variant="outline" size="sm" aria-label={`This is me: ${person.name}`} disabled={pending} onClick={() => press(person.profile)}>
              This is me
            </Button>
          )}
        />
      )}
      <StatusLine line={lineOnceLanded(mine === null || ownPick === null ? "Your pick is cleared." : `You're ${mine.name} on posthog.com.`)} />
    </Panel>
  );
}

function useFocusKeptAfterPress<Value>(send: (value: Value) => void) {
  const pressed = useRef<Element | null>(null);
  useEffect(() => {
    const control = pressed.current;
    if (control === null) return;
    if (control.isConnected) {
      if (document.activeElement !== control) pressed.current = null;
      return;
    }
    pressed.current = null;
    if (document.activeElement === document.body) document.getElementById(sectionHeadingId)?.focus();
  });
  return (value: Value) => {
    pressed.current = document.activeElement;
    send(value);
  };
}

function matchLineOf({ mine, by }: CompanyProfileSetting) {
  if (by === "name") return "Matched by your name in Slack. If that isn't you, ask a workspace admin to fix it.";
  if (by === "self" && mine !== null) return "You picked this profile.";
  if (by === "admin") return mine === null ? "A workspace admin noted that you aren't on posthog.com. Ask them if that's wrong." : "A workspace admin matched you. Ask them if it's wrong.";
  return "You aren't matched to anyone on posthog.com yet.";
}
