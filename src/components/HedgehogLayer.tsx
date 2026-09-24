// PROTOTYPE (#54): the only module that imports @posthog/hedgehog-mode (MIT). Loaded with React.lazy, so pixi/matter/gsap
// stay out of the main bundle. Sprites come from a version-pinned CDN and are never committed to this repo.
import { HedgehogModeRenderer, type HedgeHogMode, type HedgehogActor } from "@posthog/hedgehog-mode";
import { useEffect, useRef, useState } from "react";
import { subscribeHedgehog, takeCameos, useHedgehog, type Cameo } from "@/lib/hedgehog";

const ASSETS = "https://cdn.jsdelivr.net/npm/@posthog/hedgehog-mode@0.0.58/assets";

export default function HedgehogLayer({ theme }: { theme: "light" | "dark" }) {
  const [game, setGame] = useState<HedgeHogMode | null>(null);
  const { roaming } = useHedgehog();
  const roamer = useRef<HedgehogActor | null>(null);

  useEffect(() => {
    if (!game) return;
    if (roaming && !roamer.current) roamer.current = game.spawnHedgehog({ id: "kudos-roamer", ai_enabled: true, interactions_enabled: true, controls_enabled: false, accessories: ["cap"] });
    if (!roaming && roamer.current) {
      game.removeElement(roamer.current);
      roamer.current = null;
    }
  }, [game, roaming]);

  useEffect(() => {
    if (!game) return;
    const play = (c: Cameo) => {
      const legendary = c.rarity === "legendary";
      const hog = game.spawnHedgehog({ id: `cameo-${c.id}`, ai_enabled: false, interactions_enabled: false, controls_enabled: false, accessories: ["party"], color: legendary ? "rainbow" : null });
      window.setTimeout(() => {
        hog.updateSprite(legendary ? "flag" : "wave", { reset: true, loop: false });
        game.gameUI?.flash({ words: c.words, duration: 3500, actor: hog });
      }, 900);
      window.setTimeout(() => game.removeElement(hog), 6500);
    };
    takeCameos().forEach(play);
    return subscribeHedgehog(() => takeCameos().forEach(play));
  }, [game]);

  return (
    <HedgehogModeRenderer
      theme={theme}
      onGameReady={setGame}
      config={{ assetsUrl: ASSETS, platforms: { selector: "[data-hog-platform]", viewportPadding: { top: 40 } } }}
      style={{ position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none" }}
    />
  );
}
