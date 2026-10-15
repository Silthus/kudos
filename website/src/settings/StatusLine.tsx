export function StatusLine({ line }: { line: string }) {
  return (
    <p role="status" className={line === "" ? "sr-only" : "text-sm text-muted-foreground"}>
      {line}
    </p>
  );
}
