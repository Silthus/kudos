// PROTOTYPE (#625, round 4): three distinct layouts of the activity page. Never merge to main.
import type { PageLayouts } from "../../layouts";

function Placeholder({ layout }: { layout: string }) {
  return <p style={{ padding: 32 }}>activity page, layout {layout}: being built.</p>;
}

export const activityLayouts: PageLayouts = {
  A: { name: "Layout A", Page: () => <Placeholder layout="A" /> },
  B: { name: "Layout B", Page: () => <Placeholder layout="B" /> },
  C: { name: "Layout C", Page: () => <Placeholder layout="C" /> },
};
