// Structured JSON logging. One line per event on stdout; never log tokens,
// password hashes, or SMTP credentials, and always redact email addresses.

type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  event: string;
  bookingId?: string;
  code?: string;
  durationMs?: number;
  [key: string]: unknown;
}

/** Turn `dana@example.com` into `d***@example.com` for safe logging. */
export function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

function emit(level: LogLevel, fields: LogFields): void {
  const entry = { level, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (fields: LogFields): void => emit("info", fields),
  warn: (fields: LogFields): void => emit("warn", fields),
  error: (fields: LogFields): void => emit("error", fields),
};
