import { IconSearch } from "@posthog/icons";

type SearchFieldProps = { label: string; value: string; onChange: (value: string) => void };

export function SearchField({ label, value, onChange }: SearchFieldProps) {
  return (
    <label className="relative flex flex-col gap-1 sm:max-w-sm">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="search"
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-muted-foreground bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <IconSearch aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted-foreground" />
    </label>
  );
}
