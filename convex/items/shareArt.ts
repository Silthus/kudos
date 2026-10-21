import { hoggiesOfRarity } from "../hoggies/catalogue";

export const sharedHoggies = [...hoggiesOfRarity("legendary"), ...hoggiesOfRarity("epic")].map(({ hoggie }) => hoggie);

export function hoggieSharePictureOf(hoggie: string): string {
  return `/share/${hoggie}.png`;
}
