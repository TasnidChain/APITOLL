import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validateEnv,
  envString,
  envNumber,
  envBool,
  createHealthCheck,
} from "./env";

describe("validateEnv", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("passes when all required vars are present", () => {
    process.env.TEST_VAR_A = "hello";
    process.env.TEST_VAR_B = "world";

    const result = validateEnv({
      required: ["TEST_VAR_A", "TEST_VAR_B"],
      service: "test",
    });

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.present).toContain("TEST_VAR_A");
    expect(result.present).toContain("TEST_VAR_B");
  });

  it("throws when required vars are missing", () => {
    delete process.env.MISSING_VAR;

    expect(() =>
      validateEnv({
        required: ["MISSING_VAR"],
        service: "test",
      })
    ).toThrow("Missing required environment variables: MISSING_VAR");
  });

  it("generates warnings for missing optional vars", () => {
    process.env.REQUIRED_VAR = "present";
    delete process.env.OPTIONAL_VAR;

    const result = validateEnv({
      required: ["REQUIRED_VAR"],
      optional: ["OPTIONAL_VAR"],
      service: "test",
    });

    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("OPTIONAL_VAR");
  });

  it("includes optional vars in present when they exist", () => {
    process.env.REQ = "1";
    process.env.OPT = "2";

    const result = validateEnv({
      required: ["REQ"],
      optional: ["OPT"],
    });

    expect(result.present).toContain("REQ");
    expect(result.present).toContain("OPT");
  });

  it("lists multiple missing vars", () => {
    delete process.env.A;
    delete process.env.B;
    process.env.C = "exists";

    expect(() =>
      validateEnv({ required: ["A", "B", "C"] })
    ).toThrow("A, B");
  });
});

describe("envString", () => {
  it("returns env value when set", () => {
    process.env.STR_TEST = "hello";
    expect(envString("STR_TEST", "default")).toBe("hello");
  });

  it("returns default when not set", () => {
    delete process.env.STR_UNSET;
    expect(envString("STR_UNSET", "fallback")).toBe("fallback");
  });
});

describe("envNumber", () => {
  it("parses numeric env value", () => {
    process.env.NUM_TEST = "42";
    expect(envNumber("NUM_TEST", 0)).toBe(42);
  });

  it("returns default for non-numeric", () => {
    process.env.NUM_BAD = "not_a_number";
    expect(envNumber("NUM_BAD", 10)).toBe(10);
  });

  it("returns default when not set", () => {
    delete process.env.NUM_UNSET;
    expect(envNumber("NUM_UNSET", 99)).toBe(99);
  });
});

describe("envBool", () => {
  it('parses "true"', () => {
    process.env.BOOL_TEST = "true";
    expect(envBool("BOOL_TEST", false)).toBe(true);
  });

  it('parses "1"', () => {
    process.env.BOOL_TEST = "1";
    expect(envBool("BOOL_TEST", false)).toBe(true);
  });

  it('parses "yes"', () => {
    process.env.BOOL_TEST = "yes";
    expect(envBool("BOOL_TEST", false)).toBe(true);
  });

  it("returns false for other values", () => {
    process.env.BOOL_TEST = "nope";
    expect(envBool("BOOL_TEST", true)).toBe(false);
  });

  it("returns default when not set", () => {
    delete process.env.BOOL_UNSET;
    expect(envBool("BOOL_UNSET", true)).toBe(true);
  });
});

describe("createHealthCheck", () => {
  it("returns ok when all checks pass", () => {
    const check = createHealthCheck("test-svc", "1.0.0", {
      database: () => ({ status: "ok" }),
      cache: () => ({ status: "ok" }),
    });

    const result = check();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("test-svc");
    expect(result.version).toBe("1.0.0");
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.checks.database.status).toBe("ok");
    expect(result.checks.cache.status).toBe("ok");
  });

  it("returns degraded when a check warns", () => {
    const check = createHealthCheck("test-svc", "1.0.0", {
      database: () => ({ status: "ok" }),
      cache: () => ({ status: "warn", message: "Cache miss rate high" }),
    });

    const result = check();
    expect(result.status).toBe("degraded");
  });

  it("returns error when a check fails", () => {
    const check = createHealthCheck("test-svc", "1.0.0", {
      database: () => ({ status: "error", message: "Connection refused" }),
      cache: () => ({ status: "ok" }),
    });

    const result = check();
    expect(result.status).toBe("error");
    expect(result.checks.database.message).toBe("Connection refused");
  });

  it("handles check function that throws", () => {
    const check = createHealthCheck("test-svc", "1.0.0", {
      flaky: () => {
        throw new Error("Unexpected crash");
      },
    });

    const result = check();
    expect(result.status).toBe("error");
    expect(result.checks.flaky.status).toBe("error");
    expect(result.checks.flaky.message).toBe("Unexpected crash");
  });

  it("includes timestamp in ISO format", () => {
    const check = createHealthCheck("test", "1.0.0", {});
    const result = check();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
