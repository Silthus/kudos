import { useId, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import { IconMessage } from "@posthog/icons";
import { Button, Popover, PopoverContent, PopoverTrigger, Textarea } from "@posthog/quill";
import type { Capturer } from "./browserAnalytics/capture";

const survey = { id: "01a14dfa-686c-0000-15fd-1e42871cb016", question: { id: "ac5e3810-2b39-46a2-80d2-f8553b37dbac", text: "What's confusing or missing here?" } } as const;

const aboutTheSurvey = { $survey_id: survey.id };

type FeedbackProps = { capturer: Capturer; trigger?: ReactElement; label?: ReactNode };

export function Feedback({ capturer, trigger = <Button variant="outline" size="sm" />, label = <span className="max-sm:sr-only">Feedback</span> }: FeedbackProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [answer, setAnswer] = useState("");

  const changeOpen = (opening: boolean) => {
    if (opening) {
      setSent(false);
      capturer.capture("survey shown", aboutTheSurvey);
    } else if (!sent) {
      capturer.capture("survey dismissed", aboutTheSurvey);
    }
    setOpen(opening);
  };

  const send = (words: string) => {
    capturer.capture("survey sent", answerProperties(words));
    setAnswer("");
    setSent(true);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={trigger} data-ph-capture-attribute-control="feedback">
        <IconMessage aria-hidden />
        {label}
      </PopoverTrigger>
      <PopoverContent aria-label="Feedback" align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {sent ? <Thanks onClose={() => changeOpen(false)} /> : <AnswerForm answer={answer} onChange={setAnswer} onSend={send} />}
      </PopoverContent>
    </Popover>
  );
}

function AnswerForm({ answer, onChange, onSend }: { answer: string; onChange: (answer: string) => void; onSend: (words: string) => void }) {
  const fieldId = useId();
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
      <Textarea id={fieldId} autoFocus rows={4} value={answer} onChange={(event) => onChange(event.target.value)} className="min-h-24 resize-y" />
      <p className="text-xs text-muted-foreground">Your words go to the HedgeHug team with this visit's replay.</p>
      <Button type="submit" variant="primary" size="sm" className="self-end" disabled={words === ""}>
        Send
      </Button>
    </form>
  );
}

function Thanks({ onClose }: { onClose: () => void }) {
  const thanksId = useId();
  return (
    <div className="flex flex-col gap-3">
      <p id={thanksId} className="text-sm font-semibold" role="status">
        Thanks, we read every answer.
      </p>
      <Button variant="outline" size="sm" className="self-end" autoFocus aria-describedby={thanksId} onClick={onClose}>
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
