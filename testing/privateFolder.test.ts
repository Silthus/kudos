// @vitest-environment node
import { readFileSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { afterEach, expect, test } from "vitest";
import { privateFolder } from "./privateFolder";

const folders: string[] = [];

function folder() {
  const created = privateFolder("kudos-private-folder-test-");
  folders.push(created.directory);
  return created;
}

const permissionsOf = (path: string) => statSync(path).mode & 0o777;

afterEach(() => {
  for (const directory of folders.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("writes a file only its owner can read, in a folder only its owner can enter", () => {
  const file = folder().write("sign-in.js", "the snippet");

  expect(readFileSync(file, "utf8")).toBe("the snippet");
  expect(permissionsOf(file)).toBe(0o600);
  expect(permissionsOf(dirname(file))).toBe(0o700);
});

test("gives every run a folder of its own", () => {
  expect(folder().directory).not.toBe(folder().directory);
});
