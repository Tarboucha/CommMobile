/**
 * Next.js instrumentation hook — runs once per Node.js runtime on startup.
 * We use it to boot a dedicated, internal-only metrics HTTP server that
 * exposes /metrics for Prometheus. The port is not published to the host
 * (docker-compose.yml), so only services on the internal network can scrape.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const http = await import('http')
  const { register } = await import('./lib/metrics')
  const { log } = await import('./lib/log')

  const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9102', 10)

  const metricsServer = http.createServer((req, res) => {
    if (req.url === '/metrics') {
      register.metrics()
        .then((m) => {
          res.writeHead(200, { 'Content-Type': register.contentType })
          res.end(m)
        })
        .catch((err) => {
          res.writeHead(500)
          res.end(String(err))
        })
    } else {
      res.writeHead(404)
      res.end()
    }
  })

  metricsServer.listen(METRICS_PORT, '0.0.0.0', () => {
    log.info({ port: METRICS_PORT }, 'metrics server listening (internal only)')
  })
}
