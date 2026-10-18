// PROTOTYPE (#625, round 3): placeholder, replaced by its builder. Never merge to main.
import type { VariantProps } from "../../PrototypeStage";
import { useAlbum } from "../album";

export function StickerAlbum({ route }: VariantProps) {
  const { album } = useAlbum();
  return (
    <main style={{ padding: 48 }}>
      <h1>Sticker album</h1>
      <p>
        {route.page} · {album.collected} people collected · {album.packs.length} packs
      </p>
    </main>
  );
}
