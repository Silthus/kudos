import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Face } from "./shell";

export function MemberFace({ face, className }: { face: Face; className: string }) {
  if (face.kind === "initials") return <Initials initials={face.initials} className={className} />;
  return <FaceImage key={face.image} face={face} className={className} />;
}

function FaceImage({ face, className }: { face: Exclude<Face, { kind: "initials" }>; className: string }) {
  const { failed, picture, onError } = usePictureFailure();
  if (failed) return <Initials initials={face.initials} className={className} />;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  const fill = face.kind === "slack" ? "bg-muted object-cover" : "object-cover object-top";
  return <img ref={picture} src={face.image} alt="" style={onColour} onError={onError} className={`shrink-0 rounded-full ${fill} ${className}`} />;
}

export function usePictureFailure() {
  const [failed, setFailed] = useState(false);
  const picture = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    if (picture.current !== null && alreadyFailed(picture.current)) setFailed(true);
  }, []);
  return { failed, picture, onError: () => setFailed(true) };
}

function alreadyFailed(image: HTMLImageElement) {
  return image.complete && image.naturalWidth === 0;
}

function Initials({ initials, className }: { initials: string; className: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground ${className}`}>
      {initials}
    </span>
  );
}
