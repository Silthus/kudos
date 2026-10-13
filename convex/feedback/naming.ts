export const productName = "HedgeHug";
export const botName = productName;
export const slashCommand = "/hedgehug";

export function skillPointsOf(count: number) {
  return count === 1 ? "1 skill point" : `${count} skill points`;
}
