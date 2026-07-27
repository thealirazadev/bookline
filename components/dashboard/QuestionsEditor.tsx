"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { QuestionType } from "@/lib/validation/eventType";

export interface QuestionDraft {
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  optionsText: string;
}

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "single_choice", label: "Single choice" },
];

export function emptyQuestion(): QuestionDraft {
  return {
    key: `q_${Math.random().toString(36).slice(2)}`,
    label: "",
    type: "short_text",
    required: false,
    optionsText: "",
  };
}

/** Split the one-option-per-line textarea into a trimmed, non-empty list. */
export function parseOptions(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

interface QuestionsEditorProps {
  questions: QuestionDraft[];
  errors: Record<string, string>;
  onChange: (questions: QuestionDraft[]) => void;
}

export function QuestionsEditor({
  questions,
  errors,
  onChange,
}: QuestionsEditorProps) {
  function update(index: number, patch: Partial<QuestionDraft>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const next = [...questions];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-medium text-fg">
        Intake questions (shown after name and email)
      </legend>

      {questions.length === 0 ? (
        <p className="text-sm text-fg-muted">No questions yet.</p>
      ) : null}

      {questions.map((question, index) => (
        <div
          key={question.key}
          className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-fg-muted">
              Question {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move question ${index + 1} up`}
                className="rounded-sm px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === questions.length - 1}
                aria-label={`Move question ${index + 1} down`}
                className="rounded-sm px-2 py-1 text-sm text-fg-muted hover:bg-surface-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Down
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove question ${index + 1}`}
                className="rounded-sm px-2 py-1 text-sm font-medium text-danger hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Remove
              </button>
            </div>
          </div>

          <Input
            label="Question"
            value={question.label}
            onChange={(e) => update(index, { label: e.target.value })}
            error={errors[`questions.${index}.label`]}
            maxLength={200}
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor={`${question.key}-type`}
              className="text-sm font-medium text-fg"
            >
              Type
            </label>
            <select
              id={`${question.key}-type`}
              value={question.type}
              onChange={(e) =>
                update(index, { type: e.target.value as QuestionType })
              }
              className="rounded-sm border border-border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {question.type === "single_choice" ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor={`${question.key}-options`}
                className="text-sm font-medium text-fg"
              >
                Options (one per line)
              </label>
              <textarea
                id={`${question.key}-options`}
                value={question.optionsText}
                onChange={(e) => update(index, { optionsText: e.target.value })}
                aria-invalid={
                  errors[`questions.${index}.options`] ? true : undefined
                }
                className="min-h-[80px] rounded-sm border border-border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
              />
              {errors[`questions.${index}.options`] ? (
                <p role="alert" className="text-sm text-danger">
                  {errors[`questions.${index}.options`]}
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => update(index, { required: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-fg">Required</span>
          </label>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...questions, emptyQuestion()])}
        >
          Add question
        </Button>
      </div>
    </fieldset>
  );
}
