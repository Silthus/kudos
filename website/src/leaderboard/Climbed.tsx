export function Climbed({ places }: { places: number | null }) {
  if (places === null || places <= 0) return null;
  return (
    <span className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
      <span aria-hidden="true">{`▲ ${places}`}</span>
      <span className="sr-only">{`up ${places} ${places === 1 ? "place" : "places"}`}</span>
    </span>
  );
}
