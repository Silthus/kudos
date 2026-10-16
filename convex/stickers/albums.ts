import { countingGroupsWithPeopleIn, type CountingGroup, type GroupRef } from "../groups/groups";
import type { QueryCtx } from "../_generated/server";
import type { MemberId, People } from "../workspace/directory";
import type { HeldSticker } from "./records";

export type PersonInAlbum = { person: MemberId; held: boolean };

export type Album = GroupRef & { mine: boolean; held: number; total: number; people: PersonInAlbum[] };

export type AlbumOwner = { member: MemberId; workspace: string };

export async function albumsOf(ctx: QueryCtx, owner: AlbumOwner, people: People, stickers: HeldSticker[]): Promise<Album[]> {
  const held = new Set(stickers.map(({ person }) => person));
  const groups = await countingGroupsWithPeopleIn(ctx, owner.workspace, people);
  return groups.map((group) => albumOf(owner.member, group, held)).toSorted(ownFirstThenByName);
}

function albumOf(owner: MemberId, { group, name, people }: CountingGroup, held: Set<MemberId>): Album {
  const others = people.filter((person) => person !== owner).map((person) => ({ person, held: held.has(person) }));
  return { group, name, mine: others.length < people.length, held: others.filter((person) => person.held).length, total: others.length, people: others };
}

export function isFilled({ held, total }: Album): boolean {
  return total > 0 && held === total;
}

function ownFirstThenByName(first: Album, second: Album) {
  return Number(second.mine) - Number(first.mine) || first.name.localeCompare(second.name);
}
