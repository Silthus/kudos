import { readFileSync } from "node:fs";

const dir = "/tmp/wf99-fixtures";
const load = (name) => JSON.parse(readFileSync(`${dir}/${name}.json`, "utf8"));
async function validate(name, key, value) {
  const body = new URLSearchParams({ [key]: JSON.stringify(value) });
  const res = await fetch("https://slack.com/api/blocks.validate", { method: "POST", body });
  const out = await res.json();
  console.log(`${name}: ok=${out.ok}${out.errors ? ` ${JSON.stringify(out.errors)}` : ""} (${Array.isArray(value) ? value.length : value.blocks.length} blocks)`);
}
for (const name of ["dm-giver-levelup-and-discovery", "dm-receiver-kudos-with-levelup", "dm-skill-gained", "dm-later-kinds", "slash-kudos-level"]) {
  await validate(name, "blocks", load(name).blocks);
}
for (const [i, m] of load("dm-quest-with-levelup").entries()) await validate(`dm-quest-with-levelup[${i}]`, "blocks", m.blocks);
const home = load("app-home-view");
await validate("app-home-view", "view", home);
console.log(`App Home: ${home.blocks.map((b) => b.type + (b.type === "header" ? `:${b.text.text}` : "")).join(", ")}`);
