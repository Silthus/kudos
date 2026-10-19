import { Button } from "@posthog/quill";
import { useMemo, useRef, useState } from "react";
import { mostRandomEmojis } from "../../../convex/album/emojiClasses";
import type { EmojiMappingsRead } from "../emojiMappingsRead";
import { Panel } from "../home/Panel";
import type { EmojiMappingReply, EmojiMappings, EmojiPlaceChoice, ShellActions, ShownMappingTarget } from "../shell";
import { isFoundBy, searchTextOf } from "./profileSearch";
import { SearchField } from "./SearchField";
import { StatusLine } from "./StatusLine";
import { lineAfter, useSentChoice, type Answer } from "./useSentChoice";

type MapSlackEmoji = ShellActions["mapSlackEmoji"];

type SlackEmoji = EmojiMappings["emoji"][number];

type PlaceKind = EmojiPlaceChoice["kind"];

type Filter = "all" | PlaceKind;

const emojiShownAtMost = 50;

const peopleShownAtMost = 8;

const filters: [Filter, string][] = [
  ["all", "Every emoji"],
  ["unmapped", "Not mapped"],
  ["team", "Teams"],
  ["hype", "Hype"],
  ["milestone", "Milestones"],
  ["level", "Levels"],
  ["random", "Random drops"],
];

const places: [PlaceKind, string][] = [
  ["unmapped", "Not mapped"],
  ["team", "A team"],
  ["hype", "A person's hype"],
  ["milestone", "A milestone"],
  ["level", "A level"],
  ["random", "Random drops"],
];

const sectionLabel = "Earned emojis in Slack";

export function EmojiMappingSection({ useEmojiMappings, mapSlackEmoji }: { useEmojiMappings: EmojiMappingsRead; mapSlackEmoji: MapSlackEmoji }) {
  const mappings = useEmojiMappings(true);
  if (mappings === undefined || mappings.kind === "connecting") return <Panel id="emoji-mapping" label={sectionLabel} busy />;
  if (mappings.kind === "broken")
    return (
      <Panel id="emoji-mapping" label={sectionLabel}>
        <p className="text-sm text-muted-foreground">The workspace's Slack emoji didn't load. Try again in a moment.</p>
      </Panel>
    );
  if (mappings.kind !== "mappings") return null;
  return <EmojiMapping mappings={mappings} mapSlackEmoji={mapSlackEmoji} />;
}

function EmojiMapping({ mappings, mapSlackEmoji }: { mappings: EmojiMappings; mapSlackEmoji: MapSlackEmoji }) {
  const [search, setSearchNow] = useState("");
  const [filter, setFilterNow] = useState<Filter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [shown, setShown] = useState(emojiShownAtMost);
  const narrowTo = <Value,>(set: (value: Value) => void) => (value: Value) => {
    set(value);
    setKept(new Set());
    setShown(emojiShownAtMost);
  };
  const setSearch = narrowTo(setSearchNow);
  const setFilter = narrowTo(setFilterNow);
  const names = useMemo(() => namesOf(mappings), [mappings]);
  const searchable = useMemo(() => mappings.emoji.map((emoji) => ({ emoji, text: searchTextOf(emoji.name) })), [mappings.emoji]);
  const found = searchable.filter(({ emoji, text }) => kept.has(emoji.name) || (isShownBy(filter, emoji) && isFoundBy(text, search))).map(({ emoji }) => emoji);
  const more = found.length - shown;
  return (
    <Panel id="emoji-mapping" label={sectionLabel}>
      <p className="text-sm text-muted-foreground">Map a Slack emoji to a team, a person's hype, a milestone, a level or the random drops. A mapped emoji is that earned emoji in Slack and in the album at once, and everyone who earned it keeps it. Random drops come from thoughtful packs, now and then.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SearchField label="Find a Slack emoji" value={search} onChange={setSearch} />
        <label className="flex flex-col gap-1 text-sm font-medium">
          Show
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className={selectClass}>
            {filters.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {found.length === 0 ? (
        <p className="text-sm text-muted-foreground">{mappings.emoji.length === 0 ? "Slack has no custom emoji for this workspace yet." : "No Slack emoji matches that."}</p>
      ) : (
        <ul aria-label="Slack emojis" className="ph-no-capture max-h-[36rem] divide-y overflow-y-auto rounded-lg border">
          {found.slice(0, shown).map((emoji) => (
            <EmojiRow key={emoji.name} emoji={emoji} mappings={mappings} names={names} editing={editing === emoji.name} onEdit={setEditing} onSaved={(name) => setKept((names) => new Set(names).add(name))} mapSlackEmoji={mapSlackEmoji} />
          ))}
        </ul>
      )}
      {more > 0 && (
        <div>
          <Button variant="outline" size="sm" onClick={() => setShown(shown + emojiShownAtMost)}>
            {`Show ${Math.min(more, emojiShownAtMost)} more`}
          </Button>
        </div>
      )}
      {mappings.more && <p className="text-sm text-muted-foreground">Slack has more emoji than this list holds. Search finds only the ones listed.</p>}
    </Panel>
  );
}

type Names = { team: Map<string, string>; milestone: Map<string, string>; person: Map<string, string> };

function namesOf({ teams, milestones, people }: EmojiMappings): Names {
  return { team: new Map(teams.map(({ team, name }) => [team, name])), milestone: new Map(milestones.map(({ milestone, name }) => [milestone, name])), person: new Map(people.map(({ key, name }) => [key, name])) };
}

function isShownBy(filter: Filter, { mapping }: SlackEmoji) {
  if (filter === "all") return true;
  return (mapping?.kind ?? "unmapped") === filter;
}

type EmojiRowProps = { emoji: SlackEmoji; mappings: EmojiMappings; names: Names; editing: boolean; onEdit: (name: string | null) => void; onSaved: (name: string) => void; mapSlackEmoji: MapSlackEmoji };

function EmojiRow({ emoji: { name, image, mapping }, mappings, names, editing, onEdit, onSaved, mapSlackEmoji }: EmojiRowProps) {
  const current: EmojiPlaceChoice = mapping ?? { kind: "unmapped" };
  const { pending, settled, choose } = useSentChoice(keyOf(current), async (asked: string) => answerOf(await mapSlackEmoji(name, placeOfKey(asked))));
  const change = useRef<HTMLButtonElement>(null);
  const closeEditor = () => {
    onEdit(null);
    change.current?.focus();
  };
  const save = (asked: EmojiPlaceChoice) => {
    onSaved(name);
    closeEditor();
    void choose(keyOf(asked));
  };
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={image} alt="" loading="lazy" className="size-7 shrink-0 object-contain" />
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-sm font-semibold">{`:${name}:`}</h3>
            <p className="text-xs text-muted-foreground">{wordsOf(current, names).shown}</p>
          </div>
        </div>
        <Button ref={change} variant="outline" size="sm" aria-label={`Change :${name}:`} aria-expanded={editing} disabled={pending} onClick={() => onEdit(editing ? null : name)}>
          Change
        </Button>
      </div>
      {editing && <PlaceEditor name={name} current={current} mappings={mappings} names={names} onSave={save} onCancel={closeEditor} />}
      <StatusLine line={lineAfter(settled, `:${name}: is now ${wordsOf(current, names).told}.`)} />
    </li>
  );
}

type Draft = { kind: PlaceKind; team: string; milestone: string; level: string; person: string };

type PlaceEditorProps = { name: string; current: EmojiPlaceChoice; mappings: EmojiMappings; names: Names; onSave: (asked: EmojiPlaceChoice) => void; onCancel: () => void };

function PlaceEditor({ name, current, mappings, names, onSave, onCancel }: PlaceEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const asked = placeOfDraft(draft);
  const randomFull = asked?.kind === "random" && current.kind !== "random" && mappings.emoji.filter(({ mapping }) => mapping?.kind === "random").length >= mostRandomEmojis;
  const savable = asked !== null && keyOf(asked) !== keyOf(current) && !randomFull;
  const notes = randomFull ? [`Random drops hold at most ${mostRandomEmojis} emojis. Unmap one first.`] : savable ? displacedBy(asked, current, name, mappings, names) : [];
  return (
    <div role="group" aria-label={`:${name}:'s place`} className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Map to
        <select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as PlaceKind })} className={selectClass}>
          {places.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {draft.kind === "team" && <Choice label="Team" placeholder="Pick a team" value={draft.team} options={mappings.teams.map(({ team, name: teamName }) => [team, teamName])} onChange={(team) => setDraft({ ...draft, team })} />}
      {draft.kind === "milestone" && <Choice label="Milestone" placeholder="Pick a milestone" value={draft.milestone} options={mappings.milestones.map(({ milestone, name: milestoneName }) => [milestone, milestoneName])} onChange={(milestone) => setDraft({ ...draft, milestone })} />}
      {draft.kind === "level" && <Choice label="Level" placeholder="Pick a level" value={draft.level} options={mappings.levels.map((level) => [String(level), `Level ${level}`])} onChange={(level) => setDraft({ ...draft, level })} />}
      {draft.kind === "hype" && <PersonPicker people={mappings.people} picked={draft.person} onPick={(person) => setDraft({ ...draft, person })} />}
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={!savable} onClick={() => asked !== null && savable && onSave(asked)}>
          Save
        </Button>
        <Button variant="link-muted" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

type ChoiceProps = { label: string; placeholder: string; value: string; options: [string, string][]; onChange: (value: string) => void };

function Choice({ label, placeholder, value, options, onChange }: ChoiceProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map(([option, optionLabel]) => (
          <option key={option} value={option}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function PersonPicker({ people, picked, onPick }: { people: EmojiMappings["people"]; picked: string; onPick: (person: string) => void }) {
  const [search, setSearch] = useState("");
  const searchable = useMemo(() => people.map((person) => ({ person, text: searchTextOf(person.name) })), [people]);
  const found = search.trim() === "" ? [] : searchable.filter(({ text }) => isFoundBy(text, search)).map(({ person }) => person);
  const pickedName = people.find(({ key }) => key === picked)?.name;
  return (
    <div className="flex flex-col gap-2">
      <SearchField label="Find a person" value={search} onChange={setSearch} />
      {pickedName !== undefined && <p className="text-sm">{`Picked: ${pickedName}`}</p>}
      {found.length > 0 && (
        <ul aria-label="People" className="flex flex-wrap gap-2">
          {found.slice(0, peopleShownAtMost).map(({ key, name }) => (
            <li key={key}>
              <Button variant="outline" size="sm" aria-pressed={key === picked} onClick={() => onPick(key)}>
                {name}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {search.trim() !== "" && found.length === 0 && <p className="text-sm text-muted-foreground">Nobody here matches that.</p>}
    </div>
  );
}

const selectClass = "h-10 rounded-lg border border-muted-foreground bg-card px-3 text-sm font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function draftOf(current: EmojiPlaceChoice): Draft {
  const empty: Draft = { kind: current.kind, team: "", milestone: "", level: "", person: "" };
  switch (current.kind) {
    case "team":
      return { ...empty, team: current.team };
    case "milestone":
      return { ...empty, milestone: current.milestone };
    case "level":
      return { ...empty, level: String(current.level) };
    case "hype":
      return { ...empty, person: current.person };
    default:
      return empty;
  }
}

function placeOfDraft({ kind, team, milestone, level, person }: Draft): EmojiPlaceChoice | null {
  switch (kind) {
    case "team":
      return team === "" ? null : { kind, team };
    case "milestone":
      return milestone === "" ? null : { kind, milestone };
    case "level":
      return level === "" ? null : { kind, level: Number(level) };
    case "hype":
      return person === "" ? null : { kind, person };
    default:
      return { kind };
  }
}

function displacedBy(asked: EmojiPlaceChoice, current: EmojiPlaceChoice, name: string, { emoji }: EmojiMappings, names: Names): string[] {
  const notes: string[] = [];
  if (isEarnedPlace(current)) notes.push(`${capitalized(wordsOf(current, names).told)} leaves Slack until Slack has an emoji of its new name.`);
  const holder = isEarnedPlace(asked) ? emoji.find((each) => each.name !== name && each.mapping !== null && keyOf(each.mapping) === keyOf(asked)) : undefined;
  if (holder !== undefined) notes.push(`:${holder.name}: holds it now and becomes unmapped.`);
  return notes;
}

function capitalized(words: string): string {
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

function isEarnedPlace(place: EmojiPlaceChoice): boolean {
  return place.kind !== "random" && place.kind !== "unmapped";
}

function keyOf(place: EmojiPlaceChoice): string {
  return JSON.stringify(place);
}

function placeOfKey(key: string): EmojiPlaceChoice {
  return JSON.parse(key) as EmojiPlaceChoice;
}

function wordsOf(place: EmojiPlaceChoice | ShownMappingTarget, names: Names): { shown: string; told: string } {
  switch (place.kind) {
    case "team": {
      const team = names.team.get(place.team) ?? place.team;
      return { shown: `${team} team emoji`, told: `the ${team} team emoji` };
    }
    case "milestone": {
      const milestone = names.milestone.get(place.milestone) ?? place.milestone;
      return { shown: `${milestone} milestone emoji`, told: `the ${milestone} milestone emoji` };
    }
    case "level":
      return { shown: `Level ${place.level} emoji`, told: `the level ${place.level} emoji` };
    case "hype": {
      const person = names.person.get(place.person) ?? "A former member";
      return { shown: `${person}'s hype emoji`, told: `${person}'s hype emoji` };
    }
    case "random":
      return { shown: "Random drop", told: "a random drop" };
    case "unmapped":
      return { shown: "Not mapped", told: "not mapped" };
  }
}

function answerOf(reply: EmojiMappingReply): Answer {
  if (reply.kind === "mapped") return "landed";
  return reply.kind === "refused" ? "refused" : "denied";
}
