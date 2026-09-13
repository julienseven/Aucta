import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ settleDue: vi.fn() }));
vi.mock("@/lib/server/mutations", () => ({ settleDue: mocks.settleDue }));
import { startLocalCloser, stopLocalCloser } from "@/lib/server/local-closer";

const secret = "local-scheduler-test-secret-at-least-32-characters";

function stubLocalRuntime() {
  vi.stubEnv("AUCTA_LOCAL_MODE", "true");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("NETLIFY", "");
  vi.stubEnv("CF_PAGES", "");
  vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
  vi.stubEnv("RENDER", "");
  vi.stubEnv("RAILWAY_ENVIRONMENT", "");
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.settleDue.mockResolvedValue({ processed: 1 });
  stopLocalCloser();
});
afterEach(() => {
  stopLocalCloser();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("local closer cadence", () => {
  it("does not start without AUCTA_LOCAL_CLOSER=true", () => {
    stubLocalRuntime();
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "");
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "");
    expect(startLocalCloser()).toEqual({ started: false, reason: "disabled" });
    expect(mocks.settleDue).not.toHaveBeenCalled();
  });

  it("does not start without CRON_SECRET of 32+", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", "too-short");
    vi.stubEnv("VITEST", "");
    expect(startLocalCloser()).toEqual({ started: false, reason: "cron-secret" });
    expect(mocks.settleDue).not.toHaveBeenCalled();
  });

  it("does not start when VITEST is set even if flag is true", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "true");
    expect(startLocalCloser()).toEqual({ started: false, reason: "vitest" });
    expect(mocks.settleDue).not.toHaveBeenCalled();
  });

  it("starts when local runtime is enabled and ticks settleDue every 15s", async () => {
    vi.useFakeTimers();
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "");
    expect(startLocalCloser()).toEqual({ started: true });
    expect(mocks.settleDue).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.settleDue).toHaveBeenCalledWith(50);
    stopLocalCloser();
  });
});
