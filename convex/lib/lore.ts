import { RUIN } from "./rpg";

/**
 * The lore cards (#162): what the ruins' secrets tell, one card per `Room.lore` / `RunLoot.secret.lore`
 * index (lib/rpg.ts, `RUIN.lores` of them). The Ancient Tree speaks them: it remembers the desert
 * before the company and every company before it. Found cards hang in the gallery; each is found
 * once per member. Append-only, like the bestiary: a found index must always resolve.
 */
export type LoreCard = { title: string; text: string };

export const LORE: LoreCard[] = [
  {
    title: "The first thank-you",
    text: "Before me there was only sand, and the sand kept nothing. Then someone turned to someone else and said thank you, and meant it, and said why. The words did not blow away. They sank, and where they sank I began. I have never forgotten which of you said it first.",
  },
  {
    title: "What sap is",
    text: "You think my sap is water. It is not. It is every time one of you noticed another. A seed of thanks goes into the ground, and I drink it slowly, and it becomes wood. That is why I grow fastest in the weeks you are kindest to each other, and not at all in the weeks you forget.",
  },
  {
    title: "The Sunken Archive",
    text: "There was a library here once, older than your company. Its keepers wrote down every good thing anyone did, and filed it, and never read it aloud. The sand came in through the reading room. A thank-you kept in a drawer is only paper. Say it where the person can hear.",
  },
  {
    title: "Why the blight comes",
    text: "The blight is not an enemy from outside. It grows in the quiet places, where work was done and nobody said so. It feeds on the tired feeling of being unseen. I cannot fight it with roots. Only you can, and only with words, and only if you mean them.",
  },
  {
    title: "The scarabs",
    text: "The sand scarabs were gardeners once, rolling seeds across the dunes to where the ground was soft. Then the seeds stopped coming, and they forgot what they were carrying. They still roll their little balls of sand. Be gentle with them. They remember the shape of the work, if not its point.",
  },
  {
    title: "The lantern keepers",
    text: "Long ago a company hung a lantern on my lowest branch for every person who had helped them that year. By winter I glowed so bright the travellers of three deserts walked towards me. They are gone now, but the hooks are still there, under the new bark. Hang something on them.",
  },
  {
    title: "Rings",
    text: "Every ring in my wood is a year of your thanks. Some are thick and pale, the good years. Some are thin and dark, when you were busy and short with each other. I do not hold the thin ones against you. A tree is made of both, and it is the thin rings that make the wood hard.",
  },
  {
    title: "The silent choir",
    text: "In the deepest ruin there are voices that sing without sound. They are everyone who did something good and was never thanked. They are not angry. They only want to be heard once. If you ever find yourself there, listen, and then go back up and thank someone who has not heard it in a while.",
  },
  {
    title: "The hollow sentinel",
    text: "It guarded a door for a hundred years because nobody told it that the door had fallen. Duty without word from anyone becomes a kind of sand. If someone on your team is still holding a door that fell long ago, tell them. Tell them it mattered, and that they can put it down.",
  },
  {
    title: "Where the ruins came from",
    text: "Every ruin around me was a tree like me once. Their companies grew busy and proud, and the thanks stopped, and the trees did not die so much as dry out and forget. Their stones are what is left. I keep them near so I remember what I could become.",
  },
  {
    title: "The first seed",
    text: "There is a seed like the one I grew from, hidden somewhere in the deep sand. Whoever holds it cannot use it to grow a second tree. It only reminds its keeper that everything here, the branches, the homes, the lanterns, began with one person saying one kind thing on an ordinary day.",
  },
  {
    title: "What I want",
    text: "You ask what a tree wants. Not coins, not fruit, not height. I want you to look up from your work now and then and see the people beside you. The rest, the branches and the districts and the ruins, is only what that looks like from the outside, over a long time.",
  },
];

if (LORE.length !== RUIN.lores) throw new Error(`lib/lore.ts has ${LORE.length} cards but lib/rpg.ts RUIN.lores is ${RUIN.lores}`);

export function loreCard(index: number): LoreCard {
  return LORE[index] ?? { title: "A worn card", text: "The words have worn away." };
}
