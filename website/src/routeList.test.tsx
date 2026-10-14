import { describe, expect, test } from "vitest";
import { routeList } from "../../convex/website/routes";
import { servedPaths } from "./route";

describe("SW10: the route list is the paths the router serves", () => {
  test("Slack links to exactly the paths the website's router serves", () => {
    expect([...routeList].sort()).toEqual([...servedPaths].sort());
  });

  test("WS203: both lists hold /activity", () => {
    expect(routeList).toContain("/activity");
    expect(servedPaths).toContain("/activity");
  });
});
