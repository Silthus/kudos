import { IconArrowRight } from "@posthog/icons";

export function Arrow({ className = "size-3.5" }: { className?: string }) {
  return <IconArrowRight aria-hidden="true" className={`transition-transform motion-safe:group-hover:translate-x-0.5 ${className}`} />;
}
