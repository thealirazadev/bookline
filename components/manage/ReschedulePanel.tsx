"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MonthGrid } from "@/components/booking/MonthGrid";
import { SlotList } from "@/components/booking/SlotList";
import { TimezoneSelect } from "@/components/booking/TimezoneSelect";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import type { DayAvailability, Slot } from "@/lib/slots/types";

interface ReschedulePanelProps {
  token: string;
  eventTypeSlug: string;
  eventName: string;
  initialTimezone: string;
}

export function ReschedulePanel({
  token,
  eventTypeSlug,
  eventName,
  initialTimezone,
}: ReschedulePanelProps) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [month, setMonth] = useState(() =>
    DateTime.now().setZone(initialTimezone).toFormat("yyyy-LL"),
  );
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [daysLoading, setDaysLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const todayIso = DateTime.now().setZone(timezone).toISODate() ?? "";

  const loadDays = useCallback(async () => {
    setDaysLoading(true);
    const params = new URLSearchParams({
      eventType: eventTypeSlug,
      month,
      tz: timezone,
    });
    const res = await fetch(`/api/availability?${params.toString()}`);
    setDays(res.ok ? ((await res.json()).days as DayAvailability[]) : []);
    setDaysLoading(false);
  }, [eventTypeSlug, month, timezone]);

  const loadSlots = useCallback(
    async (date: string) => {
      setSlotsLoading(true);
      const params = new URLSearchParams({
        eventType: eventTypeSlug,
        date,
        tz: timezone,
      });
      const res = await fetch(`/api/slots?${params.toString()}`);
      setSlots(res.ok ? ((await res.json()).slots as Slot[]) : []);
      setSlotsLoading(false);
    },
    [eventTypeSlug, timezone],
  );

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    if (selectedDate) void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  async function handleConfirm() {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/manage/${token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUtc: selectedSlot.startUtc, timezone }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setDone(true);
        return;
      }
      if (res.status === 409) {
        setToast(data?.error?.message ?? "That time was just booked.");
        setSelectedSlot(null);
        setSlots((data?.refreshedSlots as Slot[]) ?? []);
        return;
      }
      setToast(
        data?.error?.message ?? "That time is no longer available.",
      );
      setSelectedSlot(null);
      if (selectedDate) void loadSlots(selectedDate);
    } catch {
      setToast("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 shadow-card">
        <h1 className="text-[1.25rem] font-semibold">Booking updated</h1>
        <p className="mt-2 text-fg-muted">
          Your {eventName} has been rescheduled. A new invite is on its way.
        </p>
        <Link
          href={`/manage/${token}`}
          className="mt-4 inline-block text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          View booking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="flex flex-col gap-4 md:w-2/5">
        <h1 className="text-[1.75rem] font-bold leading-tight">
          Reschedule {eventName}
        </h1>
        <TimezoneSelect
          value={timezone}
          detected={initialTimezone}
          onChange={(next) => {
            setTimezone(next);
            setSelectedSlot(null);
          }}
        />
      </div>

      <div className="flex flex-col gap-6 md:w-3/5">
        <MonthGrid
          month={month}
          days={days}
          selectedDate={selectedDate}
          todayIso={todayIso}
          loading={daysLoading}
          onSelect={(date) => {
            setSelectedDate(date);
            setSelectedSlot(null);
          }}
          onChangeMonth={setMonth}
        />
        <div>
          <h2 className="mb-2 text-[1.25rem] font-semibold">
            {selectedDate
              ? DateTime.fromISO(selectedDate).toFormat("cccc, LLLL d")
              : "New time"}
          </h2>
          <SlotList
            slots={slots}
            selectedStart={selectedSlot?.startUtc ?? null}
            timezone={timezone}
            loading={slotsLoading}
            hasSelectedDate={selectedDate !== null}
            onSelect={setSelectedSlot}
          />
        </div>
        {selectedSlot ? (
          <Button loading={submitting} onClick={handleConfirm}>
            {submitting ? "Rescheduling..." : "Confirm new time"}
          </Button>
        ) : null}
      </div>

      {toast ? <Toast message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
