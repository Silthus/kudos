// PROTOTYPE (#625): round 2 variant placeholder, replaced by its builder. Never merge to main.
import type { VariantProps } from "../../PrototypeStage";
import { useWorld } from "../../world";

export function GuildHall({ route }: VariantProps) {
  const { world } = useWorld();
  return (
    <main style={{ padding: 48 }}>
      <h1>Guild hall</h1>
      <p>
        {route.page} · level {world.level.level} · {world.owned}/{world.total} hoggies
      </p>
    </main>
  );
}
