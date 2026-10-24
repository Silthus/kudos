// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { dryRunOf, workflowSteps } from "./convexSandbox";

describe("reading a Convex dry run", () => {
  test("reads the target and the indexes the push would delete, leaving out ones it re-adds with new fields", () => {
    const output = [
      "- Deploying to https://different-dog-467.convex.cloud... [dry run]",
      "✔ Would delete table indexes:",
      "  [-] teamStickers.by_member_team   member, team",
      "  [-] stickers.by_kind   kind",
      "✔ Would add table indexes:",
      "  [+] stickers.by_kind   kind, name",
      "✔ Remote config would be overwritten with the following changes:",
      "  [-] 18",
      "  [+] 20",
    ].join("\n");

    expect(dryRunOf(output)).toEqual({ target: "https://different-dog-467.convex.cloud", droppedIndexes: ["teamStickers.by_member_team"] });
  });

  test("keeps reading staged index additions past their progress links", () => {
    const output = [
      "- Deploying to https://different-dog-467.convex.cloud... [dry run]",
      "✔ Would delete table indexes:",
      "  [-] stickers.by_kind   kind",
      "  [-] stickers.by_name   name",
      "✔ Would add staged table indexes:",
      "  [+] stickers.by_kind   kind, name  (staged)",
      "      See progress: https://dashboard.convex.dev/d/different-dog-467/data?table=stickers&showIndexes=true",
      "  [+] stickers.by_name   name, kind  (staged)",
      "      See progress: https://dashboard.convex.dev/d/different-dog-467/data?table=stickers&showIndexes=true",
    ].join("\n");

    expect(dryRunOf(output).droppedIndexes).toEqual([]);
  });

  test("reads a push that deletes no index", () => {
    expect(dryRunOf("- Deploying to https://different-dog-467.convex.cloud... [dry run]\n✔ No indexes are deleted by this push")).toEqual({
      target: "https://different-dog-467.convex.cloud",
      droppedIndexes: [],
    });
  });
});

describe("the sandbox workflow's deploy steps", () => {
  test("are the steps the workflow hands the deploy key, in order, with the deploy confirmed up front and the backfill run even after a later step fails", () => {
    const workflow = readFileSync(new URL("../../.github/workflows/deploy-sandbox.yml", import.meta.url), "utf8");

    expect(workflowSteps(workflow)).toEqual([
      { run: "pnpm exec convex deploy -y", afterFailedStep: false },
      { run: 'pnpm exec static-hosting upload --build --build-command "pnpm website:build" --dist website/dist', afterFailedStep: false },
      { run: "pnpm exec convex run website/flag:prepareWebsiteFlag", afterFailedStep: false },
      { run: "pnpm exec convex run companyProfiles/sync:syncCompanyProfiles", afterFailedStep: false },
      { run: "pnpm exec convex run album/emojiNames:reserveSharedEmojiNames", afterFailedStep: false },
      { run: `pnpm exec convex run quests/pendingCrates:backfillPendingCrates '{"restart":true}'`, afterFailedStep: true },
    ]);
  });
});
