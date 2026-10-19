import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Face } from "./shell";

type FaceProps = { face: Face; className: string; withoutPicture?: ReactNode };

export function MemberFace({ face, className, withoutPicture }: FaceProps) {
  if (face.kind === "initials") return withoutPicture ?? <Initials initials={face.initials} className={className} />;
  return <FaceImage key={face.image} face={face} className={className} withoutPicture={withoutPicture} />;
}

function FaceImage({ face, className, withoutPicture }: FaceProps & { face: Exclude<Face, { kind: "initials" }> }) {
  const { failed, picture, onError } = usePictureFailure();
  if (failed) return withoutPicture ?? <Initials initials={face.initials} className={className} />;
  const onColour: CSSProperties | undefined = face.kind === "company-profile" ? { backgroundColor: face.colour } : undefined;
  const fill = face.kind === "slack" ? "bg-muted object-cover" : "object-cover object-top";
  return <img ref={picture} src={face.image} alt="" style={onColour} onError={onError} className={`ph-no-capture shrink-0 rounded-full ${fill} ${className}`} />;
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
    <span aria-hidden="true" className={`ph-no-capture inline-flex shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold text-muted-foreground ${className}`}>
      {initials}
    </span>
  );
}
