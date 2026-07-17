"use client";

import { DateTime } from "luxon";
import { useRef, useState } from "react";
import type { BookingConfirmationData } from "@/components/booking/BookingConfirmation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Slot } from "@/lib/slots/types";

interface BookingFormProps {
  eventTypeSlug: string;
  slot: Slot;
  timezone: string;
  onBooked: (data: BookingConfirmationData) => void;
  onSlotTaken: (message: string, refreshedSlots: Slot[] | null) => void;
}

interface FieldErrors {
  name?: string;
  email?: string;
  form?: string;
}

export function BookingForm({
  eventTypeSlug,
  slot,
  timezone,
  onBooked,
  onSlotTaken,
}: BookingFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const when = DateTime.fromISO(slot.startUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d 'at' h:mm a");

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
        }),
      });
      const data = await res.json();

      if (res.status === 201) {
        onBooked(data as BookingConfirmationData);
        return;
      }
      if (res.status === 400 && data?.error?.fields) {
        setErrors(data.error.fields);
        if (data.error.fields.name) nameRef.current?.focus();
        else if (data.error.fields.email) emailRef.current?.focus();
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
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    >
      <p className="text-sm text-fg-muted">
        Booking <span className="font-medium text-fg">{when}</span> ({timezone})
      </p>
      <Input
        ref={nameRef}
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoComplete="name"
        required
      />
      <Input
        ref={emailRef}
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        autoComplete="email"
        required
      />
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
