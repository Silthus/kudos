import { expect, test } from "vitest";
import { modules } from "./test.setup";

type Registered = { isQuery?: true; isMutation?: true; isAction?: true; isInternal?: true };

test("R50: every Convex function is internal, so only HTTP routes are public", async () => {
  const publicFunctions: string[] = [];
  for (const [path, load] of Object.entries(modules)) {
    if (path.startsWith("./_generated/")) continue;
    const exports = (await load()) as Record<string, Registered>;
    for (const [name, value] of Object.entries(exports)) {
      if (isConvexFunction(value) && !value.isInternal) publicFunctions.push(`${path}:${name}`);
    }
  }

  expect(publicFunctions).toEqual([]);
});

function isConvexFunction(value: Registered) {
  return value.isQuery === true || value.isMutation === true || value.isAction === true;
}
