import { variant as a } from "./a";
import { variant as b } from "./b";
import { variant as c } from "./c";
import { variant as d } from "./d";
import type { Variant } from "./types";

const base: Variant = { key: "0", name: "Base", tagline: "Round 2, plain Quill", screens: {} };

export const variants: Variant[] = [base, a, b, c, d];
