// PROTOTYPE (#625, round 4): every small team listed on posthog.com/teams, filled with made-up people (3 to 6 each). Never merge to main.
import type { Face } from "../../shell";
import { teammateOf } from "../../stickerBookFixtures";
import type { Cast, CastPage, CastPerson } from "../round-3/album";

const smallTeams: readonly [team: string, name: string, crest: string][] = [
  ["workflows", "Workflows", "workflows"],
  ["agent-infrastructure", "Agent Infrastructure", "a-default-crest"],
  ["ai-observability", "AI Observability", "ai-observability"],
  ["ai-research", "AI Research", "ai-research"],
  ["apm", "APM", "apm"],
  ["batch-exports", "Batch Exports", "batch-exports"],
  ["billing", "Billing", "billing"],
  ["blitzscale", "Blitzscale", "blitzscale"],
  ["builder-relations", "Builder Relations", "builder-relations"],
  ["clickhouse", "ClickHouse", "clickhouse"],
  ["client-libraries", "Client Libraries", "client-libraries"],
  ["cloud-foundations", "Cloud Foundations", "cloud-foundations"],
  ["cloud-platform", "Cloud Platform", "cloud-platform"],
  ["context-and-mcp", "Context & MCP", "a-default-crest"],
  ["conversations", "Conversations", "conversations"],
  ["customer-analytics", "Customer Analytics", "customer-analytics"],
  ["customer-success-eu", "Customer Success EU", "customer-success-eu"],
  ["customer-success-na-north", "Customer Success NA North", "customer-success-na"],
  ["customer-success-na-west", "Customer Success NA West", "customer-success-na"],
  ["data-modeling", "Data Modeling", "data-modeling"],
  ["data-tools", "Data Tools", "data-tools"],
  ["demand-gen", "Demand Gen", "demand-gen"],
  ["developer-experience", "Developer Experience", "dev-experience"],
  ["developer-marketing", "Developer Marketing", "a-default-crest"],
  ["editorial", "Editorial", "editorial"],
  ["error-tracking", "Error Tracking", "error-tracking"],
  ["experiments", "Experiments", "experiments"],
  ["feature-flags", "Feature Flags", "feature-flags"],
  ["forward-deployed-engineering", "Forward Deployed Engineering", "forward-deployed-engineering"],
  ["graphics", "Graphics", "graphics"],
  ["growth", "Growth", "growth"],
  ["gtm-engineering", "GTM Engineering", "gtm-engineering"],
  ["ingestion", "Ingestion", "ingestion"],
  ["mcp-analytics", "MCP Analytics", "mcp-analytics"],
  ["new-business-sales", "New Business Sales", "new-business-sales"],
  ["onboarding", "Onboarding", "onboarding"],
  ["people-ops", "People & Ops", "people-ops"],
  ["platform-features", "Platform Features", "platform-features"],
  ["platform-ux", "Platform UX", "platform-ux"],
  ["product-analytics", "Product Analytics", "product-analytics"],
  ["product-led-sales-east", "Product-Led Sales East", "product-lead-sales-east"],
  ["product-led-sales-west", "Product-Led Sales West", "product-led-sales-west"],
  ["query-performance", "Query Performance", "a-default-crest"],
  ["replay", "Replay", "replay"],
  ["security", "Security", "security"],
  ["self-driving", "Self-Driving", "self-driving"],
  ["support", "Support", "support"],
  ["surfaces", "Surfaces", "a-default-crest"],
  ["talent", "Talent", "talent"],
  ["video", "Video", "youtube"],
  ["warehouse", "Warehouse", "managed-warehouse"],
  ["warehouse-sources", "Warehouse Sources", "warehouse-sources"],
  ["web-analytics", "Web Analytics", "web-analytics"],
  ["website", "Website", "website"],
  ["wizard-and-docs", "Wizard & Docs", "wizard-docs"],
];

const knownPeople: Readonly<Record<string, { people: string[]; leads: string[] }>> = {
  workflows: { people: ["k:noor", "k:felix", "k:priya", "k:hana", "k:omar"], leads: ["k:noor", "k:hana"] },
  "platform-features": { people: ["k:mei", "k:tomas", "k:felix"], leads: ["k:mei"] },
  editorial: { people: ["k:sofia", "k:ivy", "k:kai", "k:zara"], leads: ["k:sofia"] },
  support: { people: ["k:leo", "k:amara", "k:ben"], leads: ["k:leo"] },
  replay: { people: ["k:jonas"], leads: [] },
  graphics: { people: ["k:diego", "k:lina"], leads: ["k:lina"] },
  "product-analytics": { people: ["k:elin"], leads: ["k:elin"] },
};

const firstNames = ["Aiko", "Bastian", "Celine", "Dario", "Emeka", "Freya", "Gideon", "Hollis", "Ilse", "Joaquin", "Katya", "Lars", "Marisol", "Nils", "Odette", "Pavel", "Quentin", "Rhea", "Soren", "Tamsin", "Ulrich", "Valentina", "Wiktor", "Yara", "Zeno", "Anouk", "Bram", "Cosima", "Dagny", "Eamon", "Florin", "Gaia", "Henrik", "Isolde", "Jarek", "Kaia", "Linus", "Mirela", "Nico", "Orla", "Piet", "Ronja", "Silas", "Thea", "Viggo", "Wanda", "Xavi", "Ysolde", "Zuri", "Arlo"];

const lastNames = ["Aalto", "Barros", "Cerny", "Delacroix", "Ekwueme", "Falk", "Grieg", "Halloran", "Ibarra", "Jovanovic", "Kessler", "Lund", "Mbeki", "Nygaard", "Oyelaran", "Pellegrini", "Quist", "Rasmussen", "Szabo", "Thorne", "Urquhart", "Varga", "Wolanski", "Yilmaz", "Zielinski", "Arendt", "Bianchi", "Castellanos", "Duval", "Engel", "Fonseca", "Gruber", "Hayashi", "Ivarsson", "Juarez", "Kowal", "Lemaire", "Moreno", "Nakashima", "Ostrowski", "Pereira", "Reyes", "Salonen", "Tanaka-Ruiz", "Uhl", "Vidal", "Wexler"];

const roles = ["Product Engineer", "Product Engineer", "Product Manager", "Product Designer", "Product Engineer", "Technical Writer", "Support Engineer"];

const drawnFace = (hue: number) => `<circle cx='32' cy='26' r='13' fill='hsl(${hue} 30% 78%)'/><path d='M19 24a13 13 0 0 1 26 0v-4a13 13 0 0 0-26 0z' fill='hsl(${hue} 25% 28%)'/><path d='M8 64a24 24 0 0 1 48 0z' fill='hsl(${hue} 30% 78%)'/>`;

function drawnFaceOf(name: string, index: number): Face {
  const initials = name.split(" ").map((word) => word[0]!).join("");
  if (index % 3 === 2) return { kind: "initials", initials };
  const hue = (index * 47) % 360;
  return { kind: "slack", image: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='hsl(${hue} 45% 52%)'/>${drawnFace(hue)}</svg>`)}`, initials };
}

function sizeOf(index: number) {
  return 3 + ((index * 7 + Math.floor(index / 3)) % 4);
}

const day = 86_400_000;

const now = Date.parse("2026-10-18T10:00:00Z");

function madeUpPerson(serial: number): CastPerson {
  const name = `${firstNames[serial % firstNames.length]!} ${lastNames[(serial * 7 + Math.floor(serial / firstNames.length)) % lastNames.length]!}`;
  return { key: `k:r4-${serial}`, name, face: drawnFaceOf(name, serial), role: roles[serial % roles.length]!, lead: false };
}

function knownPerson(key: string, leads: string[], index: number): CastPerson {
  const { name, face } = teammateOf(key);
  return { key, name, face, role: roles[index % roles.length]!, lead: leads.includes(key) };
}

let serial = 0;

const pages: CastPage[] = smallTeams.map(([team, name, crest], index) => {
  const known = knownPeople[team];
  const people = (known?.people ?? []).map((key, place) => knownPerson(key, known!.leads, place));
  const size = known === undefined ? sizeOf(index) : Math.max(people.length, team === "workflows" ? 5 : sizeOf(index));
  while (people.length < size) people.push(madeUpPerson(serial++));
  if (!people.some(({ lead }) => lead)) people[0] = { ...people[0]!, lead: true };
  return { team, name, art: { kind: "crest", slug: crest }, mine: team === "workflows", leads: people.filter(({ lead }) => lead).map(({ name: leadName }) => leadName), people };
});

const knownCollected: readonly [string, number][] = [
  ["k:noor", 4],
  ["k:felix", 6],
  ["k:priya", 9],
  ["k:hana", 6],
  ["k:mei", 18],
  ["k:jonas", 24],
  ["k:amara", 30],
  ["k:leo", 37],
  ["k:sofia", 44],
  ["k:ivy", 59],
  ["k:lina", 21],
];

const strangersCollected = pages
  .filter(({ team }, index) => knownPeople[team] === undefined && index % 3 !== 1)
  .slice(0, 18)
  .flatMap(({ people }, index) => people.slice(0, Math.min(people.length - 1, 1 + (index % 4))).map(({ key }, place): [string, number] => [key, now - (3 + index * 4 + place) * day]));

export const roundFourCast: Cast = {
  pages,
  collectedAt: new Map([...knownCollected.map(([key, daysAgo]): [string, number] => [key, now - daysAgo * day]), ...strangersCollected]),
};
