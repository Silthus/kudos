import { emojiCharacterOf, withoutSkinTone } from "./activity/emoji";
import { CustomEmoji, EmojiName } from "./CustomEmoji";

const shortcode = /:([a-z0-9_+'-]+(?:::skin-tone-[2-6](?:-[2-6])?)?):/g;

export function NamedEmoji({ name, image }: { name: string; image?: string }) {
  const label = `:${withoutSkinTone(name)}:`;
  if (image !== undefined) return <CustomEmoji key={image} label={label} image={image} className="inline h-[1.2em] w-auto align-[-0.25em]" />;
  return emojiCharacterOf(name) ?? <EmojiName label={label} />;
}

export function TextWithEmoji({ text }: { text: string }) {
  return text.split(shortcode).map((part, index) => (index % 2 === 1 ? <NamedEmoji key={index} name={part} /> : part));
}
