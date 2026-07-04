import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthorized } from "@/lib/auth";

const KEY = "s3cret-key-value";

function reqWith(header?: string): Request {
  return new Request("http://localhost/api/recipes", {
    headers: header ? { authorization: header } : {},
  });
}

describe("isAuthorized", () => {
  beforeEach(() => {
    process.env.RECIPES_API_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.RECIPES_API_KEY;
  });

  it("accepts a valid Bearer key", () => {
    expect(isAuthorized(reqWith(`Bearer ${KEY}`))).toBe(true);
  });

  it("rejects a wrong key of the same length", () => {
    const wrong = "x".repeat(KEY.length);
    expect(isAuthorized(reqWith(`Bearer ${wrong}`))).toBe(false);
  });

  it("rejects a wrong key of a different length (length-independent compare)", () => {
    expect(isAuthorized(reqWith("Bearer short"))).toBe(false);
    expect(isAuthorized(reqWith(`Bearer ${KEY}extra`))).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isAuthorized(reqWith())).toBe(false);
  });

  it("rejects a non-Bearer scheme", () => {
    expect(isAuthorized(reqWith(`Basic ${KEY}`))).toBe(false);
  });

  it("rejects when no server key is configured", () => {
    delete process.env.RECIPES_API_KEY;
    expect(isAuthorized(reqWith(`Bearer ${KEY}`))).toBe(false);
  });
});
