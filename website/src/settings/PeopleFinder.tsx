import { useId, useMemo, useState, type ReactNode } from "react";
import { MemberFace } from "../Face";
import type { ProfileChoice } from "../shell";
import { aboutPersonOf, faceOfPerson, isFoundBy, personSearchTextOf } from "./profileSearch";
import { SearchField } from "./SearchField";

const peopleShownAtMost = 20;

type PeopleFinderProps<Person extends ProfileChoice> = {
  searchLabel: string;
  people: Person[];
  heading: "h3" | "h4";
  noteOf?: (person: Person) => string | null;
  actionOf: (person: Person) => ReactNode;
};

export function PeopleFinder<Person extends ProfileChoice>({ searchLabel, people, heading, noteOf, actionOf }: PeopleFinderProps<Person>) {
  const [search, setSearch] = useState("");
  const searchable = useMemo(() => people.map((person) => ({ person, text: personSearchTextOf(person) })), [people]);
  const found = searchable.filter(({ text }) => isFoundBy(text, search)).map(({ person }) => person);
  const more = found.length - peopleShownAtMost;
  return (
    <div className="flex flex-col gap-2">
      <SearchField label={searchLabel} value={search} onChange={setSearch} />
      {found.length === 0 ? (
        <p className="text-sm text-muted-foreground">{search.trim() === "" ? "Nobody on posthog.com is free to pick." : `Nobody on posthog.com matches “${search.trim()}”.`}</p>
      ) : (
        <ul aria-label="People on posthog.com" className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {found.slice(0, peopleShownAtMost).map((person) => (
            <li key={person.profile} className="flex items-center gap-3 px-3 py-2">
              <PersonSummary person={person} heading={heading} note={noteOf?.(person) ?? null} />
              {actionOf(person)}
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="text-sm text-muted-foreground">{`${more} more. Type a name, role or team to narrow it down.`}</p>}
    </div>
  );
}

export function PersonSummary({ person, heading: Heading, note = null }: { person: ProfileChoice; heading: "h3" | "h4"; note?: string | null }) {
  const aboutId = useId();
  const about = aboutPersonOf(person);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <MemberFace face={faceOfPerson(person)} className="size-9" />
      <div className="flex min-w-0 flex-col">
        <Heading aria-describedby={about === "" ? undefined : aboutId} className="truncate text-sm font-semibold">
          {person.name}
        </Heading>
        {about !== "" && (
          <p id={aboutId} className="truncate text-xs text-muted-foreground">
            {about}
          </p>
        )}
        {note !== null && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}
