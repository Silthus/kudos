export function PersonSilhouette({ className }: { className: string }) {
  return (
    <span data-silhouette="" aria-hidden="true" className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed bg-muted text-muted-foreground ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[72%] translate-y-[14%] fill-current opacity-60">
        <circle cx="12" cy="8" r="4.5" />
        <path d="M2.5 23a9.5 9.5 0 0 1 19 0z" />
      </svg>
    </span>
  );
}
