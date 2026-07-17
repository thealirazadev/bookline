import { NextResponse } from "next/server";
import { logger } from "./logger";

// One error-response format for the whole API (see docs/api-contracts.md):
//   { "error": { "code", "message", "fields?" }, ...extra }
// Recovery data (e.g. refreshedSlots on SLOT_TAKEN) rides alongside `error`.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "TOKEN_INVALID"
  | "SLOT_TAKEN"
  | "SLOT_UNAVAILABLE"
  | "BOOKING_NOT_ACTIONABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOKEN_INVALID: 404,
  SLOT_TAKEN: 409,
  SLOT_UNAVAILABLE: 422,
  BOOKING_NOT_ACTIONABLE: 410,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check the highlighted fields.",
  UNAUTHORIZED: "You need to sign in to do that.",
  NOT_FOUND: "We couldn't find what you were looking for.",
  TOKEN_INVALID: "This link isn't valid.",
  SLOT_TAKEN: "That time was just booked. Pick another slot.",
  SLOT_UNAVAILABLE: "That time is no longer available. Please pick another slot.",
  BOOKING_NOT_ACTIONABLE: "This booking can no longer be changed.",
  INTERNAL: "Something went wrong. Please try again.",
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;
  readonly extra?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    options: {
      message?: string;
      fields?: Record<string, string>;
      extra?: Record<string, unknown>;
    } = {},
  ) {
    super(options.message ?? DEFAULT_MESSAGE[code]);
    this.name = "ApiError";
    this.code = code;
    this.fields = options.fields;
    this.extra = options.extra;
  }
}

export const validationError = (
  fields: Record<string, string>,
  message?: string,
): ApiError => new ApiError("VALIDATION_ERROR", { fields, message });

export const unauthorized = (): ApiError => new ApiError("UNAUTHORIZED");
export const notFound = (message?: string): ApiError =>
  new ApiError("NOT_FOUND", { message });
export const tokenInvalid = (): ApiError => new ApiError("TOKEN_INVALID");
export const slotTaken = (refreshedSlots: unknown): ApiError =>
  new ApiError("SLOT_TAKEN", { extra: { refreshedSlots } });
export const slotUnavailable = (message?: string): ApiError =>
  new ApiError("SLOT_UNAVAILABLE", { message });
export const bookingNotActionable = (): ApiError =>
  new ApiError("BOOKING_NOT_ACTIONABLE");

/** Serialize an ApiError to the documented JSON response. */
export function errorResponse(error: ApiError): NextResponse {
  const body: Record<string, unknown> = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    },
    ...(error.extra ?? {}),
  };
  return NextResponse.json(body, { status: STATUS[error.code] });
}

/**
 * Turn any thrown value into a safe response. Known ApiErrors pass through;
 * anything else is logged with detail and returned as a generic 500 so no
 * stack trace, SQL, or secret ever reaches the client.
 */
export function handleRouteError(error: unknown, event: string): NextResponse {
  if (error instanceof ApiError) {
    return errorResponse(error);
  }
  logger.error({
    event,
    code: "INTERNAL",
    message: error instanceof Error ? error.message : String(error),
  });
  return errorResponse(new ApiError("INTERNAL"));
}
