import { expect, test } from "vitest";

const sources = import.meta.glob<string>(["/convex/**/*.ts", "!/convex/_generated/**", "!/convex/**/*.test.ts"], { query: "?raw", import: "default", eager: true });

const walletModule = "/convex/wallet/wallet.ts";

test("CO12: only the wallet writes the balance and the spend records, and spends are never changed", () => {
  const touchingWallet = Object.entries(sources)
    .filter(([, source]) => /["'](wallets|coinSpends)["']/.test(source))
    .map(([path]) => path);
  const walletSource = sources[walletModule] ?? "";

  expect(touchingWallet).toEqual([walletModule]);
  expect(walletSource).toContain('ctx.db.insert("coinSpends"');
  expect(walletSource).not.toMatch(/\.(replace|delete)\(/);
  expect(walletSource.match(/\.patch\(/g)).toHaveLength(1);
});
