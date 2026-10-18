import { faceOf, type Face } from "./faces";
import { memberQuery } from "./memberQuery";

export const getMyFace = memberQuery((ctx, me): Promise<Face> => faceOf(ctx, me));
