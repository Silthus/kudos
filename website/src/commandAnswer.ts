export function answerWithin<Answer>(budgetMs: number, answer: Promise<Answer>): Promise<Answer> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const noAnswer = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("HedgeHug didn't answer in time.")), budgetMs);
  });
  return Promise.race([answer, noAnswer]).finally(() => clearTimeout(timer));
}
