export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalCloser } = await import("./lib/server/local-closer");
    startLocalCloser();
  }
}
