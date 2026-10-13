import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

const workspace = "T_ALLOWED";
const hour = 60 * 60 * 1000;

test("a visitor with no session is signed out, never shown an empty profile", async () => {
  const t = convexTest(schema, modules);

  expect(await t.query(api.website.profile.getMyProfile, {})).toEqual({ kind: "signed-out" });
});

test("a token whose session was signed out or expired is signed out", async () => {
  const t = convexTest(schema, modules);
  const { asSignedIn: signedOut } = await signIn(t, "U_ADA", { sessionEndsIn: -1 });

  expect(await signedOut.query(api.website.profile.getMyProfile, {})).toEqual({ kind: "signed-out" });
});

test("a signed-in person the directory doesn't know yet is being verified", async () => {
  const t = convexTest(schema, modules);
  const { asSignedIn } = await signIn(t, "U_ADA");

  expect(await asSignedIn.query(api.website.profile.getMyProfile, {})).toEqual({ kind: "verifying" });
});

test("a signed-in person who left the workspace is not a member", async () => {
  const t = convexTest(schema, modules);
  await addToDirectory(t, "U_ADA", "not-a-member");
  const { asSignedIn } = await signIn(t, "U_ADA");

  expect(await asSignedIn.query(api.website.profile.getMyProfile, {})).toEqual({ kind: "not-a-member" });
});

test("a member sees the same facts App Home shows, and only their own", async () => {
  const t = convexTest(schema, modules);
  const ada = await addToDirectory(t, "U_ADA", "member");
  const bob = await addToDirectory(t, "U_BOB", "member");
  await t.run((ctx) => ctx.db.insert("kudosTotals", { member: ada, given: 4, received: 7 }));
  await t.run((ctx) => ctx.db.insert("kudosTotals", { member: bob, given: 40, received: 70 }));
  const { asSignedIn } = await signIn(t, "U_ADA");

  expect(await asSignedIn.query(api.website.profile.getMyProfile, {})).toEqual({
    kind: "member",
    name: "U_ADA's name",
    kudosEmoji: "taco",
    allowance: { left: 3, base: 3 },
    thisWeek: { given: 0, received: 0 },
    lifetime: { given: 4, received: 7 },
  });
});

type Backend = ReturnType<typeof convexTest>;

function addToDirectory(t: Backend, user: string, kind: "member" | "not-a-member") {
  return t.run((ctx) => ctx.db.insert("members", { workspace, user, kind, asOf: 0 }));
}

async function signIn(t: Backend, user: string, { sessionEndsIn = hour } = {}) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { name: `${user}'s name`, chatIdentity: { workspace, user } }));
  const sessionId: Id<"authSessions"> = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + sessionEndsIn }),
  );
  return { asSignedIn: t.withIdentity({ subject: `${userId}|${sessionId}` }) };
}
