import { Button } from "@posthog/quill";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { allowanceRange, emojiNameOf, hugBudgetRange } from "../../../convex/workspace/settingsBounds";
import type { WorkspaceSettingsRefusal } from "../../../convex/workspace/workspaceSettings";
import { NamedEmoji } from "../Emoji";
import { Panel } from "../home/Panel";
import { panelTargetAttributes } from "../linkTarget";
import type { ShellActions, WorkspaceSettingsChange, WorkspaceSettingsPart, WorkspaceSettingsReply } from "../shell";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type WorkspaceSettingsProps = { workspace: WorkspaceSettingsPart; setWorkspaceSettings: ShellActions["setWorkspaceSettings"] };

type Draft = { baseAllowance: string; kudosEmoji: string; hugBudget: string };

const refusalLines: Record<WorkspaceSettingsRefusal | "off", string> = {
  allowance: `Kudos a day is a whole number from ${allowanceRange.least} to ${allowanceRange.most}.`,
  "kudos-emoji": "Type one emoji's name, like :taco:, without a skin tone.",
  "hug-budget": `Hugs a day is a whole number from ${hugBudgetRange.least} to ${hugBudgetRange.most}.`,
  "not-maintainer": "Only HedgeHug's maintainer can change these.",
  off: "Workspace settings aren't open for you right now.",
};

const savedLine = "Saved. Every member gives and hugs by these from now on.";

export function WorkspaceSettings({ workspace, setWorkspaceSettings }: WorkspaceSettingsProps) {
  const shown = keyOf(workspace);
  const [draft, setDraft] = useDraftOf(workspace, shown);
  const asked = changeOf(draft);
  const edited = !isComplete(draft) || keyOf(asked) !== shown;
  const { held, line, save } = useSentSave(shown, edited, setWorkspaceSettings);
  const savable = edited && !held && isComplete(draft);
  const preview = emojiNameOf(draft.kudosEmoji);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (savable) void save(asked);
  };
  return (
    <Panel id="workspace-settings" label="Workspace" target={panelTargetAttributes("workspace")}>
      <p className="text-sm text-muted-foreground">As HedgeHug's maintainer, you set these for everyone in the workspace. A change counts from the next kudos or hug, today's included.</p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <NumberField label="Kudos a day" hint="How many kudos each member can give a day." range={allowanceRange} held={held} value={draft.baseAllowance} onChange={(baseAllowance) => setDraft({ ...draft, baseAllowance })} />
        <Field label="Kudos emoji" hint="The emoji that gives kudos and that a hug reacts with. The old one stops counting at once.">
          {(ids) => (
            <span className="flex items-center gap-2">
              <input {...ids} type="text" readOnly={held} value={draft.kudosEmoji} autoComplete="off" spellCheck={false} onChange={(event) => setDraft({ ...draft, kudosEmoji: event.target.value })} className={inputClass} />
              {preview !== "" && (
                <span className="block max-w-[40%] shrink-0 truncate text-xl">
                  <NamedEmoji name={preview} image={preview === workspace.kudosEmoji ? (workspace.kudosEmojiImage ?? undefined) : undefined} />
                </span>
              )}
            </span>
          )}
        </Field>
        <NumberField label="Hugs a day" hint="How many hugs each member can give a day. 0 means hugs earn nothing." range={hugBudgetRange} held={held} value={draft.hugBudget} onChange={(hugBudget) => setDraft({ ...draft, hugBudget })} />
        <div>
          <Button type="submit" variant="primary" disabled={!savable}>
            Save
          </Button>
        </div>
      </form>
      <StatusLine line={line} />
    </Panel>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-muted-foreground bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

type NumberFieldProps = { label: string; hint: string; range: { least: number; most: number }; held: boolean; value: string; onChange: (value: string) => void };

function NumberField({ label, hint, range, held, value, onChange }: NumberFieldProps) {
  return <Field label={label} hint={hint}>{(ids) => <input {...ids} type="number" inputMode="numeric" required readOnly={held} min={range.least} max={range.most} step={1} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />}</Field>;
}

type FieldIds = { id: string; "aria-describedby": string };

function Field({ label, hint, children }: { label: string; hint: string; children: (ids: FieldIds) => ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1 sm:max-w-sm">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({ id, "aria-describedby": hintId })}
      <p id={hintId} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function useDraftOf(workspace: WorkspaceSettingsPart, shown: string) {
  const [draft, setDraft] = useState(() => draftOf(workspace));
  const [draftShown, setDraftShown] = useState(shown);
  if (draftShown !== shown) {
    setDraftShown(shown);
    setDraft(draftOf(workspace));
  }
  return [draft, setDraft] as const;
}

function useSentSave(shown: string, edited: boolean, setWorkspaceSettings: ShellActions["setWorkspaceSettings"]) {
  const [reason, setReason] = useState<WorkspaceSettingsRefusal | null>(null);
  const awaitedRead = useAwaitedRead(shown);
  const { pending, settled, choose } = useSentChoice(shown, async (asked: string) => {
    const answer = answerOf(await setWorkspaceSettings(changeOfKey(asked)), setReason);
    if (answer === "landed") awaitedRead.await(asked);
    return answer;
  });
  const line = settled === "refused" ? refusalLines[reason ?? "off"] : lineAfter(settled, edited ? "" : savedLine);
  return { held: pending || awaitedRead.waiting, line, save: (change: WorkspaceSettingsChange) => choose(keyOf(change)) };
}

function useAwaitedRead(shown: string) {
  const [awaited, setAwaited] = useState<string | null>(null);
  const [awaitedShown, setAwaitedShown] = useState(shown);
  if (awaitedShown !== shown) {
    setAwaitedShown(shown);
    setAwaited(null);
  }
  return { waiting: awaited !== null && awaited !== shown, await: (key: string) => setAwaited(key) };
}

function answerOf(reply: WorkspaceSettingsReply, setReason: (reason: WorkspaceSettingsRefusal | null) => void): Answer {
  if (reply.kind === "set") return "landed";
  if (reply.kind !== "refused") return "denied";
  setReason(reply.reason);
  return "refused";
}

function isComplete({ baseAllowance, hugBudget }: Draft) {
  return baseAllowance.trim() !== "" && hugBudget.trim() !== "";
}

function draftOf({ baseAllowance, kudosEmoji, hugBudget }: WorkspaceSettingsPart): Draft {
  return { baseAllowance: String(baseAllowance), kudosEmoji, hugBudget: String(hugBudget) };
}

function changeOf({ baseAllowance, kudosEmoji, hugBudget }: Draft): WorkspaceSettingsChange {
  return { baseAllowance: Number(baseAllowance), kudosEmoji, hugBudget: Number(hugBudget) };
}

function keyOf({ baseAllowance, kudosEmoji, hugBudget }: WorkspaceSettingsChange) {
  return JSON.stringify([baseAllowance, emojiNameOf(kudosEmoji), hugBudget]);
}

function changeOfKey(key: string): WorkspaceSettingsChange {
  const [baseAllowance, kudosEmoji, hugBudget] = JSON.parse(key) as [number, string, number];
  return { baseAllowance, kudosEmoji, hugBudget };
}
