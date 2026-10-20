export function StatusLine({ line }: { line: string }) {
  return (
    <p role="status" className={line === "" ? "sr-only" : "text-sm break-words text-muted-foreground"}>
      {line}
    </p>
  );
}
