import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { pool } from '../lib/db.js'
import { s3, BUCKET } from '../lib/s3.js'
import { log } from '../lib/logger.js'

/**
 * Delete message attachments past their TTL.
 *
 * Removes both the DB row and the R2 object. Runs hourly.
 *
 * Safe to run concurrently from multiple workers — the DELETE ... RETURNING
 * pattern guarantees each attachment is claimed by exactly one worker.
 */
export async function expireAttachments(): Promise<{ deleted: number }> {
  const started = Date.now()

  const { rows } = await pool.query<{ id: string; file_url: string }>(
    `DELETE FROM message_attachments
     WHERE expires_at IS NOT NULL AND expires_at < now()
     RETURNING id, file_url`
  )

  if (rows.length === 0) {
    log.info('expire-attachments: nothing to delete', { duration_ms: Date.now() - started })
    return { deleted: 0 }
  }

  // R2/S3 caps DeleteObjects at 1000 keys per call. Chunk to be safe.
  type Row = { id: string; file_url: string }
  const chunks: Row[][] = []
  for (let i = 0; i < rows.length; i += 1000) {
    chunks.push(rows.slice(i, i + 1000))
  }

  let r2Deleted = 0
  let r2Failed = 0

  for (const chunk of chunks) {
    try {
      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: chunk.map((r) => ({ Key: r.file_url })),
            Quiet: true,
          },
        })
      )
      r2Deleted += chunk.length - (result.Errors?.length ?? 0)
      r2Failed += result.Errors?.length ?? 0
      if (result.Errors?.length) {
        log.warn('expire-attachments: some R2 deletes failed', {
          errors: result.Errors.slice(0, 5),
        })
      }
    } catch (err) {
      r2Failed += chunk.length
      log.error('expire-attachments: R2 chunk delete failed', {
        error: err instanceof Error ? err.message : String(err),
        chunk_size: chunk.length,
      })
    }
  }

  log.info('expire-attachments: done', {
    db_deleted: rows.length,
    r2_deleted: r2Deleted,
    r2_failed: r2Failed,
    duration_ms: Date.now() - started,
  })

  return { deleted: rows.length }
}
