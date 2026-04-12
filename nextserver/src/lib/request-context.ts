import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Request-scoped context using Node.js AsyncLocalStorage.
 *
 * Any code in the call stack can call getRequestId() to get the current
 * request's ID — no parameter drilling needed. The ID is set once in
 * withAuth/withSecureAuth and is available in services, guards, and utilities.
 */

interface RequestContext {
  requestId: string;
  startTime: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function within a request context. Called by withAuth/withSecureAuth.
 */
export function runWithRequestContext<T>(fn: () => T | Promise<T>): Promise<T> {
  const ctx: RequestContext = {
    requestId: randomUUID().slice(0, 8), // short 8-char ID (enough for log correlation)
    startTime: Date.now(),
  };
  return storage.run(ctx, fn) as Promise<T>;
}

/**
 * Get the current request ID. Returns "no-ctx" if called outside a request
 * (e.g., during startup or in a background job).
 */
export function getRequestId(): string {
  return storage.getStore()?.requestId ?? "no-ctx";
}

/**
 * Get milliseconds elapsed since the request started.
 */
export function getRequestDuration(): number {
  const store = storage.getStore();
  return store ? Date.now() - store.startTime : 0;
}
