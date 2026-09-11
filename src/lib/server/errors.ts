export class ServiceError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "INVALID_REQUEST") {
    super(message);
    this.name = "ServiceError";
  }
}

export function databaseError(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  // Expose only deliberate business-rule exceptions, never SQL, queries or connection details.
  if (code === "P0001" && message.length < 300 && !/select |insert |password|secret|postgres/i.test(message)) {
    throw new ServiceError(message, 409, "RULE_REJECTED");
  }
  if (code === "42501" || /permission denied/i.test(message)) throw new ServiceError("You do not have permission for this action.", 403, "FORBIDDEN");
  if (code === "23505") throw new ServiceError("This action has already been recorded.", 409, "CONFLICT");
  if (code === "23514" || code === "22P02") throw new ServiceError("The supplied values are invalid.");
  throw new ServiceError("The operation could not be completed. Please try again.", 503, "SERVICE_UNAVAILABLE");
}
