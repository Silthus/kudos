import { expect } from "vitest";
import { normalisedName } from "../convex/companyProfiles/faces";
import type { MemberId } from "../convex/workspace/directory";
import type { Backend } from "./slackBackend";

export type Person = { user: string; name: string };

export async function seededMembers(t: Backend, count: number): Promise<Person[]> {
  const people = Array.from({ length: count }, (_, index) => ({ user: `U0${String(index).padStart(9, "0")}`, name: `Teammate Number${index}` }));
  await t.run(async (ctx) => {
    for (const { user, name } of people) {
      const picture = `https://avatars.slack-edge.com/2026-10-16/${user}_5f3e7c1a2b9d4e6f8a01_192.jpg`;
      await ctx.db.insert("members", { workspace: "T1", user, kind: "member", name, realName: name, displayName: name, picture, asOf: 0 });
    }
  });
  return people;
}

export async function seededGroups(t: Backend, people: Person[], { groups, size }: { groups: number; size: number }) {
  await t.run(async (ctx) => {
    for (let index = 0; index < groups; index += 1) {
      const group = `S_GROUP${String(index).padStart(2, "0")}`;
      await ctx.db.insert("userGroups", { workspace: "T1", group, handle: group.toLowerCase(), name: `Group ${String(index).padStart(2, "0")}`, enabled: true, automatic: false, members: size, asOf: 0, membersAsOf: 0 });
      for (let seat = 0; seat < size; seat += 1) await ctx.db.insert("userGroupMembers", { workspace: "T1", group, user: people[(index * size + seat) % people.length]!.user });
    }
  });
}

export type Holding = { except?: MemberId[]; distinctAwards?: boolean };

export async function everyoneHeldBy(t: Backend, member: MemberId, people: Person[], { except = [], distinctAwards = false }: Holding = {}) {
  const { firstAward, firstAt } = (await t.run((ctx) => ctx.db.query("stickers").first()))!;
  const others = await t.run(async (ctx) => (await ctx.db.query("members").collect()).filter(({ _id }) => _id !== member).map(({ _id }) => _id));
  const left = new Set(except);
  await t.run(async (ctx) => {
    const held = new Set((await ctx.db.query("stickers").collect()).filter((sticker) => sticker.member === member).map(({ person }) => person));
    const { _id, _creationTime, ...award } = (await ctx.db.get(firstAward))!;
    for (const person of others) {
      if (held.has(person) || left.has(person)) continue;
      const given = distinctAwards ? await ctx.db.insert("awards", { ...award, recipient: person }) : firstAward;
      await ctx.db.insert("stickers", { member, person, firstAward: given, firstAt });
    }
  });
  expect(others).toHaveLength(people.length - 1);
}

export type CompanySize = { teams: number; size: number; onEvery?: Person };

export async function seededCompany(t: Backend, people: Person[], { teams, size, onEvery }: CompanySize) {
  const profileOf = new Map(people.map((person, index) => [person.user, 10_000 + index]));
  const slugOf = (team: number) => `team-${String(team).padStart(3, "0")}`;
  const peopleOn = (team: number) => {
    const seated = Array.from({ length: size }, (_, seat) => people[(team * size + seat) % people.length]!);
    return onEvery === undefined || seated.includes(onEvery) ? seated : [...seated, onEvery];
  };
  const onTeams = Array.from({ length: teams }, (_, team) => peopleOn(team));
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("companyProfiles").collect()) await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("companyTeams").collect()) await ctx.db.delete(row._id);
    for (const person of people) {
      const [firstName, ...rest] = person.name.split(" ");
      const lastName = rest.join(" ");
      const memberTeams = onTeams.flatMap((onTeam, team) => (onTeam.includes(person) ? [slugOf(team)] : []));
      await ctx.db.insert("companyProfiles", { profile: profileOf.get(person.user)!, firstName: firstName!, lastName, normalisedName: normalisedName(person.name), colour: "#8567FF", teams: memberTeams, role: "Product Engineer", asOf: Date.now() });
    }
    for (const [team, onTeam] of onTeams.entries()) {
      const crestImage = `https://res.cloudinary.com/posthog-test/image/upload/c_limit,w_160,f_auto,q_auto/v1/crests/${slugOf(team)}.png`;
      const ids = onTeam.map(({ user }) => profileOf.get(user)!);
      await ctx.db.insert("companyTeams", { team: slugOf(team), name: `Team ${String(team).padStart(3, "0")}`, crestImage, leads: ids.slice(0, 2), people: ids, asOf: Date.now() });
    }
  });
}
