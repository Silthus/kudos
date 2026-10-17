import { Button } from "@posthog/quill";
import { useCallback, useMemo, useRef, useState } from "react";
import { Panel } from "../home/Panel";
import { panelTargetAttributes } from "../linkTarget";
import type { AdminLinkTarget, AdminProfiles, ShellActions } from "../shell";
import { PeopleFinder } from "./PeopleFinder";
import { isFoundBy, searchTextOf } from "./profileSearch";
import { SearchField } from "./SearchField";
import { StatusLine } from "./StatusLine";
import { useSentLink, type RefusalLines } from "./useSentLink";

type Teammate = AdminProfiles["members"][number];

type HeldProfile = AdminProfiles["profiles"][number];

type TeammateMatchingProps = { admin: AdminProfiles; linkCompanyProfile: ShellActions["linkCompanyProfile"] };

const teammatesShownAtMost = 25;

const refusalLines: RefusalLines<"not-admin" | "unknown"> = {
  "not-admin": "Only workspace admins can match teammates.",
  unknown: "That teammate or profile isn't here any more.",
  off: "Matching isn't open for you right now.",
};

export function TeammateMatching({ admin: { members, profiles }, linkCompanyProfile }: TeammateMatchingProps) {
  const [search, setSearch] = useState("");
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { sending, linkOnce } = useLinksInFlight(linkCompanyProfile);
  const workspace = useMemo(() => ({ profiles, profileOf: new Map(profiles.map((profile) => [profile.profile, profile])), nameOf: new Map(members.map(({ key, name }) => [key, name])) }), [members, profiles]);
  const searchable = useMemo(() => members.map((teammate) => ({ teammate, text: searchTextOf(teammate.name, profileNameOf(workspace.profileOf, teammate.profile)) })), [members, workspace]);
  const found = searchable.filter(({ teammate, text }) => (!onlyUnmatched || teammate.by === null) && isFoundBy(text, search)).map(({ teammate }) => teammate);
  const more = found.length - teammatesShownAtMost;
  return (
    <Panel id="match-teammates" label="Match teammates" target={panelTargetAttributes("admin")}>
      <p className="text-sm text-muted-foreground">As a workspace admin, you decide who's who on posthog.com. Your match wins over a teammate's own pick and over the name match.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SearchField label="Find a teammate" value={search} onChange={setSearch} />
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnmatched} onChange={(event) => setOnlyUnmatched(event.target.checked)} className="size-4 accent-foreground" />
          Only teammates without a match
        </label>
      </div>
      {found.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teammate matches that.</p>
      ) : (
        <ul aria-label="Teammates" className="max-h-[36rem] divide-y overflow-y-auto rounded-lg border">
          {found.slice(0, teammatesShownAtMost).map((teammate) => (
            <TeammateRow key={teammate.key} teammate={teammate} workspace={workspace} editing={editing === teammate.key} held={sending.has(teammate.key)} onEdit={setEditing} linkCompanyProfile={linkOnce} />
          ))}
        </ul>
      )}
      {more > 0 && <p className="text-sm text-muted-foreground">{`${more} more teammates. Search to narrow it down.`}</p>}
    </Panel>
  );
}

function useLinksInFlight(linkCompanyProfile: ShellActions["linkCompanyProfile"]) {
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const linkOnce = useCallback<ShellActions["linkCompanyProfile"]>(
    async (member, profile) => {
      setSending((keys) => new Set(keys).add(member));
      try {
        return await linkCompanyProfile(member, profile);
      } finally {
        setSending((keys) => new Set([...keys].filter((key) => key !== member)));
      }
    },
    [linkCompanyProfile],
  );
  return { sending, linkOnce };
}

type Workspace = { profiles: HeldProfile[]; profileOf: Map<number, HeldProfile>; nameOf: Map<string, string> };

type TeammateRowProps = { teammate: Teammate; workspace: Workspace; editing: boolean; held: boolean; onEdit: (key: string | null) => void; linkCompanyProfile: ShellActions["linkCompanyProfile"] };

function TeammateRow({ teammate, workspace, editing, held, onEdit, linkCompanyProfile }: TeammateRowProps) {
  const { key, name, profile, by } = teammate;
  const adminTarget: AdminLinkTarget = by === "admin" ? (profile ?? "none") : null;
  const { pending, lineOnceLanded, choose } = useSentLink(adminTarget, (asked: AdminLinkTarget) => linkCompanyProfile(key, asked), refusalLines);
  const change = useRef<HTMLButtonElement>(null);
  const closeEditor = () => {
    onEdit(null);
    change.current?.focus();
  };
  const send = (asked: AdminLinkTarget) => {
    closeEditor();
    if (held) return;
    void choose(asked);
  };
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          <p className="text-xs text-muted-foreground">{matchWordsOf(teammate, workspace.profileOf)}</p>
        </div>
        <Button ref={change} variant="outline" size="sm" aria-label={`Change ${name}'s match`} aria-expanded={editing} disabled={pending || held} onClick={() => onEdit(editing ? null : key)}>
          Change
        </Button>
      </div>
      {editing && (
        <div role="group" aria-label={`${name}'s match`} className="flex flex-col gap-3 rounded-lg border bg-background p-3">
          <PeopleFinder
            searchLabel="Find their posthog.com profile"
            people={workspace.profiles.filter((each) => each.profile !== profile)}
            heading="h4"
            noteOf={({ heldBy }) => (heldBy === null || heldBy === key ? null : `Held by ${workspace.nameOf.get(heldBy) ?? "a teammate"}`)}
            actionOf={(person) => (
              <Button variant="outline" size="sm" aria-label={`Match ${name} to ${person.name}`} onClick={() => send(person.profile)}>
                Match
              </Button>
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            {adminTarget !== "none" && (
              <Button variant="outline" size="sm" onClick={() => send("none")}>
                Not on posthog.com
              </Button>
            )}
            {by === "admin" && (
              <Button variant="outline" size="sm" onClick={() => send(null)}>
                Undo the admin match
              </Button>
            )}
            <Button variant="link-muted" size="sm" onClick={closeEditor}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <StatusLine line={lineOnceLanded(landedLineOf(name, adminTarget, workspace.profileOf))} />
    </li>
  );
}

function matchWordsOf({ profile, by }: Teammate, profileOf: Map<number, HeldProfile>) {
  const profileName = profileNameOf(profileOf, profile) ?? "a profile";
  if (by === "name") return `Matched by name to ${profileName}`;
  if (by === "self") return `Picked ${profileName} themselves`;
  if (by === "admin") return profile === null ? "Not on posthog.com, set by an admin" : `Matched by an admin to ${profileName}`;
  return "Not matched";
}

function landedLineOf(name: string, target: AdminLinkTarget, profileOf: Map<number, HeldProfile>) {
  if (target === null) return `${name}'s admin match is undone.`;
  if (target === "none") return `${name} is marked as not on posthog.com.`;
  return `${name} is matched to ${profileNameOf(profileOf, target) ?? "their profile"}.`;
}

function profileNameOf(profileOf: Map<number, HeldProfile>, profile: number | null) {
  return profile === null ? null : (profileOf.get(profile)?.name ?? null);
}
