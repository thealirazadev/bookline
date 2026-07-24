// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  BookingConfirmation,
  type BookingConfirmationData,
} from "@/components/booking/BookingConfirmation";

afterEach(cleanup);

const data: BookingConfirmationData = {
  booking: {
    startUtc: "2026-08-03T16:00:00.000Z",
    endUtc: "2026-08-03T16:30:00.000Z",
    inviteeName: "Dana Ortiz",
    eventType: { name: "Intro call" },
  },
  manageUrl: "http://localhost:3000/manage/tok",
  emailStatus: "sent",
};

describe("BookingConfirmation accessibility", () => {
  it("exposes the confirmation as a live status region", () => {
    render(<BookingConfirmation data={data} timezone="UTC" />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("You're booked");
    expect(region).toHaveTextContent("Intro call");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("moves focus to the confirmation on mount", () => {
    render(<BookingConfirmation data={data} timezone="UTC" />);
    expect(screen.getByRole("status")).toHaveFocus();
  });

  it("warns without losing the manage link when email delivery is pending", () => {
    render(
      <BookingConfirmation
        data={{ ...data, emailStatus: "pending" }}
        timezone="UTC"
      />,
    );
    expect(
      screen.getByRole("link", { name: /cancel or reschedule/i }),
    ).toHaveAttribute("href", data.manageUrl);
    expect(
      screen.getByText(/couldn't send the confirmation/i),
    ).toBeInTheDocument();
  });
});
