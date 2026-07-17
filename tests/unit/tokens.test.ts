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

  it("builds a manage url that verifies back to the booking", () => {
    const url = manageUrl("http://localhost:3000/", "bk_01j9x7", SECRET);
    expect(url).toContain("/manage/");
    const token = url.split("/manage/")[1];
    expect(verifyManageToken(token, SECRET)).toBe("bk_01j9x7");
  });
});
