"use client";

import { DateTime } from "luxon";
import { useCallback, useEffect, useState } from "react";
import { MonthGrid } from "@/components/booking/MonthGrid";
import { SlotList } from "@/components/booking/SlotList";
import { TimezoneSelect } from "@/components/booking/TimezoneSelect";
import type { DayAvailability, Slot } from "@/lib/slots/types";

export interface BookingEventType {
  slug: string;
  name: string;
  description: string;
  durationMin: number;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function BookingPage({ eventType }: { eventType: BookingEventType }) {
  const [detected] = useState<string>(detectTimezone);
  const [timezone, setTimezone] = useState<string>(detected);
  const [month, setMonth] = useState<string>(() =>
    DateTime.now().setZone(detected).toFormat("yyyy-LL"),
  );
  const [days, setDays] = useState<DayAvailability[]>([]);
  const [daysLoading, setDaysLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todayIso = DateTime.now().setZone(timezone).toISODate() ?? "";

  const loadDays = useCallback(async () => {
    setDaysLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        eventType: eventType.slug,
        month,
        tz: timezone,
      });
      const res = await fetch(`/api/availability?${params.toString()}`);
      if (!res.ok) throw new Error("availability");
      const data = (await res.json()) as { days: DayAvailability[] };
      setDays(data.days);
    } catch {
      setError("We couldn't load availability. Please try again.");
      setDays([]);
    } finally {
      setDaysLoading(false);
    }
  }, [eventType.slug, month, timezone]);

  const loadSlots = useCallback(
    async (date: string) => {
      setSlotsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          eventType: eventType.slug,
          date,
          tz: timezone,
        });
        const res = await fetch(`/api/slots?${params.toString()}`);
        if (!res.ok) throw new Error("slots");
        const data = (await res.json()) as { slots: Slot[] };
        setSlots(data.slots);
      } catch {
        setError("We couldn't load times. Please try again.");
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [eventType.slug, timezone],
  );

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  useEffect(() => {
    if (selectedDate) void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleChangeTimezone = (next: string) => {
    setTimezone(next);
    setSelectedSlot(null);
  };

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="flex flex-col gap-4 md:w-2/5">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight">
            {eventType.name}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {eventType.durationMin} minutes
          </p>
        </div>
        {eventType.description ? (
          <p className="text-fg-muted">{eventType.description}</p>
        ) : null}
        <TimezoneSelect
          value={timezone}
          detected={detected}
          onChange={handleChangeTimezone}
        />
        <p className="sr-only" aria-live="polite">
          Times shown in {timezone}
        </p>
      </div>

      <div className="flex flex-col gap-6 md:w-3/5">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <MonthGrid
          month={month}
          days={days}
          selectedDate={selectedDate}
          todayIso={todayIso}
          loading={daysLoading}
          onSelect={handleSelectDate}
          onChangeMonth={setMonth}
        />
        <div>
          <h2 className="mb-2 text-[1.25rem] font-semibold">
            {selectedDate
              ? DateTime.fromISO(selectedDate).toFormat("cccc, LLLL d")
              : "Available times"}
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
      </div>
    </div>
  );
}
