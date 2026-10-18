// PROTOTYPE (#625, round 4): layout A of the activity page, a daybook: every day on its own line of the journal, newest first, hugs folded into one quiet line. Never merge to main.
import type { Album, Moment } from "../../../round-3/album";
import { useActivity } from "./history";
import { Face, HoggieFound, HugFaces, HugSentence, isGiven, isHug, isOpening, isReceived, isThanks, Name, OpeningLine, PackNote, PageHead, plural, Quote, Segmented, type Hug, type Opening, type Thanks } from "./parts";
import { clockOf, dayAndMonthOf, dayLabelOf, dayWordOf, groupBy, monthOf, startOfDay, startOfWeek, weekLabelOf } from "./time";
import { useHashParam } from "./useHashParam";
import "./activity.css";

const filters = ["all", "given", "received", "packs"] as const;

type Filter = (typeof filters)[number];

const filterOptions: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "given", label: "Given" },
  { value: "received", label: "Received" },
  { value: "packs", label: "Packs" },
];

const shows: Record<Filter, (moment: Moment) => boolean> = {
  all: () => true,
  given: isGiven,
  received: isReceived,
  packs: isOpening,
};

export function Daybook() {
  const { album, moments } = useActivity();
  const [filter, chooseFilter] = useHashParam("filter", filters, "all");
  const shown = moments.filter(shows[filter]);
  const weeks = groupBy(shown, ({ at }) => startOfWeek(at));
  return (
    <div className="r4-act r4-act-daybook">
      <PageHead title="Your daybook" lede="Four weeks of thanks, packs and hugs, one day at a time. Only you see this page.">
        <Segmented label="Show" options={filterOptions} value={filter} onChoose={chooseFilter} />
      </PageHead>
      {weeks.length === 0 && <p className="r4-act-empty">Nothing here yet.</p>}
      <ol className="r4-act-weeks">
        {weeks.map(({ key, members }) => (
          <Week key={key} album={album} weekStart={key} moments={members} />
        ))}
      </ol>
    </div>
  );
}

function weekSummaryOf(moments: Moment[]) {
  const thanked = moments.filter(({ kind }) => kind === "thoughtful-given").length;
  const opened = moments.filter(isOpening).length;
  const hugs = moments.filter(isHug).length;
  return [thanked > 0 && `${thanked} thanked`, opened > 0 && plural(opened, "pack"), hugs > 0 && plural(hugs, "hug")].filter(Boolean).join(" · ");
}

function Week({ album, weekStart, moments }: { album: Album; weekStart: number; moments: Moment[] }) {
  const days = groupBy(moments, ({ at }) => startOfDay(at));
  return (
    <li className="r4-act-week">
      <h2 className="r4-act-week-rule">
        <span>{weekLabelOf(weekStart)}</span>
        <small>{weekSummaryOf(moments)}</small>
      </h2>
      <ol className="r4-act-days">
        {days.map(({ key, members }) => (
          <Day key={key} album={album} dayStart={key} moments={members} />
        ))}
      </ol>
    </li>
  );
}

function Day({ album, dayStart, moments }: { album: Album; dayStart: number; moments: Moment[] }) {
  const hugs = moments.filter(isHug);
  const received = hugs.filter(({ kind }) => kind === "hug-received");
  const given = hugs.filter(({ kind }) => kind === "hug-given");
  return (
    <li className="r4-act-day">
      <div className="r4-act-date" aria-label={dayLabelOf(dayStart)}>
        <span className="r4-act-date-weekday">{dayWordOf(dayStart)}</span>
        <span className="r4-act-date-number">{new Date(dayStart).getDate()}</span>
        <span className="r4-act-date-month">{monthOf(dayStart)}</span>
      </div>
      <ol className="r4-act-entries" aria-label={dayAndMonthOf(dayStart)}>
        {moments.filter((moment) => !isHug(moment)).map((moment) => (
          <Entry key={`${moment.kind}-${moment.at}-${moment.person}`} album={album} moment={moment} />
        ))}
        {received.length > 0 && <HugsOfTheDay album={album} direction="received" hugs={received} />}
        {given.length > 0 && <HugsOfTheDay album={album} direction="given" hugs={given} />}
      </ol>
    </li>
  );
}

function Entry({ album, moment }: { album: Album; moment: Moment }) {
  if (isThanks(moment)) return <ThanksEntry album={album} thanks={moment} />;
  if (isOpening(moment)) return <OpeningEntry album={album} opening={moment} />;
  return null;
}

function ThanksEntry({ album, thanks }: { album: Album; thanks: Thanks }) {
  const given = thanks.kind === "thoughtful-given";
  return (
    <li className={`r4-act-entry r4-act-entry-${given ? "given" : "received"}`}>
      <Face album={album} person={thanks.person} />
      <div className="r4-act-entry-body">
        <p className="r4-act-entry-line">
          {given ? (
            <>
              You thanked <Name album={album} person={thanks.person} />
            </>
          ) : (
            <>
              <Name album={album} person={thanks.person} /> thanked you
            </>
          )}
          <time className="r4-act-time">{clockOf(thanks.at)}</time>
        </p>
        <Quote message={thanks.message} tone={given ? "given" : "received"} />
        {thanks.kind === "thoughtful-given" && <PackNote packed={thanks.packed} />}
      </div>
    </li>
  );
}

function OpeningEntry({ album, opening }: { album: Album; opening: Opening }) {
  return (
    <li className="r4-act-entry r4-act-entry-pack">
      <Face album={album} person={opening.person} />
      <div className="r4-act-entry-body">
        <p className="r4-act-entry-line">
          <OpeningLine album={album} opening={opening} />
          <time className="r4-act-time">{clockOf(opening.at)}</time>
        </p>
        <HoggieFound album={album} opening={opening} />
      </div>
    </li>
  );
}

function HugsOfTheDay({ album, direction, hugs }: { album: Album; direction: "given" | "received"; hugs: Hug[] }) {
  return (
    <li className="r4-act-entry r4-act-entry-hugs">
      <HugFaces album={album} hugs={hugs} />
      <p className="r4-act-entry-line r4-act-quiet">
        <HugSentence album={album} direction={direction} hugs={hugs} />
      </p>
    </li>
  );
}
