declare module "bun:ffi" {
  type Signature = { args: number[]; returns: number };
  export const FFIType: { i32: number };
  export function dlopen<Symbols extends Record<string, Signature>>(path: string, symbols: Symbols): { symbols: { [Name in keyof Symbols]: (...args: number[]) => number } };
}
