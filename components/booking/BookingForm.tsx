"use client";

import { DateTime } from "luxon";
import { useRef, useState } from "react";
import type { BookingConfirmationData } from "@/components/booking/BookingConfirmation";
import type { BookingQuestion } from "@/components/booking/BookingPage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Slot } from "@/lib/slots/types";

interface BookingFormProps {
  eventTypeSlug: string;
  slot: Slot;
  timezone: string;
  questions: BookingQuestion[];
  onBooked: (data: BookingConfirmationData) => void;
  onSlotTaken: (message: string, refreshedSlots: Slot[] | null) => void;
}

type FieldErrors = Record<string, string>;

export function BookingForm({
  eventTypeSlug,
  slot,
  timezone,
  questions,
  onBooked,
  onSlotTaken,
}: BookingFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);

  const when = DateTime.fromISO(slot.startUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d 'at' h:mm a");

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function focusFirstInvalid() {
    formRef.current
      ?.querySelector<HTMLElement>("[aria-invalid='true']")
      ?.focus();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: eventTypeSlug,
          startUtc: slot.startUtc,
          name,
          email,
          timezone,
          answers,
        }),
      });
      const data = await res.json();

      if (res.status === 201) {
        onBooked(data as BookingConfirmationData);
        return;
      }
      if (res.status === 400 && data?.error?.fields) {
        setErrors(data.error.fields);
        focusFirstInvalid();
        return;
      }
      if (res.status === 409) {
        onSlotTaken(
          data?.error?.message ?? "That time was just booked.",
          (data?.refreshedSlots as Slot[]) ?? [],
        );
        return;
      }
      if (res.status === 422) {
        onSlotTaken(
          data?.error?.message ?? "That time is no longer available.",
          null,
        );
        return;
      }
      setErrors({
        form: data?.error?.message ?? "Something went wrong. Please try again.",
      });
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <p className="text-sm text-fg-muted">
        Booking <span className="font-medium text-fg">{when}</span> ({timezone})
      </p>
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoComplete="name"
        required
      />
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
        required
      />

      {questions.map((question) => (
        <IntakeField
          key={question.id}
          question={question}
          value={answers[question.id] ?? ""}
          error={errors[`answers.${question.id}`]}
          onChange={(value) => setAnswer(question.id, value)}
        />
      ))}

      {errors.form ? (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" loading={submitting}>
        {submitting ? "Booking..." : "Confirm booking"}
      </Button>
    </form>
  );
}

interface IntakeFieldProps {
  question: BookingQuestion;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function IntakeField({ question, value, error, onChange }: IntakeFieldProps) {
  const label = question.required ? `${question.label} *` : question.label;

  if (question.type === "short_text") {
    return (
      <Input
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        maxLength={200}
        required={question.required}
      />
    );
  }

  if (question.type === "long_text") {
    const fieldId = `intake-${question.id}`;
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-sm font-medium text-fg">
          {label}
        </label>
        <textarea
          id={fieldId}
          value={value}
          maxLength={2000}
          required={question.required}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`min-h-[80px] rounded-sm border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring ${
            error ? "border-danger" : "border-border"
          }`}
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  // single_choice
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-fg">{label}</legend>
      {question.options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={`intake-${question.id}`}
            value={option}
            checked={value === option}
            onChange={(e) => onChange(e.target.value)}
            className="h-4 w-4"
          />
          <span className="text-fg">{option}</span>
        </label>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
