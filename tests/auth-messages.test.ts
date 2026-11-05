import { describe, expect, it } from "vitest";
import { authMessage, passwordProblem, safeNext } from "@/lib/auth-messages";

describe("auth helpers", () => {
  it("explains Supabase errors plainly", () => {
    expect(authMessage("Invalid login credentials")).toBe("Wrong email or password.");
    expect(authMessage("Email not confirmed")).toMatch(/^Confirm your email/);
    expect(authMessage("User already registered")).toMatch(/already has an account/);
    expect(authMessage("Something odd")).toBe("Something odd");
  });
  it("enforces the password rule", () => {
    expect(passwordProblem("short1")).toMatch(/8 characters/);
    expect(passwordProblem("longpassword")).toMatch(/number/);
    expect(passwordProblem("deals2026")).toBeNull();
  });
  it("only redirects within the site", () => {
    expect(safeNext("/app/pipeline")).toBe("/app/pipeline");
    expect(safeNext("https://evil.example")).toBe("/app");
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext(null)).toBe("/app");
  });
});
