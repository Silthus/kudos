// PROTOTYPE leaderboard: three boards and three periods of kudos given, rendered from the backend's windowed rows.
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, Badge as Tag, Card, Label, Switch, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs, TabsContent, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from "@posthog/quill";
import { IconLock } from "@posthog/icons";
import { boards, me } from "../data/mock";
import type { BoardRow, GroupRow, Period } from "../data/types";
import { HedgehogSuccess, PageHeader } from "../ui";

type PersonRow = Extract<BoardRow, { kind: "row" }>;
type TeamRow = Extract<GroupRow, { kind: "row" }>;

const periods: Array<{ id: Period; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

const medals = ["🥇", "🥈", "🥉"];
const rankLabel = (rank: number) => medals[rank - 1] ?? `${rank}.`;

export function Leaderboard(_props: { param?: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [showMe, setShowMe] = useState(me.privacy.showOnLeaderboards);
  const facts = boards[period];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Leaderboard"
        hog={HedgehogSuccess}
        description="Who's been saying thanks the most. Only kudos given count here; kudos received, XP, levels, coins and achievements never rank."
        actions={
          <Label className="flex cursor-pointer items-center gap-2 text-sm">
            <Switch size="sm" checked={showMe} onCheckedChange={setShowMe} />
            Show me on the leaderboards
          </Label>
        }
      />

      <Tabs defaultValue="groups" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="myGroup">{me.primaryGroup.name}</TabsTrigger>
            <TabsTrigger value="everyone">Everyone</TabsTrigger>
          </TabsList>
          <ToggleGroup variant="outline" size="sm" value={[period]} onValueChange={(v) => v[0] && setPeriod(v[0] as Period)} aria-label="Period">
            {periods.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <TabsContent value="groups" className="flex flex-col gap-3">
          <GroupsBoard rows={facts.groups.rows} />
          <PrivateLines
            note="Groups are scored per person, so a small group can top the board."
            lines={[facts.groups.myGroupLine && `${me.primaryGroup.name}: ${facts.groups.myGroupLine}`, facts.groups.mostImproved && `Most improved: ${facts.groups.mostImproved}`]}
          />
        </TabsContent>
        <TabsContent value="myGroup" className="flex flex-col gap-3">
          <PeopleBoard rows={facts.myGroup.rows} showMe={showMe} />
        </TabsContent>
        <TabsContent value="everyone" className="flex flex-col gap-3">
          <PeopleBoard rows={facts.everyone.rows} showMe={showMe} />
          <PrivateLines lines={[facts.everyone.improvementLine, facts.everyone.peerLine]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PeopleBoard({ rows, showMe }: { rows: BoardRow[]; showMe: boolean }) {
  return (
    <Card size="sm" flush>
      <Table size="sm" fullWidth>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Rank</TableHead>
            <TableHead expand>Member</TableHead>
            <TableHead align="right">Kudos given</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            if (row.kind === "gap") return <GapRow key={`gap-${i}`} columns={3} />;
            if (row.me && !showMe) return <HiddenRow key="me" />;
            return <PersonLine key={row.position} row={row} />;
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function PersonLine({ row }: { row: PersonRow }) {
  return (
    <TableRow className={row.me ? "bg-fill-selected" : undefined}>
      <TableCell className="tabular-nums">{rankLabel(row.rank)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{row.initials}</AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{row.name}</span>
          {row.me && <Tag>You</Tag>}
        </span>
      </TableCell>
      <TableCell align="right" className="tabular-nums">
        {row.kudos}
      </TableCell>
    </TableRow>
  );
}

function GroupsBoard({ rows }: { rows: GroupRow[] }) {
  return (
    <Card size="sm" flush>
      <Table size="sm" fullWidth>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Rank</TableHead>
            <TableHead expand>Group</TableHead>
            <TableHead align="right">Per person</TableHead>
            <TableHead align="right">% gave</TableHead>
            <TableHead align="right" className="hidden sm:table-cell">
              Total
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map((row, i) => (row.kind === "gap" ? <GapRow key={`gap-${i}`} columns={5} /> : <TeamLine key={row.group} row={row} />))}</TableBody>
      </Table>
    </Card>
  );
}

function TeamLine({ row }: { row: TeamRow }) {
  return (
    <TableRow className={row.mine ? "bg-fill-selected" : undefined}>
      <TableCell className="tabular-nums">{rankLabel(row.rank)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{row.group}</span>
          {row.mine && <Tag>Your group</Tag>}
        </span>
      </TableCell>
      <TableCell align="right" className="tabular-nums">
        {row.score.toFixed(1)}
      </TableCell>
      <TableCell align="right" className="tabular-nums">
        {row.participation}%
      </TableCell>
      <TableCell align="right" className="hidden tabular-nums sm:table-cell">
        {row.total}
      </TableCell>
    </TableRow>
  );
}

function GapRow({ columns }: { columns: number }) {
  return (
    <TableRow aria-label="Skipped positions">
      <TableCell colSpan={columns} align="center" className="py-1 text-muted-foreground">
        …
      </TableCell>
    </TableRow>
  );
}

function HiddenRow() {
  return (
    <TableRow className="bg-fill-selected">
      <TableCell colSpan={3} className="text-muted-foreground">
        You're not on the leaderboards. You can change that in{" "}
        <a href="#/profile" className="text-foreground underline underline-offset-2">
          Settings
        </a>
        .
      </TableCell>
    </TableRow>
  );
}

function PrivateLines({ lines, note }: { lines: Array<string | undefined>; note?: ReactNode }) {
  const shown = lines.filter((l): l is string => Boolean(l));
  if (shown.length === 0 && !note) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {note && <p>{note}</p>}
      {shown.length > 0 && (
        <>
          <p className="flex items-center gap-1 font-medium">
            <IconLock className="size-3.5" /> Only you see these
          </p>
          {shown.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </>
      )}
    </div>
  );
}
