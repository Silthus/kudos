import { BookIndex, BookPagePicker } from "../book/BookIndex";
import { chaptersOf, type Chapter } from "../book/categories";
import { Ladder } from "../book/Ladder";
import { PageTitle } from "../PageTitle";
import type { BookPageId } from "../route";
import type { BookAnswer, LadderCard } from "../shell";
import { useWideScreen } from "../useWideScreen";

type YourBook = Extract<BookAnswer, { kind: "book" }>;

export function BookPage({ book, page }: { book: YourBook; page: BookPageId }) {
  const wide = useWideScreen();
  const chapters = chaptersOf(book.ladders);
  const chapter = chapters.find(({ category }) => category.id === page);
  const current = chapter?.category.id ?? "overview";
  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {wide ? <BookIndex chapters={chapters} current={current} /> : <BookPagePicker chapters={chapters} current={current} />}
      <div className="flex min-w-0 flex-col gap-6">
        {chapter === undefined ? <Overview /> : <ChapterHeader chapter={chapter} />}
        <Ladders ladders={chapter?.ladders ?? book.ladders} timeZone={book.timeZone} />
      </div>
    </div>
  );
}

function Overview() {
  return (
    <header className="flex flex-col gap-1">
      <span className="hud-label">Book</span>
      <PageTitle tab="Book" size="display">Achievements</PageTitle>
      <p className="text-sm text-muted-foreground">Tiers you earn by thanking colleagues and being thanked. Each one is yours for good.</p>
    </header>
  );
}

function ChapterHeader({ chapter: { category } }: { chapter: Chapter }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="hud-label">Achievements</span>
      <PageTitle tab={`Book · ${category.name}`} size="display">{category.name}</PageTitle>
      {category.blurb !== null && <p className="text-sm text-muted-foreground">{category.blurb}</p>}
    </header>
  );
}

function Ladders({ ladders, timeZone }: { ladders: LadderCard[]; timeZone: string }) {
  return (
    <div className="flex flex-col gap-4">
      {ladders.map((ladder) => (
        <Ladder key={ladder.ladder} ladder={ladder} timeZone={timeZone} />
      ))}
    </div>
  );
}
