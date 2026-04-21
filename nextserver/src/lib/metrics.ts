import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Metric,
} from 'prom-client'

// `lib/metrics.ts` can be evaluated more than once (Next.js compiles separate
// bundles for instrumentation and route handlers). prom-client itself is marked
// `serverExternalPackages` so the registry is shared via Node's require cache —
// we just need each metric to be created once per process.
function singleton<T extends Metric>(name: string, create: () => T): T {
  const existing = register.getSingleMetric(name)
  if (existing) return existing as T
  return create()
}

// Process-level metrics (CPU, RAM, event loop lag, GC pauses, handle count).
// Idempotent: prom-client's collectDefaultMetrics registers each metric by
// name, and calling it twice would throw. We gate on a sentinel metric.
if (!register.getSingleMetric('kodo_api_process_cpu_user_seconds_total')) {
  collectDefaultMetrics({ prefix: 'kodo_api_', register })
}

export const httpRequestsTotal = singleton(
  'http_requests_total',
  () => new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests handled by kodo-api',
    labelNames: ['method', 'route', 'status'],
    registers: [register],
  }),
)

export const httpRequestDuration = singleton(
  'http_request_duration_seconds',
  () => new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  }),
)

/**
 * Collapse dynamic path segments to their template form to keep label cardinality
 * bounded. UUIDs and numeric IDs become `:id`; unknown segments pass through.
 */
export function normalizeRoute(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id')
}

export { register }
