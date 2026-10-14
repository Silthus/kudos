import { Ladder } from "../book/Ladder";
import { PageTitle } from "../PageTitle";
import type { BookAnswer } from "../shell";

type YourBook = Extract<BookAnswer, { kind: "book" }>;

export function BookPage({ book }: { book: YourBook }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="hud-label">Book</span>
        <PageTitle tab="Book" size="display">Achievements</PageTitle>
        <p className="text-sm text-muted-foreground">Tiers you earn by thanking colleagues and being thanked. Each one is yours for good.</p>
      </header>
      <div className="flex flex-col gap-4">
        {book.ladders.map((ladder) => (
          <Ladder key={ladder.ladder} ladder={ladder} timeZone={book.timeZone} />
        ))}
      </div>
    </div>
  );
}
