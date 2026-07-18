export async function register(): Promise<void> {
  // Only run the reminder loop in the Node.js server runtime (not edge/build).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReminderLoop } = await import("@/jobs/reminders");
    startReminderLoop();
  }
}
