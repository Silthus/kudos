import type { CSSProperties, ReactNode } from "react";

export function Ring({ value, max, size, children }: { value: number; max: number; size: number; children: ReactNode }) {
  const share = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span className="bk-ring-wrap relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <span aria-hidden="true" className="bk-ring absolute inset-0 rounded-full" style={{ "--share": `${share}%` } as CSSProperties} />
      {children}
    </span>
  );
}
