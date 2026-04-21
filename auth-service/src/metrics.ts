import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client'

// Process-level metrics (CPU, RAM, event loop lag, GC pauses, handle count)
collectDefaultMetrics({ prefix: 'kodo_auth_', register })

// HTTP request counter — labeled by method, route template, status
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled by auth-service',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
})

// HTTP request duration histogram (seconds)
// Buckets tuned for typical API latencies — tail at 10s for really slow ones.
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

export { register }
