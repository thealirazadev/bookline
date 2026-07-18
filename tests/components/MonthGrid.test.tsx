// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthGrid } from "@/components/booking/MonthGrid";

afterEach(cleanup);

const days = Array.from({ length: 31 }, (_, i) => ({
  date: `2026-08-${String(i + 1).padStart(2, "0")}`,
  hasSlots: (i + 1) % 2 === 0, // even days have slots
}));

function renderGrid(onSelect = vi.fn()) {
  render(
    <MonthGrid
      month="2026-08"
      days={days}
      selectedDate={null}
      todayIso="2026-08-15"
      loading={false}
      onSelect={onSelect}
      onChangeMonth={vi.fn()}
    />,
  );
  return onSelect;
}

describe("MonthGrid accessibility", () => {
  it("renders a grid with availability in each cell's name", () => {
    renderGrid();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /August 16, times available/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /August 15, no times available/ }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("moves focus with arrow keys and selects an available day with Enter", async () => {
    const user = userEvent.setup();
    const onSelect = renderGrid();

    screen.getByRole("gridcell", { name: /August 15/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: /August 16/ })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("2026-08-16");
  });

  it("does not select an unavailable day on Enter", async () => {
    const user = userEvent.setup();
    const onSelect = renderGrid();

    // Start from the roving focus target (today, August 15) to keep the
    // component's internal focus in sync with the DOM.
    screen.getByRole("gridcell", { name: /August 15/ }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}"); // 15 -> 16 -> 17 (no slots)
    expect(screen.getByRole("gridcell", { name: /August 17/ })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
