import type { Album, AlbumPet } from "./answer";
import { HoggieArt } from "./HoggieArt";
import { rarityTintOf } from "./hoggieGuide";
import { firstNameOf } from "./teamPage";
import "./pet.css";

export function PetHoggie({ pet, owner, className }: { pet: AlbumPet; owner: string; className: string }) {
  return (
    <span className={`al-pet ph-no-capture ${className}`} role="img" aria-label={`${owner} pet, ${pet.name}`} style={rarityTintOf(pet.rarity)}>
      <HoggieArt hoggie={pet.hoggie} hidden={false} />
    </span>
  );
}

export function petOf(album: Album, person: string): AlbumPet | null {
  return album.pets?.find((pet) => pet.person === person) ?? null;
}

export function petOwnerWordsOf(album: Album, person: string, name: string) {
  return person === album.me.person ? "Your" : `${firstNameOf(name)}'s`;
}
