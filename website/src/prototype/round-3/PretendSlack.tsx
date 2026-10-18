// PROTOTYPE (#625, round 3): a dark prototype dock that stands in for Slack, so a thoughtful kudos or a hug can be given from the website. Never merge to main.
import { useState } from "react";
import { AppLink } from "../../AppLink";
import { useAlbum } from "./album";

export function PretendSlack({ slackLink = true }: { slackLink?: boolean }) {
  const { album, actions } = useAlbum();
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState("k:priya");
  const [said, setSaid] = useState<string | null>(null);
  const chosen = album.people.find(({ key }) => key === person);
  const give = () => {
    const given = actions.giveThoughtfulKudos(person);
    setSaid(given.kind === "packed" ? `Pack earned for thanking ${chosen?.name}.` : `Counted, but ${chosen?.name} already earned you a pack this week.`);
  };
  const hug = () => {
    actions.hug(person);
    setSaid(`Hugged ${chosen?.name}: +1 XP, nothing else happens.`);
  };
  return (
    <aside data-pretend-slack style={{ position: "fixed", left: 14, bottom: 14, zIndex: 2147482000, background: "#111", color: "#fff", border: "2px dashed #f54e00", borderRadius: 14, font: "500 13px/1.35 system-ui, sans-serif", boxShadow: "0 8px 24px rgb(0 0 0 / 35%)", width: open ? 300 : "auto" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ all: "unset", cursor: "pointer", display: "block", padding: "8px 12px", fontWeight: 700 }}>
        {open ? "▾" : "▸"} Pretend Slack (prototype)
      </button>
      {open && (
        <div style={{ display: "grid", gap: 8, padding: "0 12px 12px" }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ opacity: 0.75 }}>Teammate</span>
            <select value={person} onChange={(event) => setPerson(event.target.value)} style={{ font: "inherit", padding: 4, borderRadius: 6 }}>
              {album.people.map(({ key, name, collectedAt, packedThisWeek }) => (
                <option key={key} value={key}>
                  {name}
                  {collectedAt === null ? " · new" : ""}
                  {packedThisWeek ? " · packed this week" : ""}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <PretendButton onClick={give}>Thoughtful kudos</PretendButton>
            <PretendButton onClick={hug}>Hug</PretendButton>
          </div>
          {said !== null && <p style={{ margin: 0, opacity: 0.9 }}>{said}</p>}
          {slackLink && (
            <AppLink href="/?variant=slack" style={{ color: "#f7a501" }}>
              See it in Slack →
            </AppLink>
          )}
          <button type="button" onClick={actions.reset} style={{ all: "unset", cursor: "pointer", opacity: 0.6, fontSize: 12 }}>
            Reset the album
          </button>
        </div>
      )}
    </aside>
  );
}

function PretendButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: 0, background: "#f54e00", color: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}>
      {children}
    </button>
  );
}
