import type { SettingsRead, SettingsShown } from "./settingsRead";
import type { AdminProfiles, CompanyProfileSetting, MessageSetting, MySettings, ProfileChoice } from "./shell";

const kudosReply: MessageSetting = { kind: "kudos-reply", label: "After-kudos reply", description: "What a kudos you gave earned you, right after you send it.", applies: true, on: true, place: "channel", places: ["channel", "dm", "none"] };

const levelUps: MessageSetting = { kind: "level-ups", label: "Level ups", description: "When you reach a level, with what it opens for you.", applies: true, on: true, place: "dm", places: ["dm", "channel", "none"] };

const newFeatures: MessageSetting = { kind: "new-features", label: "New features", description: "When a new feature is ready for you to open.", applies: true, on: true, place: "dm", places: ["dm", "none"] };

const celebrations: MessageSetting = { kind: "celebrations", label: "Public celebrations", description: "Your level ups and tiers in the announcement channel.", applies: true, on: true, place: "channel", places: ["channel", "none"] };

export const hugsRecap: MessageSetting = { kind: "hugs-recap", label: "Weekly hugs recap", description: "Last week's hugs, the :hedgehug: you and your teammates reacted, with their XP, on Monday morning.", applies: true, on: true, place: "dm", places: ["dm", "none"] };

const gardeners = { group: "g_gardeners", name: "Gardeners" };

const zebras = { group: "g_zebras", name: "Zebras" };

const everything: MySettings = {
  kind: "settings",
  board: { onTheBoards: true },
  messages: [kudosReply, levelUps, newFeatures, celebrations],
  group: { primary: zebras, groups: [gardeners, zebras] },
} as MySettings;

export const wren: ProfileChoice = { profile: 1, name: "Wren Halloway", role: "Product Engineer", teams: ["Lantern"], face: null };

export const samantha: ProfileChoice = { profile: 2, name: "Samantha Okafor", role: "Support Engineer", teams: ["Harbour"], face: null };

export const oriel: ProfileChoice = { profile: 3, name: "Oriel Pemberton", role: "Designer", teams: ["Lantern", "Kite"], face: null };

export const tamsin: ProfileChoice = { profile: 4, name: "Tamsin Vale", role: null, teams: ["Kite"], face: null };

const unmatched: CompanyProfileSetting = { mine: null, by: null, choices: [oriel, samantha, tamsin, wren] };

const firstNames = ["Avery", "Bram", "Cleo", "Dov", "Esme", "Fen", "Gil", "Hollis", "Ines", "Jory", "Kit", "Lark"];

const lastNames = ["Ashdown", "Birchley", "Coombe", "Dunmore", "Elstow", "Fallow"];

export const manyPeople: ProfileChoice[] = firstNames.flatMap((first, row) => lastNames.map((last, column) => ({ profile: 100 + row * lastNames.length + column, name: `${first} ${last}`, role: column % 2 === 0 ? "Engineer" : "Product Manager", teams: [row % 3 === 0 ? "Harbour" : "Kite"], face: null })));

export const companyProfiles = {
  unmatched,
  byName: { mine: wren, by: "name", choices: [oriel, samantha, tamsin, wren] },
  bySelf: { mine: samantha, by: "self", choices: [oriel, samantha, tamsin] },
  byAdmin: { mine: oriel, by: "admin", choices: [oriel, samantha, tamsin] },
  notOnPostHog: { mine: null, by: "admin", choices: [oriel, samantha, tamsin, wren] },
  amongMany: { mine: null, by: null, choices: [...manyPeople, oriel, samantha, tamsin, wren] },
} as const satisfies Record<string, CompanyProfileSetting>;

const teammates: AdminProfiles = {
  members: [
    { key: "k-ada", name: "Ada Admin", profile: null, by: null },
    { key: "k-oriel", name: "Oriel Pemberton", profile: null, by: "admin" },
    { key: "k-sam", name: "Sam Okafor", profile: 2, by: "self" },
    { key: "k-tam", name: "Tam Vale", profile: 4, by: "admin" },
    { key: "k-wren", name: "Wren Halloway", profile: 1, by: "name" },
  ],
  profiles: [
    { ...oriel, heldBy: null, by: null },
    { ...samantha, heldBy: "k-sam", by: "self" },
    { ...tamsin, heldBy: "k-tam", by: "admin" },
    { ...wren, heldBy: "k-wren", by: "name" },
  ],
};

const manyTeammates: AdminProfiles = {
  members: manyPeople.map(({ name }, index) => ({ key: `k-${index}`, name, profile: null, by: null })),
  profiles: manyPeople.map((person) => ({ ...person, heldBy: null, by: null })),
};

export const adminParts = { teammates, manyTeammates } as const;

export const settingsFixtures = {
  everything,
  thisIsMe: { ...everything, companyProfile: unmatched },
  forAnAdmin: { ...everything, companyProfile: companyProfiles.byName, admin: teammates },
} as const satisfies Record<string, MySettings>;

export function fixedSettings(settings: SettingsShown): SettingsRead {
  return (asking) => (asking ? settings : undefined);
}
