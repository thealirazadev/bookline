"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import type { EventTypeRecord } from "@/lib/queries/eventTypes";

type FieldErrors = Record<string, string>;

const NUMERIC_FIELDS = [
  { key: "durationMin", label: "Duration (minutes)" },
  { key: "bufferBeforeMin", label: "Buffer before (minutes)" },
  { key: "bufferAfterMin", label: "Buffer after (minutes)" },
  { key: "minNoticeMin", label: "Minimum notice (minutes)" },
  { key: "maxDaysAhead", label: "Max days ahead" },
  { key: "reminderLeadMin", label: "Reminder lead (minutes, 0 disables)" },
] as const;

function initialValues(eventType?: EventTypeRecord) {
  return {
    name: eventType?.name ?? "",
    slug: eventType?.slug ?? "",
    description: eventType?.description ?? "",
    durationMin: String(eventType?.durationMin ?? 30),
    bufferBeforeMin: String(eventType?.bufferBeforeMin ?? 0),
    bufferAfterMin: String(eventType?.bufferAfterMin ?? 0),
    minNoticeMin: String(eventType?.minNoticeMin ?? 0),
    maxDaysAhead: String(eventType?.maxDaysAhead ?? 30),
    reminderLeadMin: String(eventType?.reminderLeadMin ?? 0),
    active: eventType?.active ?? true,
  };
}

export function EventTypeForm({ eventType }: { eventType?: EventTypeRecord }) {
  const router = useRouter();
  const isEdit = Boolean(eventType);
  const [values, setValues] = useState(() => initialValues(eventType));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function update(key: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    setNotice(null);
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        slug: values.slug,
        description: values.description,
        durationMin: Number(values.durationMin),
        bufferBeforeMin: Number(values.bufferBeforeMin),
        bufferAfterMin: Number(values.bufferAfterMin),
        minNoticeMin: Number(values.minNoticeMin),
        maxDaysAhead: Number(values.maxDaysAhead),
        reminderLeadMin: Number(values.reminderLeadMin),
        active: values.active,
      };
      const res = await fetch(
        isEdit ? `/api/event-types/${eventType?.id}` : "/api/event-types",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        router.push("/dashboard/event-types");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.error?.fields) {
        setErrors(data.error.fields);
        const firstInvalid = formRef.current?.querySelector<HTMLElement>(
          "[aria-invalid='true']",
        );
        firstInvalid?.focus();
        return;
      }
      setNotice(data?.error?.message ?? "Something went wrong.");
    } catch {
      setNotice("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!eventType) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/event-types/${eventType.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/dashboard/event-types");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => null);
      setDeleteOpen(false);
      setNotice(
        data?.error?.message ??
          "This event type can't be deleted. Deactivate it instead.",
      );
    } catch {
      setNotice("Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Name"
        value={values.name}
        onChange={(e) => update("name", e.target.value)}
        error={errors.name}
        required
      />
      <Input
        label="Slug"
        value={values.slug}
        onChange={(e) => update("slug", e.target.value)}
        error={errors.slug}
        hint="Lowercase letters, numbers, and hyphens. Used in the public URL."
        required
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="et-description" className="text-sm font-medium text-fg">
          Description
        </label>
        <textarea
          id="et-description"
          value={values.description}
          maxLength={2000}
          onChange={(e) => update("description", e.target.value)}
          className="min-h-[80px] rounded-sm border border-border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {NUMERIC_FIELDS.map((field) => (
          <Input
            key={field.key}
            label={field.label}
            type="number"
            inputMode="numeric"
            value={values[field.key as keyof typeof values] as string}
            onChange={(e) => update(field.key, e.target.value)}
            error={errors[field.key]}
          />
        ))}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.active}
          onChange={(e) => update("active", e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm font-medium text-fg">
          Active (visible on the public booking page)
        </span>
      </label>

      {notice ? (
        <p role="alert" className="text-sm text-danger">
          {notice}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" loading={submitting}>
          {isEdit ? "Save changes" : "Create event type"}
        </Button>
        {isEdit ? (
          <Button
            type="button"
            variant="danger"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
        ) : null}
      </div>

      {deleteOpen ? (
        <ConfirmDialog
          title="Delete this event type?"
          message="This cannot be undone. Event types with bookings must be deactivated instead."
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </form>
  );
}
