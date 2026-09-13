import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ localServiceRpc: vi.fn() }));
vi.mock("@/lib/server/database", () => ({ localServiceRpc: mocks.localServiceRpc }));
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
  mocks.localServiceRpc.mockResolvedValue({ processed: 1 });
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
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
  });

  it("does not start without CRON_SECRET of 32+", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", "too-short");
    vi.stubEnv("VITEST", "");
    expect(startLocalCloser()).toEqual({ started: false, reason: "cron-secret" });
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
  });

  it("does not start when VITEST is set even if flag is true", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "true");
    expect(startLocalCloser()).toEqual({ started: false, reason: "vitest" });
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
  });

  it("does not start when hosted markers disable local runtime", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "");
    vi.stubEnv("VERCEL", "1");
    expect(startLocalCloser()).toEqual({ started: false, reason: "local-runtime" });
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
  });

  it("does not start on the edge runtime", () => {
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    expect(startLocalCloser()).toEqual({ started: false, reason: "edge" });
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
  });

  it("starts when local runtime is enabled and ticks settle_due every 15s", async () => {
    vi.useFakeTimers();
    stubLocalRuntime();
    vi.stubEnv("AUCTA_LOCAL_CLOSER", "true");
    vi.stubEnv("CRON_SECRET", secret);
    vi.stubEnv("VITEST", "");
    expect(startLocalCloser()).toEqual({ started: true });
    expect(mocks.localServiceRpc).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.localServiceRpc).toHaveBeenCalledWith("settle_due", { p_limit: 50 });
    stopLocalCloser();
  });
});
