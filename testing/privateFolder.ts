import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function privateFolder(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  return {
    directory,
    write(name: string, contents: string) {
      const file = join(directory, name);
      writeFileSync(file, contents, { mode: 0o600, flag: "wx" });
      return file;
    },
  };
}
