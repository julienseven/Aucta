export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { isLocalDemo } = await import("@/lib/runtime");
    if (isLocalDemo()) {
      const { seedDatabase } = await import("@/db/seed");
      await seedDatabase();
      const { startScheduler } = await import("@/lib/scheduler");
      startScheduler();
    }
  }
}
