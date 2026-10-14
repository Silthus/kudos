export function MomentAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" data-testid="moment-announcement" className="sr-only">
      {text}
    </p>
  );
}
