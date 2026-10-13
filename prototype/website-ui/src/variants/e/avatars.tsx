// Variant E avatars: stand-ins for Slack profile pictures, drawn by DiceBear from the member's name.
const backgrounds = "c0aede,d1d4f9,ffd5dc,ffdfbf,b6e3f4";

export const avatarUrl = (name: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(name)}&backgroundColor=${backgrounds}`;

export function Avatar({ name, size = 32, className = "" }: { name: string; size?: number; className?: string }) {
  return <img src={avatarUrl(name)} alt="" width={size} height={size} loading="lazy" className={`shrink-0 rounded-full bg-muted object-cover ${className}`} style={{ width: size, height: size }} />;
}
