import { writeFileSync } from "node:fs";
import { artOf, cardPictureOf } from "../../../convex/slack/cardDrawing";
import type { DrawnCard } from "../../../convex/slack/playerCard";

const site = "https://different-dog-467.convex.site";
const appleEmoji = (code: string) => `https://a.slack-edge.com/production-standard-emoji-assets/14.0/apple-large/${code}.png`;
const into = process.argv[2] ?? ".";

const rich: DrawnCard = {
  name: "Wren Alder",
  face: { picture: null, initials: "WA" },
  level: { level: 8, xp: 2310, share: 0.62 },
  team: { name: "Workflows", crest: "https://res.cloudinary.com/dmukukwp6/image/upload/c_limit,w_160,f_auto,q_auto/v1743523365/messaging_crest_8de90d3c39.png" },
  place: { rank: 2, tied: false, thoughtful: 5 },
  hoggies: { found: 64, total: 151, rarest: { name: "Wizard", rarity: "legendary", picture: `${site}/share/wizard.png`, foundAt: Date.UTC(2026, 9, 3) } },
  people: { held: 24, newest: [{ picture: null, initials: "IF" }, { picture: null, initials: "BO" }, { picture: null, initials: "JP" }] },
  emojis: { count: 7, pictures: [appleEmoji("1f994"), appleEmoji("1f389"), appleEmoji("1f680"), appleEmoji("2728")] },
  medals: { count: 4, best: ["gold", "silver", "bronze"] },
};

const quiet: DrawnCard = {
  name: "Ivo Fenn",
  face: { picture: null, initials: "IF" },
  level: { level: 1, xp: 0, share: 0 },
  team: null,
  place: null,
  hoggies: { found: 0, total: 151, rarest: null },
  people: { held: 0, newest: [] },
  emojis: { count: 0, pictures: [] },
  medals: { count: 0, best: [] },
};

for (const [name, card] of Object.entries({ rich, quiet })) {
  const png = await cardPictureOf(card, (await artOf(card)).art);
  writeFileSync(`${into}/${name}.png`, png);
  console.log(`${name}.png ${png.byteLength} bytes`);
}
