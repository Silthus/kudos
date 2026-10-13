import { environments, renderManifest, type Environment } from "./manifest.ts";

const [environment, siteUrl] = process.argv.slice(2);

if (!isEnvironment(environment) || siteUrl === undefined) {
  console.error(`Usage: pnpm manifest <${environments.join("|")}> <the deployment's HTTP actions URL, ending in .convex.site>`);
  process.exit(1);
}

console.log(JSON.stringify(renderManifest(environment, siteUrl), null, 2));

function isEnvironment(value: string | undefined): value is Environment {
  return environments.some((environment) => environment === value);
}
