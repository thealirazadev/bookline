import { describe, expect, it } from "vitest";
import { manageUrl, signManageToken, verifyManageToken } from "@/lib/tokens";

const SECRET = "test-link-secret";

describe("manage tokens", () => {
  it("round-trips a booking id", () => {
    const token = signManageToken("bk_01j9x7", SECRET);
    expect(verifyManageToken(token, SECRET)).toBe("bk_01j9x7");
  });

  it("rejects a token signed with a different secret", () => {
    const token = signManageToken("bk_01j9x7", SECRET);
    expect(verifyManageToken(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signManageToken("bk_01j9x7", SECRET);
    const tampered = `${token.slice(0, -2)}xy`;
    expect(verifyManageToken(tampered, SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signManageToken("bk_01j9x7", SECRET);
    const signature = token.split(".")[1];
    const forged = `${Buffer.from("bk_evil").toString("base64url")}.${signature}`;
    expect(verifyManageToken(forged, SECRET)).toBeNull();
  });

  it("rejects a truncated token", () => {
    expect(verifyManageToken("abc", SECRET)).toBeNull();
    expect(verifyManageToken("", SECRET)).toBeNull();
  });

  it("rejects a token with no separator", () => {
    const token = signManageToken("bk_01j9x7", SECRET).replace(".", "");
    expect(verifyManageToken(token, SECRET)).toBeNull();
  });

  it("rejects a non-canonically encoded payload with a valid signature", () => {
    const id = "booking-42";
    const canonical = Buffer.from(id).toString("base64url");
    // Standard base64 keeps the "=" padding that base64url strips, so the two
    // encodings of the same id differ while both decode back to it.
    const nonCanonical = Buffer.from(id).toString("base64");
    expect(nonCanonical).not.toBe(canonical);
    expect(Buffer.from(nonCanonical, "base64url").toString("utf8")).toBe(id);

    // The signature is valid for the id; only the canonical-encoding guard
    // should reject the token, closing an encoding-malleability hole.
    const signature = signManageToken(id, SECRET).split(".")[1];
    expect(verifyManageToken(`${nonCanonical}.${signature}`, SECRET)).toBeNull();
  });

  it("builds a manage url that verifies back to the booking", () => {
    const url = manageUrl("http://localhost:3000/", "bk_01j9x7", SECRET);
    expect(url).toContain("/manage/");
    const token = url.split("/manage/")[1];
    expect(verifyManageToken(token, SECRET)).toBe("bk_01j9x7");
  });
});
