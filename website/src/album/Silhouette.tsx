export function Silhouette({ name }: { name: string }) {
  return (
    <span className="al-silhouette" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="al-silhouette-shape">
        <circle cx="32" cy="25" r="12" />
        <path d="M9 64a23 23 0 0 1 46 0z" />
      </svg>
      <span className="al-silhouette-initials ph-no-capture">{initialsOf(name)}</span>
    </span>
  );
}

function initialsOf(name: string) {
  const initials = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0]?.toUpperCase())
    .filter((letter) => letter !== undefined)
    .slice(0, 2)
    .join("");
  return initials === "" ? "?" : initials;
}
