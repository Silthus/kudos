import { buttonVariants } from "@posthog/quill";
import { useState, type FocusEvent } from "react";
import type { Album } from "./answer";
import { hrefOf, type Place } from "./place";

type Sharing = "waiting" | "copied" | "by-hand";

type SharedPage = Extract<Place, { kind: "person" | "team" }>;

export function ShareLink({ album, page, cardOf }: { album: Album; page: SharedPage; cardOf: string }) {
  const [sharing, setSharing] = useState<Sharing>("waiting");
  if (album.linkPreviews !== true) return null;
  const url = new URL(hrefOf(page), window.location.origin).toString();
  const share = async () => setSharing((await copied(url)) ? "copied" : "by-hand");
  return (
    <div className="al-share">
      <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })} onClick={share}>
        Share
      </button>
      <p role="status" aria-label="Sharing" className="al-share-said">
        {sharing === "copied" && `Link copied. Paste it in Slack to show ${cardOf} card.`}
        {sharing === "by-hand" && (
          <>
            Copy this link to share it: <input readOnly aria-label="Link to share" value={url} onFocus={selectAll} className="al-share-link" />
          </>
        )}
      </p>
    </div>
  );
}

async function copied(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function selectAll(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select();
}
