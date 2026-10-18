// PROTOTYPE (#625, round 4): three distinct layouts of the hoggies page. Never merge to main.
import type { PageLayouts } from "../../layouts";
import { DisplayCabinet } from "./DisplayCabinet";
import { Dex } from "./Dex";
import { FieldGuide } from "./FieldGuide";
import "./hoggies.css";

export const hoggieLayouts: PageLayouts = {
  A: { name: "Field guide", Page: FieldGuide },
  B: { name: "Display cabinet", Page: DisplayCabinet },
  C: { name: "Numbered dex", Page: Dex },
};
