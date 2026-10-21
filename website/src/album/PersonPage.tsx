import { useId, useRef } from "react";
import { AnswerPage } from "../pages/AnswerPage";
import { KudosMessage } from "../activity/KudosMessage";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { PageTitle } from "../PageTitle";
import { LoadingPage } from "../pages/LoadingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SlackLink } from "../SlackLink";
import { hypeEmblemPicture, slugOf } from "../../../convex/album/emojiCatalogue";
import type { Album, AlbumEmoji, AlbumTeam, PersonPage as Person, PersonShown } from "./answer";
import { ComingSoonToSlack, FindInSlackWhileOn, MapInPlace, useMapsInPlace, useSlackWay } from "./findInSlack";
import { hrefOf } from "./place";
import { PersonPicture } from "./PersonPicture";
import { PetHoggie, petOf, petOwnerWordsOf } from "./PetHoggie";
import { dateOf, firstNameOf, howToCollectWords, personIn } from "./teamPage";
import { landedMarksOf, useBroughtIntoViewOnLanding, useLandedSticker } from "./useItemBoard";
import { LandedHype } from "./ItemBoard";
import { OwnHypePick, type HypePicker } from "./OwnHypePick";
import { NewSinceTheLastVisit } from "./newLabels";
import "./team.css";

type HypeShown = Pick<AlbumEmoji, "id" | "kind" | "name" | "picture" | "from" | "inSlack">;

type PersonAnswerProps = { shown: PersonShown | undefined; album: Album; picker: HypePicker; onSignIn: () => void; onSignOut: () => void };

export function PersonAnswerPage({ shown, album, picker, ...answers }: PersonAnswerProps) {
  if (shown === undefined) return <LoadingPage shape="column" />;
  if (shown.kind === "no-person" || shown.kind === "off") return <NotFoundPage />;
  if (shown.kind !== "person") return <AnswerPage answer={shown} {...answers} />;
  return <PersonPage album={album} person={shown} picker={picker} />;
}

export function isWaitingForThePerson(shown: PersonShown | undefined) {
  return shown === undefined;
}

function PersonPage({ album, person, picker }: { album: Album; person: Person; picker: HypePicker }) {
  const first = firstNameOf(person.name);
  const caption = useId();
  const pet = petOf(album, person.person);
  const sticker = useRef<HTMLDivElement>(null);
  const landing = useLandedSticker(person.person);
  useBroughtIntoViewOnLanding(sticker, landing);
  const teams = person.teams.map(({ team, name, art }) => album.teams.find((page) => page.team === team) ?? { team, name, art, held: 0, total: 0, mine: false });
  return (
    <article className="al-page-body al-person">
      {teams[0] !== undefined && (
        <AppLink href={teamHrefOf(teams[0])} className="al-back">
          ← {teams[0].name}
        </AppLink>
      )}
      <div className="al-person-entry">
        <figure className="al-mount al-mount-single" aria-labelledby={caption}>
          <div ref={sticker} className="al-photo" {...landedMarksOf(landing)}>
            <PersonPicture face={person.face} name={person.name} collected={person.held} frame="al-photo-sticker al-photo-sticker-large" className="al-photo-face" />
            {pet !== null && <PetHoggie pet={pet} owner={petOwnerWordsOf(album, person.person, person.name)} className="al-person-pet-art" />}
            <LandedHype landing={landing} />
          </div>
          <figcaption id={caption} className="al-photo-caption">
            {person.held ? "In your album" : "Not in your album yet"}
            <NewSinceTheLastVisit at={personIn(album, person.person).at} />
          </figcaption>
        </figure>
        <div className="al-person-words">
          <p className="al-eyebrow">{person.person === album.me.person ? "You" : "Teammate"}</p>
          <PageTitle tab={person.name} size="hero">
            <span className="ph-no-capture">{person.name}</span>
          </PageTitle>
          {teams.length > 0 && (
            <ul className="al-person-teams" aria-label="Their teams">
              {teams.map((team) => (
                <li key={team.team}>
                  <AppLink href={teamHrefOf(team)} className="al-person-team">
                    <TeamCrest art={team.art} size={32} name={team.name} collected={team.held > 0} />
                    <strong>{team.name}</strong>
                    <span className="al-quiet">
                      {team.held} of {team.total}
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          )}
          {pet !== null && (
            <p className="al-person-pet">
              <span className="al-quiet">Pet:</span> <strong>{pet.name}</strong>
            </p>
          )}
          {person.slackProfile !== null && (
            <div className="al-person-slack">
              <SlackLink chatUrl={person.slackProfile} variant="outline">
                Open in Slack<span className="sr-only">, {first}&apos;s profile</span>
              </SlackLink>
            </div>
          )}
          <HypeEmoji person={person} first={first} picker={picker} emojiPage={album.emojiPage} />
          {!person.held && (
            <div className="al-howto">
              <p className="al-eyebrow">
                How to collect <span className="ph-no-capture">{first}</span>
              </p>
              <p className="ph-no-capture">{howToCollectWords(album, person.person, person.name)}</p>
            </div>
          )}
          <History person={person} />
          <BestMessage person={person} first={first} />
        </div>
      </div>
    </article>
  );
}

function teamHrefOf(team: Pick<AlbumTeam, "team">) {
  return hrefOf({ kind: "team", team: team.team });
}

function HypeEmoji({ person, first, picker, emojiPage }: { person: Person; first: string; picker: HypePicker; emojiPage: string | null }) {
  const { earned, name, picture, inSlack } = person.hype;
  return (
    <div className="al-person-hype ph-no-capture" data-earned={earned ? "" : undefined}>
      <PersonPicture face={person.face} name={person.name} collected={earned} frame="al-hype-frame" className="al-hype-face" />
      <p>
        {name !== null && <code>:{name}:</code>}
        <span>{earned ? `Unlocked by your first thoughtful kudos to ${first}` : `Give ${first} a thoughtful kudos to unlock their hype emoji`}</span>
      </p>
      {person.hypePick ? <OwnHypePick emoji={{ kind: "hype", name: name ?? `${slugOf(person.name)}-hype`, picture: picture ?? hypeEmblemPicture, from: person.name, inSlack: inSlack ?? false }} emojiPage={emojiPage} {...picker} /> : name !== null && <HypeInSlack emoji={{ id: `hype:${person.person}`, kind: "hype", name, picture: picture ?? hypeEmblemPicture, from: person.name, inSlack: inSlack ?? true }} earned={earned} />}
    </div>
  );
}

function HypeInSlack({ emoji, earned }: { emoji: HypeShown; earned: boolean }) {
  const inPlace = useMapsInPlace();
  const way = useSlackWay();
  if (inPlace) return <MapInPlace emoji={emoji} />;
  if (!earned) return null;
  if (way === "coming-soon") return emoji.inSlack ? null : <ComingSoonToSlack />;
  return <FindInSlackWhileOn emoji={emoji} />;
}

function History({ person }: { person: Person }) {
  const facts = [
    { label: "First thanked", value: person.firstThankedAt === null ? "Not yet" : dateOf(person.firstThankedAt) },
    { label: "Kudos you gave", value: String(person.kudosGiven) },
    { label: "Kudos they gave you", value: String(person.kudosReceived) },
    { label: "Hugs you gave", value: String(person.hugsGiven) },
    { label: "Hugs they gave you", value: String(person.hugsReceived) },
  ];
  return (
    <ul className="al-facts" aria-label="Your history together">
      {facts.map(({ label, value }) => (
        <li key={label} className="al-fact">
          <span className="al-fact-label">{label}</span>
          <span className="al-fact-value">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function BestMessage({ person, first }: { person: Person; first: string }) {
  if (person.best === null) return null;
  return (
    <figure className="al-quote">
      <blockquote>
        <KudosMessage message={person.best.message} clamped={false} />
      </blockquote>
      <figcaption>
        <span>
          Your best message to <span className="ph-no-capture">{first}</span>
        </span>
        {person.best.permalink !== null && (
          <SlackLink chatUrl={person.best.permalink} variant="outline">
            Open in Slack
          </SlackLink>
        )}
      </figcaption>
    </figure>
  );
}
