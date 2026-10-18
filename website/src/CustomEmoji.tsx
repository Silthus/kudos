import { useState } from "react";

type CustomEmojiProps = { label: string; image: string; className: string; nameClassName?: string };

export function CustomEmoji({ label, image, className, nameClassName }: CustomEmojiProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <EmojiName label={label} className={nameClassName} />;
  return <img src={image} alt={label} onError={() => setFailed(true)} className={`ph-no-capture ${className}`} />;
}

export function EmojiName({ label, className = "text-[0.9em]" }: { label: string; className?: string }) {
  return (
    <span data-custom-emoji className={`ph-no-capture rounded bg-background/60 px-1 text-foreground/70 ${className}`}>
      {label}
    </span>
  );
}
