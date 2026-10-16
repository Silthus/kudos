import type { CollectionSection } from "./sections";

export function JumpList({ sections }: { sections: CollectionSection[] }) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label="On this page">
      <ul className="flex flex-wrap gap-1.5">
        {sections.map(({ id, name }) => (
          <li key={id}>
            <a href={`#${id}`} className="inline-flex min-h-8 items-center rounded-full border bg-card px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-fill-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {name}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
