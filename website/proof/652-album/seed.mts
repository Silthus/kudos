import { readFileSync } from "node:fs";
import { giver, hyped, inSlackTeam, notInSlackTeam } from "./cast.mts";

const [profilesFile, teamsFile, withSeed] = process.argv.slice(2) as [string, string, string];

const rowsOf = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

const withoutStoredFields = ({ _id, _creationTime, asOf, ...row }: Record<string, unknown>) => row;

const profiles = rowsOf(profilesFile).map(withoutStoredFields);
const teams = rowsOf(teamsFile).map(withoutStoredFields);
const seeded = [giver, hyped].map(({ first, last, profile }) => ({ profile, firstName: first, lastName: last, normalisedName: `${first} ${last}`.toLowerCase(), colour: "teal", teams: [inSlackTeam.slug, notInSlackTeam.slug] }));
const seededTeams = [inSlackTeam, notInSlackTeam].map(({ slug, name }) => ({ team: slug, name, leads: [], people: seeded.map(({ profile }) => profile) }));

const asOf = Date.now();
console.log(JSON.stringify(withSeed === "seed" ? { asOf, profiles: [...profiles, ...seeded], teams: [...teams, ...seededTeams] } : { asOf, profiles, teams }));
