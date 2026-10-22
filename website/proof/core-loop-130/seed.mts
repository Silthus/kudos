import { readFileSync } from "node:fs";
import { cast, team } from "./cast.mts";

const [profilesFile, teamsFile] = process.argv.slice(2) as [string, string];

const rowsOf = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const withoutStoredFields = ({ _id, _creationTime, asOf, ...row }: Record<string, unknown>) => row;

const seeded = cast.map(({ first, last, profile }) => ({ profile, firstName: first, lastName: last, normalisedName: `${first} ${last}`.toLowerCase(), colour: "teal", teams: [team.slug] }));
const seededTeam = { team: team.slug, name: team.name, leads: [], people: seeded.map(({ profile }) => profile) };

console.log(JSON.stringify({ asOf: Date.now(), profiles: [...rowsOf(profilesFile).map(withoutStoredFields), ...seeded], teams: [...rowsOf(teamsFile).map(withoutStoredFields), seededTeam] }));
