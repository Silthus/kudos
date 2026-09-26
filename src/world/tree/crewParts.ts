import { PALETTE, PixelCanvas, type PixelMap } from "../pixels";
import { hash } from "../tiles";

/**
 * The crew's parts for the Ancient Tree (#161, plan #152 §S6), our own pixel art in the dusk palette.
 * The seven structures a crew can build stand on the ground by their district, each with its bottom
 * centre on a tile's front corner like a place: a lantern bridge over a runnel, a windmill tower
 * (its sails a sprite of their own, turning on the hub), a bell in a timber frame, striped market
 * awnings with bunting, an oasis garden of reeds and lilies, a stargazer deck on stilts, and a stair
 * going down through the roots. The plaque carries the names of everyone who paid in.
 *
 * The other parts change what's already there: a district style recolours its lawn and paths and
 * scatters petals, glints or moss over them; a canopy colour swaps the colours of the tree's leaves;
 * the banner is a cloth band across the trunk with the crew's saying set over it in the page. The
 * statue is an art slot of its own, so here it's only the empty plinth it stands on. Every part has
 * a 24 × 24 thumbnail for the catalogue.
 */

type Pt = [number, number];

/** A 1 px line from one point to another. */
function line(c: PixelCanvas, [x0, y0]: Pt, [x1, y1]: Pt, ch: string) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) c.set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), ch);
  return c;
}

/** A rope hung between two points, sagging `sag` px at its middle; `at(x)` is its height there. */
function rope(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, sag: number, ch: string, thick = 1) {
  const at = (x: number) => Math.round(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) + sag * (1 - ((2 * (x - x0)) / (x1 - x0) - 1) ** 2));
  for (let x = x0; x <= x1; x++) for (let j = 0; j < thick; j++) c.set(x, at(x) + j, ch);
  return at;
}

/** A lantern hanging from (x, y): a short cord, a cap, a lit glass with its bright core, a foot. */
function lantern(c: PixelCanvas, x: number, y: number, cord = 1) {
  c.rect(x, y, 1, cord, "b");
  c.rect(x - 1, y + cord, 3, 1, "b").rect(x - 1, y + cord + 1, 3, 3, "l").set(x, y + cord + 2, "c").rect(x - 1, y + cord + 4, 3, 1, "E");
  return c;
}

// ---------------------------------------------------------------------------------------------
// The structures.

/** A rope bridge over a little runnel: a sagging deck of planks between two posts, lanterns on its rail. */
function lanternBridge() {
  const c = new PixelCanvas(46, 34);
  // The runnel under it, between stones.
  c.polygon([[8, 29], [38, 29], [34, 33], [12, 33]], "W");
  c.rect(14, 30, 4, 1, "w").rect(25, 31, 5, 1, "w").set(21, 30, "c");
  c.rect(5, 29, 4, 3, "M").rect(5, 29, 3, 1, "m").rect(37, 29, 4, 3, "M").rect(37, 29, 3, 1, "m");
  // The deck: planks lit on top, their seams, a dark underside.
  const deck = rope(c, 4, 41, 18, 18, 6, "B", 2);
  for (let x = 5; x < 41; x++) {
    if (x % 3 === 0) c.set(x, deck(x), "s").set(x, deck(x) + 1, "b");
    c.set(x, deck(x) + 2, "b");
  }
  // The posts, and the hand-rope from post to post with its stringers down to the deck.
  for (const x of [3, 41]) c.rect(x, 7, 2, 25, "s").rect(x, 7, 1, 25, "B").rect(x - 1, 6, 4, 1, "b");
  const rail = rope(c, 4, 41, 8, 8, 5, "A");
  for (let x = 8; x < 40; x += 5) for (let y = rail(x) + 1; y < deck(x); y++) c.set(x, y, "D");
  // Lanterns under the rail.
  for (const x of [11, 19, 27, 35]) lantern(c, x, rail(x) + 1);
  return c.outline().map();
}

/** The windmill's tower, without its sails: stone foot, timber body, an ember cap, a lit door. */
function windmillTower() {
  const c = new PixelCanvas(30, 52);
  const cx = 15;
  // The timber body, tapering, lit on its left, its boards.
  c.polygon([[5, 48], [25, 48], [21, 17], [9, 17]], "s");
  c.polygon([[5, 48], [15, 48], [15, 17], [9, 17]], "B");
  for (let y = 21; y < 46; y += 4) for (let x = 0; x < 30; x++) if (c.get(x, y) !== ".") c.set(x, y, "b");
  // The stone foot.
  c.rect(4, 44, 22, 7, "m").rect(15, 44, 11, 7, "M");
  for (const [x, y] of [[6, 46], [11, 48], [18, 46], [23, 48]] as const) c.rect(x, y, 3, 1, c.get(x, y) === "m" ? "M" : "k");
  // The door, lit, and a window high up.
  c.rect(12, 38, 6, 13, "k").rect(13, 39, 4, 12, "l").rect(13, 39, 1, 12, "c").rect(14, 37, 2, 1, "k");
  c.rect(17, 27, 3, 4, "k").rect(18, 28, 1, 2, "l");
  // The cap: a pointed ember roof over the top, its eave, the hub's axle out front.
  c.polygon([[6, 20], [24, 20], [15, 5]], "E");
  c.polygon([[6, 20], [15, 20], [15, 5]], "e");
  c.rect(6, 20, 19, 1, "b");
  c.set(15, 4, "b").set(15, 3, "l");
  c.disc(cx + 0.5, 16.5, 2, "b").set(cx, 16, "B");
  return c.outline().map();
}

/** Where the sails' centre goes on the windmill's tower sprite. */
export const WINDMILL_HUB = { x: 15, y: 16 } as const;

const SAILS = 33;

/**
 * The windmill's four sails, a lattice of parchment on a bark frame, turned a quarter of a quarter
 * turn per frame (frame % 4: 0°, 22.5°, 45°, 67.5°); four frames make a full sweep because the
 * sails look the same every quarter turn. The hub is the sprite's centre pixel.
 */
export function windmillSails(frame: number): PixelMap {
  const c = new PixelCanvas(SAILS, SAILS);
  const h = (SAILS - 1) / 2;
  const turn = ((((frame % 4) + 4) % 4) * Math.PI) / 8;
  for (let y = 0; y < SAILS; y++)
    for (let x = 0; x < SAILS; x++) {
      const dx = x - h;
      const dy = y - h;
      for (let k = 0; k < 4; k++) {
        const a = turn + (k * Math.PI) / 2;
        const along = dx * Math.cos(a) + dy * Math.sin(a);
        const across = -dx * Math.sin(a) + dy * Math.cos(a);
        if (along < 0 || along > 14.5) continue;
        if (Math.abs(across) < 0.75) c.set(x, y, "b");
        else if (along > 3.5 && across > 0 && across < 4.8) {
          const bar = Math.round(along) % 4 === 0 || across > 3.9;
          c.set(x, y, bar ? "b" : Math.round(across) % 2 ? "p" : "P");
        }
      }
    }
  c.disc(h + 0.5, h + 0.5, 2, "b").set(h, h, "l").set(h - 1, h - 1, "B");
  return c.outline().map();
}

/** A bronze bell hanging from a timber frame under a little roof, its pull-rope down one side. */
function bell() {
  const c = new PixelCanvas(30, 44);
  // A stone step.
  c.rect(1, 39, 28, 4, "M").rect(1, 39, 28, 1, "m");
  // The posts and the beam, a little ridge roof over it.
  for (const x of [4, 24]) c.rect(x, 9, 3, 30, "s").rect(x, 9, 1, 30, "B");
  c.rect(2, 8, 26, 3, "s").rect(2, 8, 26, 1, "B").rect(2, 10, 26, 1, "b");
  c.polygon([[0, 8], [30, 8], [15, 1]], "b").polygon([[0, 8], [15, 8], [15, 1]], "s");
  // Braces from post to beam.
  line(c, [7, 16], [10, 11], "s");
  line(c, [23, 16], [20, 11], "s");
  // The bell: a yoke, its shoulder, flaring to a lip; lit on its left.
  c.polygon([[11, 15], [19, 15], [22, 29], [8, 29]], "E").disc(15, 16, 4, "E");
  for (let y = 11; y < 30; y++) for (let x = 7; x < 15; x++) if (c.get(x, y) === "E") c.set(x, y, "l");
  c.rect(14, 11, 2, 2, "b");
  c.rect(11, 15, 1, 11, "c").set(12, 14, "c");
  c.rect(9, 25, 12, 1, "E").rect(9, 25, 6, 1, "D");
  c.rect(7, 29, 16, 2, "s").rect(7, 29, 8, 1, "D");
  // The clapper, and the pull-rope hanging from it, knotted at its end.
  c.rect(14, 31, 2, 2, "b").rect(15, 33, 1, 4, "A").rect(14, 37, 3, 1, "P");
  return c.outline().map();
}

/** Two striped awnings on posts, bunting strung over them from pole to pole: the market beside the store stall. */
function marketAwnings() {
  const c = new PixelCanvas(48, 44);
  const post = (x: number, top: number) => c.rect(x, top, 2, 42 - top, "s").rect(x, top, 1, 42 - top, "B");
  const awning = (x0: number, y0: number, w: number, pole: Pt) => {
    post(x0 + 1, y0 + 6);
    post(x0 + w - 3, y0 + 6);
    post(pole[0], pole[1]).rect(pole[0], pole[1] - 1, 2, 1, "l");
    // The cloth: a lean-to seen from the front, wider at its front edge, a valance under it.
    c.polygon([[x0 + 2, y0], [x0 + w - 2, y0], [x0 + w, y0 + 7], [x0, y0 + 7]], "e").rect(x0, y0 + 7, w, 1, "e");
    const stripe = (x: number) => Math.floor((x - x0) / 3) % 2 === 1;
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + w; x++) if (c.get(x, y) === "e" && stripe(x)) c.set(x, y, "p");
    for (let x = x0; x < x0 + w; x++) if (c.get(x, y0) !== ".") c.set(x, y0, stripe(x) ? "P" : "E");
    // The scallops: each stripe's middle hangs a pixel lower.
    for (let x = x0 + 1; x < x0 + w; x += 3) c.set(x, y0 + 8, stripe(x) ? "p" : "e");
  };
  awning(24, 10, 22, [43, 2]);
  awning(1, 16, 20, [2, 6]);
  // Crates of goods under the awnings.
  c.rect(5, 35, 7, 7, "s").rect(5, 35, 7, 1, "B").rect(5, 38, 7, 1, "b");
  c.disc(7, 34, 1.5, "l").disc(10, 34, 1.5, "e").set(7, 33, "c");
  c.rect(29, 36, 6, 6, "P").rect(29, 36, 6, 1, "p").rect(31, 34, 3, 2, "u").set(32, 33, "g");
  // Bunting from pole to pole, little flags hung along it.
  const flags = ["l", "e", "p", "v"];
  const at = rope(c, 3, 43, 6, 2, 4, "b");
  for (let i = 0, x = 6; x < 41; x += 4, i++) c.rect(x, at(x) + 1, 3, 1, flags[i % 4]).set(x + 1, at(x) + 2, flags[i % 4]);
  return c.outline().map();
}

/** A sliver of pond with lilies in flower, reeds and bulrushes round it, a few stones. No animals. */
function oasisGarden() {
  const c = new PixelCanvas(46, 30);
  // The water.
  c.disc(23, 23, 9, "W");
  for (let y = 0; y < 30; y++) for (let x = 0; x < 46; x++) if (((x + 0.5 - 23) / 17) ** 2 + ((y + 0.5 - 24) / 5.5) ** 2 <= 1) c.set(x, y, "W");
  for (let y = 0; y < 18; y++) for (let x = 0; x < 46; x++) if (c.get(x, y) === "W") c.set(x, y, ".");
  c.rect(12, 21, 5, 1, "w").rect(27, 26, 6, 1, "w").rect(20, 27, 3, 1, "w").set(31, 21, "c");
  // Two lily pads, each with its notch, a pale flower on each.
  for (const [x, y] of [[17, 24], [29, 22]] as const) {
    c.polygon([[x - 3, y], [x, y - 2], [x + 3, y], [x, y + 2]], "g").set(x - 2, y, "u").set(x + 1, y + 1, "G").set(x + 2, y, "W");
    c.rect(x - 1, y - 2, 3, 1, "p").set(x, y - 3, "c").set(x, y - 2, "l");
  }
  // Stones on the near bank.
  c.rect(6, 25, 4, 3, "M").rect(6, 25, 3, 1, "m").rect(36, 26, 5, 3, "M").rect(36, 26, 3, 1, "m").rect(24, 29, 3, 1, "M");
  // Reeds and bulrushes, in two clumps.
  const reed = (x: number, h: number, lean: number, ch: string, head = false) => {
    for (let j = 0; j < h; j++) c.set(x + Math.round((lean * j) / h), 25 - j, ch);
    if (head) c.rect(x + lean, 25 - h - 2, 1, 3, "s").set(x + lean, 25 - h - 3, "b");
  };
  for (const [x, h, lean, ch, head] of [[3, 12, -1, "G", false], [5, 17, 0, "g", true], [7, 13, 1, "u", false], [9, 10, 2, "g", false], [4, 8, -2, "u", false]] as const) reed(x, h, lean, ch, head);
  for (const [x, h, lean, ch, head] of [[37, 11, -2, "g", false], [39, 16, 0, "G", true], [41, 14, 1, "g", true], [43, 9, 2, "u", false], [40, 7, -1, "u", false]] as const) reed(x, h, lean, ch, head);
  return c.outline().map();
}

/** A raised timber deck on braced stilts, railed, with a brass telescope on a tripod and a lantern. */
function stargazerDeck() {
  const c = new PixelCanvas(38, 54);
  const deck = c.isoBox(2, 2, 3, { left: "s", right: "b", top: "B" }, 35, 3);
  const drop = 53 - 35;
  // Stilts from the deck's three near corners down to the ground, cross-braced; a ladder at the front.
  const stilts: Pt[] = [
    [deck.L[0], deck.L[1] + 3],
    [deck.B[0] - 1, deck.B[1] + 3],
    [deck.R[0] - 2, deck.R[1] + 3],
  ];
  for (const [x, y] of stilts) c.rect(x, y, 2, drop, "s").rect(x, y, 1, drop, "B");
  line(c, [stilts[0][0] + 2, stilts[0][1] + 2], [stilts[1][0] - 1, stilts[1][1] + drop - 3], "b");
  line(c, [stilts[1][0] + 2, stilts[1][1] + drop - 3], [stilts[2][0] - 1, stilts[2][1] + 2], "b");
  for (let y = stilts[1][1] + 2; y < 53; y += 3) c.rect(stilts[1][0] + 2, y, 3, 1, "B");
  c.rect(stilts[1][0] + 4, stilts[1][1], 1, drop, "s");
  // Planks on the deck.
  for (let y = 0; y < deck.B[1]; y++) for (let x = 0; x < 38; x++) if (c.get(x, y) === "B" && (((Math.floor(x / 2) - y) % 5) + 5) % 5 === 0) c.set(x, y, "s");
  // The telescope on its tripod, pointing up at the sky.
  const [tx, ty] = [deck.T[0] + 1, deck.T[1] + 5];
  line(c, [tx, ty], [tx - 3, ty + 7], "b");
  line(c, [tx, ty], [tx + 3, ty + 7], "b");
  line(c, [tx, ty], [tx, ty + 8], "b");
  for (let i = 0; i < 14; i++) {
    const thick = i > 9 ? 4 : i > 4 ? 3 : 2;
    const [x, y] = [tx - 5 + i, ty - Math.floor(i / 2) - thick + 2];
    c.rect(x, y, 1, thick, i === 6 ? "b" : "l").set(x, y + thick - 1, i === 6 ? "b" : "E");
    if (i === 13) c.rect(x, y, 1, thick - 1, "c");
  }
  c.rect(tx - 6, ty, 1, 2, "b");
  // The railing: posts at the corners, a rail round the edge.
  const up = (p: Pt): Pt => [p[0], p[1] - 6];
  for (const [a, b] of [[deck.L, deck.T], [deck.T, deck.R], [deck.L, deck.B], [deck.B, deck.R]] as const) line(c, up(a), up(b), "B");
  for (const p of [deck.L, deck.T, deck.B, deck.R]) c.rect(Math.min(p[0], 34), p[1] - 6, 1, 7, "s");
  for (const [a, b] of [[deck.L, deck.B], [deck.B, deck.R]] as const)
    for (let i = 4; i < 16; i += 4) c.rect(Math.round(a[0] + ((b[0] - a[0]) * i) / 16), Math.round(a[1] + ((b[1] - a[1]) * i) / 16) - 5, 1, 5, "s");
  // A lantern hung off the right-hand post.
  lantern(c, Math.min(deck.R[0], 34), deck.R[1] - 5, 1);
  return c.outline().map();
}

/** Gnarled roots arching over a stone stair that goes down into the dark under the tree. */
function rootStair() {
  const c = new PixelCanvas(46, 42);
  // The opening, dark, and the steps going down into it, narrowing.
  c.polygon([[13, 40], [33, 40], [29, 18], [17, 18]], "k");
  c.polygon([[17, 18], [29, 18], [28, 24], [18, 24]], "d");
  for (let i = 0; i < 5; i++) {
    const y = 38 - i * 4;
    const half = 10 - i * 1.6;
    c.rect(Math.round(23 - half), y, Math.round(half * 2), 1, "m").rect(Math.round(23 - half), y + 1, Math.round(half * 2), 2, "M");
  }
  // The roots: a great arch and a smaller one crossing it, lit on their tops, knotted.
  const arch = (cx: number, base: number, rx: number, ry: number, thick: number, from: number, to: number) => {
    for (let t = from; t <= to; t += 0.02) {
      const x = cx + Math.cos(t) * rx + Math.sin(t * 7) * 0.8;
      const y = base - Math.sin(t) * ry;
      c.disc(x, y, thick, "s");
    }
    for (let t = from; t <= to; t += 0.02) {
      const x = cx + Math.cos(t) * rx + Math.sin(t * 7) * 0.8;
      const y = base - Math.sin(t) * ry;
      c.set(Math.round(x), Math.round(y - thick), "B").set(Math.round(x), Math.round(y + thick) - 1, "b");
    }
  };
  arch(23, 41, 17, 32, 2.6, 0, Math.PI);
  arch(34, 41, 9, 21, 1.8, 0, 1.5);
  arch(12, 41, 9, 21, 1.8, 1.64, Math.PI);
  // Knots and a glint of sap in the wood.
  c.set(14, 14, "b").set(15, 13, "b").set(33, 12, "b").set(22, 9, "y").set(35, 20, "y");
  // Tendrils running off along the ground.
  for (const [a, b] of [[[4, 40], [0, 41]], [[42, 40], [45, 41]], [[8, 38], [3, 37]]] as [Pt, Pt][]) line(c, a, b, "s");
  return c.outline().map();
}

export const STRUCTURE_SPRITES = {
  structure_lantern_bridge: lanternBridge(),
  structure_windmill: windmillTower(),
  structure_bell: bell(),
  structure_market_awnings: marketAwnings(),
  structure_oasis_garden: oasisGarden(),
  structure_stargazer_deck: stargazerDeck(),
  structure_root_stair: rootStair(),
} satisfies Record<string, PixelMap>;

export type StructureId = keyof typeof STRUCTURE_SPRITES;

// ---------------------------------------------------------------------------------------------
// The plaque and the banner.

/**
 * The crew's plaque: a carved board on two posts, a bark frame round a face of pale wood with the
 * names cut into it, a carved tree on top and a lantern hanging from one post.
 */
export function plaqueSprite(): PixelMap {
  const c = new PixelCanvas(36, 42);
  // The posts.
  for (const x of [5, 25]) c.rect(x, 12, 3, 29, "s").rect(x, 12, 1, 29, "B");
  // The board: a dark frame, a lit inner edge, the face.
  c.rect(2, 11, 29, 21, "b").rect(3, 12, 27, 19, "B").rect(4, 13, 25, 17, "P");
  c.rect(4, 13, 25, 1, "p");
  // The names, engraved: rows of dark strokes of their own lengths.
  for (let row = 0; row < 5; row++)
    for (let x = 6, n = 0; x < 27; n++) {
      const len = 2 + Math.floor(hash(row, n, 161) * 5);
      c.rect(x, 16 + row * 3, Math.min(len, 27 - x), 1, "s");
      x += len + 1 + Math.floor(hash(row, n, 162) * 2);
    }
  // The carved tree on top: a trunk and a round crown.
  c.rect(15, 6, 3, 5, "s").rect(15, 6, 1, 5, "B").rect(13, 10, 7, 1, "b");
  c.disc(16.5, 5, 4.5, "g").disc(15.5, 4, 2.5, "u").set(18, 7, "G").set(19, 6, "G").set(17, 2, "y");
  // A lantern on an iron arm off the right-hand post.
  c.rect(28, 14, 5, 1, "b");
  lantern(c, 32, 15, 1);
  return c.outline().map();
}

/**
 * A cloth banner `width` px wide and 12 tall: parchment with ember trim along both edges, shaded
 * at its folds, sagging a pixel at the middle, a swallow-tailed end hanging down behind it at each
 * side. The face is left plain for the crew's saying, which is set over it in the page.
 */
export function bannerCloth(width: number): PixelMap {
  const w = Math.max(16, Math.round(width));
  const c = new PixelCanvas(w, 12);
  const sag = (x: number) => (x >= w / 3 && x < (2 * w) / 3 ? 1 : 0);
  // The tails: the cloth's ends hanging behind the band, lower, swallow-cut.
  for (const x0 of [1, w - 5]) c.rect(x0, 3, 4, 7, "E").rect(x0, 10, 4, 1, "E").set(x0 + (x0 === 1 ? 1 : 2), 10, ".");
  for (let x = 3; x < w - 3; x++) {
    const top = 1 + sag(x);
    c.set(x, top, "e").rect(x, top + 1, 1, 5, "p").set(x, top + 6, "e");
    // Folds: a shaded column every so often, and where the band turns back at the ends.
    const fold = x === 3 || x === w - 4 || (x > 5 && x < w - 6 && (x - 5) % 9 === 0);
    if (fold) c.rect(x, top + 1, 1, 5, "P");
  }
  return c.outline().map();
}

/**
 * A stepped stone plinth, empty: a low step `size` tiles square, a block `inner` tiles square on it
 * with a lit top and carved bands, a laurel sprig laid on the step in front. Sizes are in quarter
 * tiles so every corner lands on a whole pixel.
 */
function plinth({ w, h, size, inner, stepH, blockH }: { w: number; h: number; size: number; inner: number; stepH: number; blockH: number }) {
  const c = new PixelCanvas(w, h);
  const step = c.isoBox(size, size, stepH, { left: "m", right: "M", top: "m" }, h - 1, (w - size * 16) / 2);
  const onStep = h - 1 - stepH - size * 4;
  const block = c.isoBox(inner, inner, blockH, { left: "m", right: "M", top: "c" }, onStep + inner * 4, (w - inner * 16) / 2);
  const run = Math.floor(inner * 8);
  c.wall(block, "left", 0, blockH - 2, run, 1, "M").wall(block, "right", 0, blockH - 2, run, 1, "k");
  // The laurel: a stem laid along the step's front-left lip, its leaves over the edge.
  const [bx, by] = step.B;
  for (let x = bx - 10; x < bx - 3; x++) {
    const y = by - Math.ceil((bx - x) / 2);
    c.set(x, y, "G");
    if (x % 2) c.set(x, y - 1, "u");
    else c.set(x, y + 1, "g");
  }
  return c.outline().map();
}

const PLINTH = { w: 28, h: 20, size: 1.5, inner: 1, stepH: 2, blockH: 6 } as const;

/**
 * The world-size plinth the statue stands on at the tree's foot, with its bottom centre on the
 * tile's front corner. The statue itself is an art slot placed over it; `STATUE_PLINTH_TOP` is the
 * centre of the plinth's top face, where the statue's feet go.
 */
export const statuePlinth = (): PixelMap => plinth(PLINTH);

export const STATUE_PLINTH_TOP = {
  x: PLINTH.w / 2,
  y: Math.round(PLINTH.h - 1 - PLINTH.stepH - PLINTH.size * 4 - PLINTH.blockH),
} as const;

// ---------------------------------------------------------------------------------------------
// District styles and canopy colours.

type DistrictStyleId = "mossy" | "lantern" | "blossom" | "crystal";

/**
 * How a district's ground looks in each style, by the hex of each ground pixel: the lawn's three
 * greens (g, G, u) and the path's stones (P, m, M) recoloured, and accents scattered over the top
 * at the given chance per pixel. Mossy is deeper and cooler; lantern is lit gold; blossom is
 * pink-tinged with fallen petals; crystal is blue-violet with pale glints.
 */
export const DISTRICT_STYLE_GROUND: Record<DistrictStyleId, { recolour: Record<string, string>; sprinkle: { hex: string; chance: number }[] }> = {
  mossy: {
    recolour: { [PALETTE.g]: "#3e6e3c", [PALETTE.G]: "#244629", [PALETTE.u]: "#58904c", [PALETTE.P]: "#a8ae8a", [PALETTE.m]: "#8c9684", [PALETTE.M]: "#5c6656" },
    sprinkle: [{ hex: "#1b3a22", chance: 0.06 }],
  },
  lantern: {
    recolour: { [PALETTE.g]: "#667c34", [PALETTE.G]: "#3f5424", [PALETTE.u]: "#91ab48", [PALETTE.P]: "#e2c98e", [PALETTE.m]: "#c6b089", [PALETTE.M]: "#8a7556" },
    sprinkle: [{ hex: "#f7c24a", chance: 0.03 }],
  },
  blossom: {
    recolour: { [PALETTE.g]: "#687a4c", [PALETTE.G]: "#454f34", [PALETTE.u]: "#8da66a", [PALETTE.P]: "#e4c8bd", [PALETTE.m]: "#c0a6a4", [PALETTE.M]: "#896f70" },
    sprinkle: [
      { hex: "#eb9ab2", chance: 0.03 },
      { hex: "#f8d2dc", chance: 0.012 },
    ],
  },
  crystal: {
    recolour: { [PALETTE.g]: "#4a6a7c", [PALETTE.G]: "#2e3d5c", [PALETTE.u]: "#6689a4", [PALETTE.P]: "#c6c5dc", [PALETTE.m]: "#a2a4c0", [PALETTE.M]: "#6c6d90" },
    sprinkle: [{ hex: "#b6f0ff", chance: 0.03 }],
  },
};

type CanopyColourId = "amber" | "rose" | "sap green" | "moon blue";

/** The tree's leaf colours (g mid, u lit, G shade, k the dark rim) in each canopy colour a crew can choose. */
export const CANOPY_COLOURS_PALETTE: Record<CanopyColourId, Record<"g" | "G" | "u" | "k", string>> = {
  amber: { g: "#c4862c", G: "#87561f", u: "#e8b24e", k: "#2a1812" },
  rose: { g: "#bd6479", G: "#7e3a52", u: "#e290a4", k: "#261222" },
  "sap green": { g: "#56a043", G: "#2f6a2e", u: "#8fd66e", k: "#10201a" },
  "moon blue": { g: "#5a79b4", G: "#344a80", u: "#8db0e0", k: "#131a32" },
};

// ---------------------------------------------------------------------------------------------
// Thumbnails for the catalogue: 24 × 24 each.

const THUMB = 24;

const structureThumbs: Record<StructureId, () => PixelMap> = {
  structure_lantern_bridge() {
    const c = new PixelCanvas(THUMB, THUMB);
    c.rect(1, 21, 22, 2, "W").rect(4, 21, 4, 1, "w").rect(14, 22, 3, 1, "w");
    const deck = rope(c, 2, 21, 12, 12, 5, "B", 2);
    for (let x = 3; x < 21; x++) {
      if (x % 3 === 0) c.set(x, deck(x), "s");
      c.set(x, deck(x) + 2, "b");
    }
    for (const x of [1, 21]) c.rect(x, 4, 2, 19, "s").rect(x, 4, 1, 19, "B");
    const rail = rope(c, 2, 21, 4, 4, 3, "A");
    for (const x of [6, 12, 18]) lantern(c, x, rail(x) + 1, 0);
    return c.outline().map();
  },
  structure_windmill() {
    const c = new PixelCanvas(THUMB, THUMB);
    c.polygon([[8, 23], [16, 23], [14, 11], [10, 11]], "s").polygon([[8, 23], [12, 23], [12, 11], [10, 11]], "B");
    c.rect(11, 19, 2, 4, "l");
    c.polygon([[8, 12], [16, 12], [12, 6]], "E").polygon([[8, 12], [12, 12], [12, 6]], "e");
    const [hx, hy] = [12, 9];
    for (const [dx, dy] of [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const) {
      const perp: Pt = [-dy, dx];
      for (let i = 1; i <= 8; i++) {
        c.set(hx + dx * i, hy + dy * i, "b");
        if (i > 2) c.set(hx + dx * i + perp[0], hy + dy * i + perp[1], i % 3 ? "p" : "P").set(hx + dx * i + perp[0] * 2, hy + dy * i + perp[1] * 2, i % 3 ? "P" : "b");
      }
    }
    c.rect(hx - 1, hy - 1, 2, 2, "b").set(hx - 1, hy - 1, "l");
    return c.outline().map();
  },
  structure_bell() {
    const c = new PixelCanvas(THUMB, THUMB);
    for (const x of [2, 19]) c.rect(x, 5, 3, 18, "s").rect(x, 5, 1, 18, "B");
    c.rect(1, 4, 22, 2, "s").rect(1, 4, 22, 1, "B").polygon([[0, 4], [24, 4], [12, 0]], "b");
    c.rect(11, 6, 2, 1, "b");
    c.polygon([[9, 8], [15, 8], [17, 17], [7, 17]], "E").polygon([[9, 8], [12, 8], [12, 17], [7, 17]], "l");
    c.rect(9, 7, 6, 1, "l").rect(12, 7, 3, 1, "E").rect(9, 9, 1, 5, "c");
    c.rect(6, 17, 12, 1, "s").rect(11, 18, 2, 2, "b").rect(14, 19, 1, 4, "A");
    return c.outline().map();
  },
  structure_market_awnings() {
    const c = new PixelCanvas(THUMB, THUMB);
    for (const x of [3, 19]) c.rect(x, 9, 2, 14, "s").rect(x, 9, 1, 14, "B");
    c.polygon([[3, 4], [21, 4], [23, 10], [1, 10]], "e");
    for (let y = 4; y < 11; y++) for (let x = 0; x < THUMB; x++) if (c.get(x, y) === "e" && Math.floor((x - 1) / 3) % 2) c.set(x, y, "p");
    for (let x = 1; x < 23; x++) if (x % 3 !== 0) c.set(x, 10, Math.floor((x - 1) / 3) % 2 ? "p" : "e");
    const at = rope(c, 5, 19, 13, 13, 2, "b");
    ["l", "e", "v", "l"].forEach((f, i) => c.rect(6 + i * 3, at(6 + i * 3) + 1, 2, 1, f).set(6 + i * 3, at(6 + i * 3) + 2, f));
    c.rect(7, 18, 5, 5, "s").rect(7, 18, 5, 1, "B").disc(9, 17, 1.2, "l").rect(13, 19, 4, 4, "P").set(14, 18, "u");
    return c.outline().map();
  },
  structure_oasis_garden() {
    const c = new PixelCanvas(THUMB, THUMB);
    for (let y = 0; y < THUMB; y++) for (let x = 0; x < THUMB; x++) if (((x + 0.5 - 12) / 10.5) ** 2 + ((y + 0.5 - 18) / 4.5) ** 2 <= 1) c.set(x, y, "W");
    c.rect(4, 19, 3, 1, "w").set(17, 20, "c");
    c.polygon([[8, 18], [11, 16], [14, 18], [11, 20]], "g").set(13, 18, "W").set(9, 18, "u");
    c.rect(10, 15, 3, 1, "p").set(11, 14, "c").set(11, 15, "l");
    for (const [x, h, lean, ch] of [[2, 11, -1, "g"], [4, 15, 0, "G"], [6, 9, 1, "u"], [18, 12, 0, "g"], [20, 16, 1, "G"], [22, 9, 1, "u"]] as const)
      for (let j = 0; j < h; j++) c.set(x + Math.round((lean * j) / h), 19 - j, ch);
    c.rect(4, 2, 1, 3, "s").rect(20, 1, 1, 3, "s");
    c.rect(15, 21, 3, 2, "M").set(15, 21, "m");
    return c.outline().map();
  },
  structure_stargazer_deck() {
    const c = new PixelCanvas(THUMB, THUMB);
    // Stars over it, a small deck high on stilts, the telescope big on it.
    c.set(2, 2, "c").set(7, 5, "p").set(20, 1, "c");
    c.polygon([[4, 15], [12, 11], [20, 15], [12, 19]], "B");
    c.polygon([[4, 15], [12, 19], [12, 21], [4, 17]], "s").polygon([[12, 19], [20, 15], [20, 17], [12, 21]], "b");
    for (const x of [4, 11, 18]) c.rect(x, x === 11 ? 21 : 17, 2, x === 11 ? 3 : 7, "s");
    line(c, [6, 18], [10, 22], "b");
    line(c, [13, 22], [17, 18], "b");
    line(c, [4, 12], [12, 16], "B");
    line(c, [12, 16], [20, 12], "B");
    line(c, [11, 11], [9, 15], "b");
    line(c, [11, 11], [13, 15], "b");
    for (let i = 0; i < 12; i++) {
      const thick = i > 8 ? 3 : 2;
      const [x, y] = [6 + i, 12 - Math.floor(i / 2) - thick + 1];
      c.rect(x, y, 1, thick, "l").set(x, y + thick - 1, "E");
      if (i === 11) c.rect(x, y, 1, thick - 1, "c");
    }
    lantern(c, 20, 7, 1);
    return c.outline().map();
  },
  structure_root_stair() {
    const c = new PixelCanvas(THUMB, THUMB);
    c.polygon([[6, 23], [18, 23], [15, 10], [9, 10]], "k");
    for (let i = 0; i < 3; i++) {
      const y = 21 - i * 4;
      const half = 5.5 - i;
      c.rect(Math.round(12 - half), y, Math.round(half * 2), 1, "m").rect(Math.round(12 - half), y + 1, Math.round(half * 2), 1, "M");
    }
    for (let t = 0; t <= Math.PI; t += 0.03) c.disc(12 + Math.cos(t) * 9 + Math.sin(t * 6) * 0.6, 23 - Math.sin(t) * 18, 1.8, "s");
    for (let t = 0; t <= Math.PI; t += 0.03) c.set(Math.round(12 + Math.cos(t) * 9 + Math.sin(t * 6) * 0.6), Math.round(23 - Math.sin(t) * 18 - 1.8), "B");
    c.set(11, 5, "y").set(4, 12, "b");
    return c.outline().map();
  },
};

/** A small iso diamond of lawn in a district style, with the style's own detail on it. */
function styleThumb(style: DistrictStyleId): PixelMap {
  const c = new PixelCanvas(THUMB, THUMB);
  const { recolour, sprinkle } = DISTRICT_STYLE_GROUND[style];
  // The lawn: a diamond two tiles across, with its earth edge under it.
  c.polygon([[1, 15], [12, 9.5], [23, 15], [12, 20.5]], "s").polygon([[1, 13], [12, 7.5], [23, 13], [12, 18.5]], "g");
  for (let y = 0; y < THUMB; y++)
    for (let x = 0; x < THUMB; x++) {
      if (c.get(x, y) !== "g") continue;
      const r = hash(x, y, 163);
      c.set(x, y, r < 0.18 ? "G" : r < 0.34 ? "u" : "g");
      if (hash(x, y, 164) < sprinkle[0].chance * 2.5) c.set(x, y, "r");
    }
  if (style === "mossy") for (const [x, y] of [[6, 13], [15, 11], [12, 15]] as const) c.rect(x, y, 3, 1, "r").rect(x, y - 1, 3, 1, "G").set(x + 1, y - 2, "u");
  if (style === "lantern") {
    c.rect(12, 3, 1, 10, "b").rect(11, 1, 3, 1, "b").rect(11, 2, 3, 3, "l").set(12, 3, "c");
    for (const [x, y] of [[10, 12], [14, 12], [12, 14], [9, 11], [15, 13]] as const) c.set(x, y, "r");
  }
  if (style === "blossom")
    for (const [x, y] of [[6, 13], [12, 10], [17, 14], [11, 16], [14, 12]] as const) c.set(x, y, "q").set(x - 1, y, "r").set(x + 1, y, "r").set(x, y - 1, "r").set(x, y + 1, "r");
  if (style === "crystal")
    for (const [x, y, h] of [[8, 13, 6], [11, 12, 9], [15, 13, 5]] as const) {
      c.polygon([[x - 1.5, y], [x, y - h], [x + 1.5, y]], "Q");
      c.rect(x, y - h + 2, 1, h - 3, "q");
    }
  const crystals = { q: "#dff8ff", Q: "#8a9ee0" };
  return c.outline().map({ g: recolour[PALETTE.g], G: recolour[PALETTE.G], u: recolour[PALETTE.u], r: sprinkle[0].hex, q: sprinkle[1]?.hex ?? crystals.q, Q: crystals.Q });
}

/** A round clump of the canopy on a stub of trunk, in a canopy colour. */
function canopyThumb(colour: CanopyColourId): PixelMap {
  const c = new PixelCanvas(THUMB, THUMB);
  c.rect(11, 16, 3, 7, "s").rect(11, 16, 1, 7, "B");
  // The crown first, then the two lower clumps over it, so each clump's dark rim is on the outside.
  for (const [x, y, r] of [[12, 8, 7], [7, 13, 5.5], [17, 13, 5.5]] as const)
    for (let j = 0; j < THUMB; j++)
      for (let i = 0; i < THUMB; i++) {
        const dx = i + 0.5 - x;
        const dy = j + 0.5 - y;
        const d = Math.hypot(dx, dy);
        if (d > r) continue;
        const light = (-dx * 0.55 - dy * 0.85) / r;
        c.set(i, j, d > r - 1 && light < -0.4 ? "k" : light > 0.35 ? "u" : light < -0.2 ? "G" : "g");
      }
  c.set(9, 5, "c");
  return c.outline().map({ ...CANOPY_COLOURS_PALETTE[colour] });
}

/** A pennant on a pole: parchment with ember trim, a few dashes of its saying. */
function bannerThumb(): PixelMap {
  const c = new PixelCanvas(THUMB, THUMB);
  c.rect(3, 2, 2, 21, "s").rect(3, 2, 1, 21, "B").rect(2, 1, 4, 1, "l");
  c.polygon([[5, 4], [21, 4], [18, 9.5], [21, 15], [5, 15]], "p");
  c.rect(5, 4, 16, 1, "e").rect(5, 14, 15, 1, "e");
  for (let y = 5; y < 14; y++) c.set(5, y, "P");
  c.rect(7, 7, 5, 1, "i").rect(13, 7, 3, 1, "i").rect(7, 10, 3, 1, "i").rect(11, 10, 5, 1, "i");
  return c.outline().map();
}

const statueThumb = () => plinth({ w: THUMB, h: THUMB, size: 1.25, inner: 1, stepH: 3, blockH: 9 });

export type CrewPartThumbKind = "structure" | "district_style" | "canopy_colour" | "banner" | "statue";

const isStructure = (id: string): id is StructureId => id in structureThumbs;
const isStyle = (s: string | undefined): s is DistrictStyleId => !!s && s in DISTRICT_STYLE_GROUND;
const isCanopy = (s: string | undefined): s is CanopyColourId => !!s && s in CANOPY_COLOURS_PALETTE;

/**
 * The part's 24 × 24 icon in the catalogue. A style or a canopy colour shows the chosen option, or
 * the first one; an unknown structure id falls back to the empty plinth.
 */
export function partThumbnail(kind: CrewPartThumbKind, id: string, option?: string): PixelMap {
  switch (kind) {
    case "structure":
      return isStructure(id) ? structureThumbs[id]() : statueThumb();
    case "district_style":
      return styleThumb(isStyle(option) ? option : "mossy");
    case "canopy_colour":
      return canopyThumb(isCanopy(option) ? option : "amber");
    case "banner":
      return bannerThumb();
    case "statue":
      return statueThumb();
  }
}
