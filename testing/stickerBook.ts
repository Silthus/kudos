import { expect } from "vitest";
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

export async function everyoneHeldBy(t: Backend, member: MemberId, people: Person[], { except = [] }: { except?: MemberId[] } = {}) {
  const { firstAward, firstAt } = (await t.run((ctx) => ctx.db.query("stickers").first()))!;
  const others = await t.run(async (ctx) => (await ctx.db.query("members").collect()).filter(({ _id }) => _id !== member).map(({ _id }) => _id));
  const left = new Set(except);
  await t.run(async (ctx) => {
    const held = new Set((await ctx.db.query("stickers").collect()).filter((sticker) => sticker.member === member).map(({ person }) => person));
    for (const person of others) if (!held.has(person) && !left.has(person)) await ctx.db.insert("stickers", { member, person, firstAward, firstAt });
  });
  expect(others).toHaveLength(people.length - 1);
}
