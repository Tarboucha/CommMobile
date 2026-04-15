import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { pool } from '../lib/db.js'
import { s3, BUCKET } from '../lib/s3.js'
import { log } from '../lib/logger.js'

const ORPHAN_AGE_HOURS = 24

/**
 * Sweep R2 for keys that have no matching DB row.
 *
 * Catches the cases where:
 *   - Mobile uploaded to R2 successfully but failed to POST the DB-create call
 *   - Avatar replacement DB-update succeeded but the old-file delete didn't
 *   - Anything else that leaves a stranded R2 object
 *
 * Only deletes keys older than ORPHAN_AGE_HOURS so we don't race uploads
 * that just finished and haven't been recorded in the DB yet.
 *
 * Runs weekly. Heavy on R2 ListObjects calls — that's why it's not hourly.
 */
export async function orphanSweep(): Promise<{ scanned: number; deleted: number }> {
  const started = Date.now()
  const cutoff = new Date(Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000)

  // 1. Build the set of all known keys from the DB across every table that
  //    references R2. Add new tables here as they appear.
  const referencedKeys = new Set<string>()

  const queries: Array<{ table: string; sql: string }> = [
    { table: 'profiles', sql: 'SELECT avatar_url AS k FROM profiles WHERE avatar_url IS NOT NULL' },
    { table: 'offering_images', sql: 'SELECT image_url AS k FROM offering_images WHERE image_url IS NOT NULL' },
    { table: 'communities', sql: 'SELECT community_image_url AS k FROM communities WHERE community_image_url IS NOT NULL' },
    { table: 'community_posts', sql: 'SELECT image_url AS k FROM community_posts WHERE image_url IS NOT NULL' },
    { table: 'message_attachments', sql: 'SELECT file_url AS k FROM message_attachments WHERE file_url IS NOT NULL' },
  ]

  for (const { sql } of queries) {
    try {
      const { rows } = await pool.query<{ k: string }>(sql)
      for (const r of rows) {
        // Stored values may be either bare keys or full URLs — strip the host if present.
        const key = stripHost(r.k)
        if (key) referencedKeys.add(key)
      }
    } catch (err) {
      // Table might not exist yet — ignore and move on.
      log.warn('orphan-sweep: query failed', {
        sql,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // 2. Walk the bucket page by page, building a list of orphan keys.
  const orphans: string[] = []
  let scanned = 0
  let continuationToken: string | undefined

  do {
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of result.Contents ?? []) {
      scanned++
      if (!obj.Key || !obj.LastModified) continue
      if (obj.LastModified > cutoff) continue              // too fresh, skip
      if (referencedKeys.has(obj.Key)) continue            // referenced in DB
      orphans.push(obj.Key)
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (continuationToken)

  // 3. Delete in chunks of 1000 (S3 limit).
  let deleted = 0
  for (let i = 0; i < orphans.length; i += 1000) {
    const chunk = orphans.slice(i, i + 1000)
    try {
      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: chunk.map((k) => ({ Key: k })), Quiet: true },
        })
      )
      deleted += chunk.length - (result.Errors?.length ?? 0)
      if (result.Errors?.length) {
        log.warn('orphan-sweep: some R2 deletes failed', {
          errors: result.Errors.slice(0, 5),
        })
      }
    } catch (err) {
      log.error('orphan-sweep: chunk delete failed', {
        error: err instanceof Error ? err.message : String(err),
        chunk_size: chunk.length,
      })
    }
  }

  log.info('orphan-sweep: done', {
    referenced_in_db: referencedKeys.size,
    r2_scanned: scanned,
    orphans_found: orphans.length,
    deleted,
    duration_ms: Date.now() - started,
  })

  return { scanned, deleted }
}

/**
 * If the value looks like a full URL (CDN host), strip the host so we can
 * compare against R2 object keys. Otherwise return as-is.
 */
function stripHost(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const u = new URL(value)
      return u.pathname.replace(/^\//, '')
    } catch {
      return value
    }
  }
  return value
}
