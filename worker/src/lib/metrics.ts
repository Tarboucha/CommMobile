import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client'

// Process-level metrics (CPU, RAM, event loop lag, GC pauses, handle count)
collectDefaultMetrics({ prefix: 'kodo_worker_', register })

// Counter: job run count, labeled by job name + success/failed
export const jobRunsTotal = new Counter({
  name: 'kodo_worker_jobs_run_total',
  help: 'Total number of worker job runs',
  labelNames: ['job', 'status'], // status: success | failed
  registers: [register],
})

// Histogram: job duration in seconds, labeled by job name
// Buckets cover short (0.1s) to very long (15min) jobs.
export const jobDuration = new Histogram({
  name: 'kodo_worker_job_duration_seconds',
  help: 'Worker job duration in seconds',
  labelNames: ['job'],
  buckets: [0.1, 0.5, 1, 5, 15, 60, 300, 900],
  registers: [register],
})

export { register }
