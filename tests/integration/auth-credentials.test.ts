import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

// Explicit test database only: these tests create and remove their own records.
describe.skipIf(!process.env.TEST_DATABASE_URL)("auth credentials (Postgres)", () => {
  let auth: typeof import("@/lib/auth");
  let database: typeof import("@/db");
  let schema: typeof import("@/db/schema");
  let eq: typeof import("drizzle-orm").eq;
  const emails: string[] = [];
  function email() {
    const value = `auth-${randomBytes(8).toString("hex")}@test.invalid`;
    emails.push(value);
    return value;
  }
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    auth = await import("@/lib/auth");
    database = await import("@/db");
    schema = await import("@/db/schema");
    ({ eq } = await import("drizzle-orm"));
  });
  afterAll(async () => {
    if (!database) return;
    for (const address of emails) {
      await database.db.delete(schema.authTokens).where(eq(schema.authTokens.email, address));
      await database.db.delete(schema.users).where(eq(schema.users.email, address));
    }
    await database.pool.end();
  });
  it("requires email scope and persists failed attempts", async () => {
    const address = email();
    const issued = await auth.issueAuthToken(address);
    expect(await auth.consumeAuthCredential(issued.code)).toHaveProperty("error");
    expect(await auth.consumeAuthCredential(issued.code, email())).toHaveProperty("error");
    const wrong = issued.code === "100000" ? "100001" : "100000";
    for (let i = 0; i < 5; i++) {
      expect(await auth.consumeAuthCredential(wrong, address)).toHaveProperty("error");
    }
    expect(await auth.consumeAuthCredential(issued.code, address)).toHaveProperty("error");
    const [record] = await database.db.select().from(schema.authTokens).where(eq(schema.authTokens.email, address));
    expect(record.attempts).toBe(5);
    expect(record.consumedAt).not.toBeNull();
  });
  it("allows only one concurrent consumption of a magic link", async () => {
    const issued = await auth.issueAuthToken(email());
    const results = await Promise.all([
      auth.consumeAuthCredential(issued.token), auth.consumeAuthCredential(issued.token),
    ]);
    expect(results.filter((result) => !("error" in result))).toHaveLength(1);
    expect(results.filter((result) => "error" in result)).toHaveLength(1);
  });
  it("revokes previous codes and limits requests across database transactions", async () => {
    const address = email();
    const first = await auth.issueAuthToken(address);
    const second = await auth.issueAuthToken(address);
    expect(await auth.consumeAuthCredential(first.token)).toHaveProperty("error");
    expect(await auth.consumeAuthCredential(second.code, address)).toHaveProperty("email", address);
    await auth.issueAuthToken(address);
    await auth.issueAuthToken(address);
    await auth.issueAuthToken(address);
    await expect(auth.issueAuthToken(address)).rejects.toThrow("AUTH_RATE_LIMITED");
  });
});
