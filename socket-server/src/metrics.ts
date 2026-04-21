import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client'

// Process-level metrics (CPU, RAM, event loop lag, GC pauses, handle count)
collectDefaultMetrics({ prefix: 'kodo_socket_', register })

// Gauge: currently connected socket count (inc/dec on connect/disconnect)
export const socketActiveConnections = new Gauge({
  name: 'kodo_socket_active_connections',
  help: 'Number of currently connected Socket.io clients',
  registers: [register],
})

// Counter: total connections ever opened (useful to track churn)
export const socketConnectionsTotal = new Counter({
  name: 'kodo_socket_connections_total',
  help: 'Total Socket.io connections ever opened',
  registers: [register],
})

// Counter: outbound broadcasts from pg-notify listeners
export const socketMessagesBroadcastTotal = new Counter({
  name: 'kodo_socket_messages_broadcast_total',
  help: 'Total Socket.io broadcasts triggered by pg-notify',
  labelNames: ['event_type'], // e.g. 'message:new', 'notification:new'
  registers: [register],
})

export { register }
