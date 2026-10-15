export function MomentAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" data-testid="moment-announcement" className="sr-only">
      {text}
    </p>
  );
}

export function LevelUpAnnouncement({ text }: { text: string }) {
  return (
    <p role="status" data-testid="level-up-announcement" className="sr-only">
      {text}
    </p>
  );
}
