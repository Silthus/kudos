import { expect, test } from "vitest";
import { modules } from "./test.setup";

type Registered = { isQuery?: true; isMutation?: true; isAction?: true; isInternal?: true };

const signInLibrary = ["./auth.ts:isAuthenticated", "./auth.ts:signIn", "./auth.ts:signOut"];
const websiteReads = ["./website/profile.ts:getMyProfile"];

test("R50: only the sign-in library and the website's signed-in reads are public; every domain function is internal", async () => {
  const publicFunctions: string[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.startsWith("./_generated/") || path === "./convex.config.ts") continue;
    const exports = (await load()) as Record<string, Registered>;
    for (const [name, value] of Object.entries(exports)) {
      if (isConvexFunction(value) && !value.isInternal) publicFunctions.push(`${path}:${name}`);
    }
  }

  expect(publicFunctions.sort()).toEqual([...signInLibrary, ...websiteReads].sort());
});

function isConvexFunction(value: Registered) {
  return value.isQuery === true || value.isMutation === true || value.isAction === true;
}
