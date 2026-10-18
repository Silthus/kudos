// PROTOTYPE (#625, round 5): your profile, a yearbook front page of you: level, team, rank, album at a glance, coolest finds and best achievements. Never merge to main.
import { useAlbum } from "../../../round-3/album";
import { Achievements } from "./Achievements";
import { Entry } from "./Entry";
import { Finds } from "./Finds";
import { Glance } from "./Glance";
import { Rank } from "./Rank";
import "./profile.css";

export function ProfilePage() {
  const { album } = useAlbum();
  return (
    <article className="r5p" aria-labelledby="r5p-title">
      <div className="r5p-top">
        <Entry album={album} />
        <Rank album={album} />
      </div>
      <Glance album={album} />
      <Finds album={album} />
      <Achievements album={album} />
    </article>
  );
}
