import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless manage-link tokens: base64url(bookingId).hmacSha256(bookingId).
// Validity is derived from the booking's status and time, not from storage.

function hmac(bookingId: string, secret: string): string {
  return createHmac("sha256", secret).update(bookingId).digest("base64url");
}

export function signManageToken(bookingId: string, secret: string): string {
  const payload = Buffer.from(bookingId).toString("base64url");
  return `${payload}.${hmac(bookingId, secret)}`;
}

/** Return the booking id if the token is well-formed and the HMAC matches. */
export function verifyManageToken(
  token: string,
  secret: string,
): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const bookingId = Buffer.from(payload, "base64url").toString("utf8");
  if (!bookingId) return null;
  // Reject non-canonical payload encodings that decode to the same id.
  if (Buffer.from(bookingId).toString("base64url") !== payload) return null;

  const expected = hmac(bookingId, secret);
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) return null;
  if (!timingSafeEqual(provided, wanted)) return null;

  return bookingId;
}

/** Absolute manage-page URL for a booking. */
export function manageUrl(
  baseUrl: string,
  bookingId: string,
  secret: string,
): string {
  return `${baseUrl.replace(/\/$/, "")}/manage/${signManageToken(
    bookingId,
    secret,
  )}`;
}
