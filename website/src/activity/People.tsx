import { MemberFace } from "../Face";
import type { Face, Person } from "../shell";

const facesShown = 3;

const namesShown = 3;

const list = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

export function namesOf(people: Person[]) {
  const names = people.map(({ name }) => name);
  if (names.length <= namesShown) return list.format(names);
  const others = names.length - (namesShown - 1);
  return list.format([...names.slice(0, namesShown - 1), `${others} others`]);
}

export function Faces({ people }: { people: Person[] }) {
  const shown = people.slice(0, facesShown);
  return (
    <span className="flex shrink-0">
      {shown.map((person, index) => (
        <span key={index} data-testid="person-face" className={`relative rounded-full ring-2 ring-card ${index === 0 ? "" : "-ml-4"}`} style={{ zIndex: shown.length - index }}>
          <MemberFace face={index === 0 ? person.face : behind(person.face)} className="size-8" />
        </span>
      ))}
    </span>
  );
}

function behind(face: Face): Face {
  return face.kind === "initials" ? { kind: "initials", initials: "" } : face;
}
