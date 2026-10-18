import { useId, useState, type FormEvent } from "react";
import { IconMessage } from "@posthog/icons";
import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from "@posthog/quill";
import type { Capturer } from "./browserAnalytics/capture";

const survey = { id: "01a14dfa-686c-0000-15fd-1e42871cb016", question: { id: "ac5e3810-2b39-46a2-80d2-f8553b37dbac", text: "What's confusing or missing here?" } } as const;

const aboutTheSurvey = { $survey_id: survey.id };

export function Feedback({ capturer }: { capturer: Capturer }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const changeOpen = (opening: boolean) => {
    if (opening) {
      setSent(false);
      capturer.capture("survey shown", aboutTheSurvey);
    } else if (!sent) {
      capturer.capture("survey dismissed", aboutTheSurvey);
    }
    setOpen(opening);
  };

  const send = (answer: string) => {
    capturer.capture("survey sent", answerProperties(answer));
    setSent(true);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" data-ph-capture-attribute-control="feedback" />}>
        <IconMessage aria-hidden />
        <span className="max-sm:sr-only">Feedback</span>
      </PopoverTrigger>
      <PopoverContent aria-label="Feedback" align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {sent ? <Thanks onClose={() => changeOpen(false)} /> : <AnswerForm onSend={send} />}
      </PopoverContent>
    </Popover>
  );
}

function AnswerForm({ onSend }: { onSend: (answer: string) => void }) {
  const fieldId = useId();
  const [answer, setAnswer] = useState("");
  const words = answer.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (words !== "") onSend(words);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={fieldId} className="text-sm font-semibold">
        {survey.question.text}
      </label>
      <Textarea id={fieldId} autoFocus rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} className="min-h-24 resize-y" />
      <p className="text-xs text-muted-foreground">Your words go to the HedgeHug team with this visit's replay.</p>
      <Button type="submit" size="sm" className="self-end" disabled={words === ""}>
        Send
      </Button>
    </form>
  );
}

function Thanks({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold" role="status">
        Thanks, we read every answer.
      </p>
      <Button variant="outline" size="sm" className="self-end" autoFocus onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

function answerProperties(answer: string) {
  return {
    ...aboutTheSurvey,
    $survey_questions: [{ id: survey.question.id, question: survey.question.text }],
    $survey_response: answer,
    [`$survey_response_${survey.question.id}`]: answer,
    $survey_submission_id: crypto.randomUUID(),
    $survey_completed: true,
  };
}
