import clsx from "clsx";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { api } from "../../../convex/_generated/api";
import { Avatar, Dialog, Skeleton, inputCls } from "@/components/ui";
import { matchCandidates } from "@/lib/compare";

/**
 * Searchable list of everyone the viewer can compare with. The candidate list changes whenever
 * anybody gives kudos, so it's only subscribed while the picker is open.
 */
export function TeammatePicker({
  open,
  onClose,
  onPick,
  selectedId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (memberId: string) => void;
  selectedId?: string;
}) {
  const candidates = useQuery(api.compare.candidates.list, open ? {} : "skip");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const matches = candidates ? matchCandidates(search, candidates) : [];

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);
  // Start on the current teammate, so Enter keeps them and the arrows move from there.
  useEffect(() => {
    const current = search ? -1 : matches.findIndex((m) => m._id === selectedId);
    setActive(Math.max(0, current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, candidates === undefined, selectedId]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const pick = (id: string) => {
    onPick(id);
    onClose();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (matches.length === 0 ? 0 : (i + step + matches.length) % matches.length));
    } else if (e.key === "Enter" && matches[active]) {
      e.preventDefault();
      pick(matches[active]._id);
    }
  };
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <Dialog open={open} onClose={onClose} title="Compare with a teammate" subtitle="A side-by-side look at the same period. Nobody wins here.">
      <label className="relative block">
        <span className="sr-only">Search teammates</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/65" aria-hidden />
        <input
          data-autofocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search by name or title"
          className={clsx(inputCls, "pl-9")}
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls={matches.length > 0 ? listId : undefined}
          aria-activedescendant={matches[active] ? optionId(active) : undefined}
          autoComplete="off"
        />
      </label>
      <div className="mt-3 max-h-[min(420px,60dvh)] overflow-y-auto">
        {candidates === undefined ? (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/75">{candidates.length === 0 ? "Nobody else to compare with yet." : `Nobody matches “${search.trim()}”.`}</p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Teammates" className="space-y-1">
            {matches.map((m, i) => (
              <li key={m._id} id={optionId(i)} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => pick(m._id)}
                  onMouseEnter={() => setActive(i)}
                  className={clsx(
                    "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                    i === active ? "bg-parchment-deep/50" : "hover:bg-parchment-deep/50",
                  )}
                >
                  <Avatar name={m.name} src={m.avatarUrl} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                    {(m.title || m.realName) && <span className="block truncate text-xs text-ink/65">{m.title || m.realName}</span>}
                  </span>
                  {m._id === selectedId && <span className="tabular text-[10px] text-ink/75">Current</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
