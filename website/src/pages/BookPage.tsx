import { BookIndex, BookPagePicker } from "../book/BookIndex";
import { EarnedPage } from "../book/EarnedPage";
import { chaptersOf, type Chapter } from "../book/categories";
import { useChapter } from "../book/v2/chapters";
import { CollectionBook, collectionChaptersOf } from "../book/v2/CollectionBook";
import type { CollectionShown } from "../collectionRead";
import { Ladder } from "../book/Ladder";
import { Overview } from "../book/Overview";
import { PageTitle } from "../PageTitle";
import type { BookPageId } from "../route";
import type { BookAnswer, LadderCard, ShellActions } from "../shell";
import { useWideScreen } from "../useWideScreen";

type YourBook = Extract<BookAnswer, { kind: "book" }>;

type YourCollection = Extract<CollectionShown, { kind: "collection" }>;

type Shopping = { coins: number | null; onBuyCrate: ShellActions["buyCrate"] };

type BookPageProps = { book: YourBook; collection: CollectionShown | undefined; page: BookPageId; chatUrl: string } & Shopping;

export function BookPage({ book, collection, page, chatUrl, ...shopping }: BookPageProps) {
  if (page === "earned") return <EarnedPage ladders={book.ladders} chatUrl={chatUrl} />;
  return <BookPages book={book} collection={collection?.kind === "collection" ? collection : undefined} page={page} chatUrl={chatUrl} {...shopping} />;
}

function BookPages({ book, collection, page, chatUrl, coins, onBuyCrate }: { book: YourBook; collection: YourCollection | undefined; page: Exclude<BookPageId, "earned">; chatUrl: string } & Shopping) {
  const wide = useWideScreen();
  const collectionChapter = useChapter();
  const chapters = chaptersOf(book.ladders);
  const chapter = chapters.find(({ category }) => category.id === page);
  const onTheCollection = page === "collection" && collection !== undefined;
  const current: BookPageId = onTheCollection ? "collection" : (chapter?.category.id ?? "overview");
  const index = { chapters, current, collection: collection !== undefined, collectionChapters: onTheCollection ? collectionChaptersOf(collectionChapter, collection) : [] };
  void onBuyCrate;
  void chatUrl;
  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {wide ? <BookIndex {...index} /> : <BookPagePicker {...index} />}
      <div className="flex min-w-0 flex-col gap-6">
        {onTheCollection ? <CollectionBook collection={collection} timeZone={book.timeZone} coins={coins} /> : chapter === undefined ? <OverviewPage book={book} collection={collection} /> : <ChapterPage chapter={chapter} timeZone={book.timeZone} />}
      </div>
    </div>
  );
}

function OverviewPage({ book, collection }: { book: YourBook; collection: YourCollection | undefined }) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <PageTitle tab="Book" size="display">Achievements</PageTitle>
        <p className="text-sm text-muted-foreground">Tiers you earn by thanking colleagues and being thanked. Each one is yours for good.</p>
      </header>
      <Overview ladders={book.ladders} timeZone={book.timeZone} collection={collection} />
    </>
  );
}

function ChapterPage({ chapter: { category, ladders }, timeZone }: { chapter: Chapter; timeZone: string }) {
  return (
    <>
      <header className="flex flex-col gap-1">
        <span className="hud-label">Achievements</span>
        <PageTitle tab={`Book · ${category.name}`} size="display">{category.name}</PageTitle>
        {category.blurb !== null && <p className="text-sm text-muted-foreground">{category.blurb}</p>}
      </header>
      <Ladders ladders={ladders} timeZone={timeZone} />
    </>
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
