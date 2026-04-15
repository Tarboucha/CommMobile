/**
 * Loads environment variables for local scripts.
 * Mirrors what docker-compose does: root .env first, then service .env.
 *
 * Import this instead of 'dotenv/config' in all scripts:
 *   import './load-env'
 */
import dotenv from 'dotenv'
import { resolve } from 'path'

// 1. nextserver/.env — service-specific vars (NEXT_PUBLIC_*, etc.)
dotenv.config({ path: resolve(__dirname, '../.env') })

// 2. Root .env — shared vars (DATABASE_URL with @postgres:5432, etc.)
dotenv.config({ path: resolve(__dirname, '../../.env') })

// 3. Override DATABASE_URL with localhost version for local scripts
if (process.env.DATABASE_URL_LOCAL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_LOCAL
}
