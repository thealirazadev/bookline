// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SlotList } from "@/components/booking/SlotList";
import type { Slot } from "@/lib/slots/types";

afterEach(cleanup);

const slots: Slot[] = [
  { startUtc: "2026-08-03T16:00:00.000Z", endUtc: "2026-08-03T16:30:00.000Z" },
  { startUtc: "2026-08-03T17:00:00.000Z", endUtc: "2026-08-03T17:30:00.000Z" },
  { startUtc: "2026-08-03T18:00:00.000Z", endUtc: "2026-08-03T18:30:00.000Z" },
];

describe("SlotList accessibility", () => {
  it("announces the available count and timezone for a day with slots", () => {
    render(
      <SlotList
        slots={slots}
        selectedStart={null}
        timezone="UTC"
        loading={false}
        hasSelectedDate
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 times available, shown in UTC.",
    );
    // Each slot is a labeled, toggleable button.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[0]).toHaveTextContent("4:00 PM");
  });

  it("announces the empty state when a selected day has no slots", () => {
    render(
      <SlotList
        slots={[]}
        selectedStart={null}
        timezone="UTC"
        loading={false}
        hasSelectedDate
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "No open times on this day.",
    );
    expect(screen.getByText("No open times on this day")).toBeInTheDocument();
  });

  it("stays silent until a day is selected", () => {
    render(
      <SlotList
        slots={[]}
        selectedStart={null}
        timezone="UTC"
        loading={false}
        hasSelectedDate={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(
      screen.getByText("Select a day to see open times."),
    ).toBeInTheDocument();
  });

  it("uses the singular noun for a single slot", () => {
    render(
      <SlotList
        slots={[slots[0]]}
        selectedStart={null}
        timezone="UTC"
        loading={false}
        hasSelectedDate
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 time available, shown in UTC.",
    );
  });
});
