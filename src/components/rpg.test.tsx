// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { getFunctionName, type FunctionReference } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * The ruins outside a ruin (#162): the cabin's expedition kit (stamina pips, three slots, the gear
 * you hold and a button to wear it) and the gallery's lore cards (words hidden until found).
 */

let camp: unknown;
let lore: unknown;
const equip = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (fn: FunctionReference<"query">) => ({ "rpg:camp": camp, "discoveries:lore": lore })[getFunctionName(fn)],
  useMutation: () => equip,
}));

const { CampCard, LoreCards } = await import("./rpg");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  equip.mockReset();
});
function render(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<MemoryRouter>{node}</MemoryRouter>));
}
const text = () => document.body.textContent ?? "";

const gear = (id: string, slot: string, name: string) => ({ id, name, slot, stat: "wits", bonus: 2, rarity: "uncommon", about: "Worn by those who look further.", count: 1 });

describe("the expedition kit", () => {
  test("stamina as five pips, what's worn in each slot, and a button to wear the rest", () => {
    camp = {
      stamina: 2,
      maxStamina: 5,
      level: 9,
      explorer: true,
      equipped: { hat: "scout_cap" },
      stats: { might: 9, wits: 5, heart: 3 },
      gear: [gear("scout_cap", "hat", "Scout's cap"), gear("iron_spade", "tool", "Iron spade")],
      ruinsCleared: 3,
      lore: 1,
    };
    render(<CampCard />);
    expect(document.querySelectorAll("[data-pip='full']")).toHaveLength(2);
    expect(document.querySelectorAll("[data-pip='empty']")).toHaveLength(3);
    expect(document.querySelector("[data-slot='hat']")!.textContent).toContain("Scout's cap");
    expect(document.querySelector("[data-slot='tool']")!.textContent).toContain("Empty");
    expect(text()).toContain("3 ruins explored, 1 of 12 lore cards found");
    const wear = [...document.querySelectorAll("[data-gear='iron_spade'] button")][0] as HTMLButtonElement;
    act(() => wear.click());
    expect(equip).toHaveBeenCalledWith({ slot: "tool", gearId: "iron_spade" });
  });

  test("before level 6 it says when the near ruins open", () => {
    camp = { stamina: 1, maxStamina: 5, level: 4, explorer: false, equipped: {}, stats: { might: 4, wits: 0, heart: 1 }, gear: [], ruinsCleared: 0, lore: 0 };
    render(<CampCard />);
    expect(text()).toMatch(/open to you at level 6/);
    expect(text()).toMatch(/No gear yet/);
  });
});

describe("lore cards", () => {
  test("found cards show their words; the rest keep them hidden", () => {
    lore = {
      found: 1,
      cards: [
        { index: 0, title: "The first thank-you", text: "Before me there was only sand.", foundAt: 1 },
        { index: 1, title: null, text: null, foundAt: null },
      ],
    };
    render(<LoreCards />);
    expect(document.querySelector("[data-lore-card='0']")!.textContent).toContain("Before me there was only sand.");
    expect(document.querySelector("[data-lore-card='1']")!.textContent).toBe("A secret not found yet");
    expect(text()).toContain("1 of 12 secrets");
  });
});
