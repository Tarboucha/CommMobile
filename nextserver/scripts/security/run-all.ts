/**
 * Orchestrator — runs every security test suite in sequence.
 *
 * Each suite's first failure throws; this runner catches the per-suite
 * failure, prints a summary, and exits non-zero if any suite failed.
 *
 * Run with:
 *   npx tsx scripts/security/run-all.ts
 */

import { spawnSync } from 'child_process'
import { join } from 'path'

const SUITES = [
  'test-authorization.ts',
  'test-validation.ts',
  'test-tokens.ts',
  'test-rate-limits.ts',
  'test-storage.ts',
]

const results: { suite: string; passed: boolean; durationMs: number }[] = []

for (const suite of SUITES) {
  console.log('\n' + '█'.repeat(70))
  console.log(`  RUNNING: ${suite}`)
  console.log('█'.repeat(70))

  const started = Date.now()
  const result = spawnSync('npx', ['tsx', join('scripts/security', suite)], {
    stdio: 'inherit',
    shell: false,
  })
  const durationMs = Date.now() - started

  results.push({ suite, passed: result.status === 0, durationMs })
}

// Final summary
console.log('\n' + '█'.repeat(70))
console.log('  SECURITY SUITE SUMMARY')
console.log('█'.repeat(70))

for (const r of results) {
  const icon = r.passed ? '✓' : '✗'
  const pad = r.suite.padEnd(30)
  const dur = `${r.durationMs}ms`.padStart(8)
  console.log(`  ${icon} ${pad} ${dur}`)
}

const failures = results.filter(r => !r.passed).length

console.log('─'.repeat(70))
if (failures === 0) {
  console.log(`  ALL ${results.length} SUITES PASSED`)
  console.log('█'.repeat(70))
  process.exit(0)
} else {
  console.log(`  ${failures} of ${results.length} SUITES FAILED`)
  console.log('█'.repeat(70))
  process.exit(1)
}
