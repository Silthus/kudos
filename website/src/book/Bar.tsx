export function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className="h-2 flex-1 overflow-hidden rounded-full border border-muted-foreground p-px">
      <Fill value={value} max={max} />
    </div>
  );
}

export function QuietBar({ value, max }: { value: number; max: number }) {
  return (
    <div data-bar="" aria-hidden="true" className="h-1.5 overflow-hidden rounded-full border border-muted-foreground p-px">
      <Fill value={value} max={max} />
    </div>
  );
}

function Fill({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="h-full rounded-full bg-muted-foreground" style={{ width: `${share}%` }} />;
}
