import { v, type Infer } from "convex/values";
import { crateRefusalValidator } from "../album/hoggies/records";
import { itemRefusalValidator } from "../store/rows";

export const homeRefusalValidator = v.union(itemRefusalValidator, crateRefusalValidator);

export type HomeRefusal = Infer<typeof homeRefusalValidator>;
