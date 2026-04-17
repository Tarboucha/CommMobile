/**
 * Resource-agnostic image upload helper.
 *
 * Caller supplies the per-resource sign URL (e.g. `/api/v1/offerings/{id}/images/sign`).
 * The helper resizes + re-encodes to JPEG, requests a presigned URL from kodo-api,
 * PUTs the bytes straight to R2, and returns the R2 key for the caller to POST
 * to the resource's create endpoint.
 */

import * as ImageManipulator from 'expo-image-manipulator'
import type { ImagePickerAsset } from 'expo-image-picker'
import { apiClient } from '@/lib/api/client'

export interface UploadImageOptions {
  /** Relative path to the sign endpoint — e.g. `/api/v1/offerings/abc/images/sign` */
  signPath: string
  /** The asset returned from expo-image-picker */
  asset: ImagePickerAsset
  /** Max dimension (longest edge) in pixels. Defaults to 1920. */
  maxDimension?: number
  /** JPEG quality 0.0 – 1.0. Defaults to 0.85. */
  quality?: number
}

interface SignResponse {
  upload_url: string
  key: string
  expires_in: number
  content_type: string
  max_bytes: number
}

export async function uploadImageToR2(opts: UploadImageOptions): Promise<{ key: string }> {
  const maxDimension = opts.maxDimension ?? 1920
  const quality = opts.quality ?? 0.85

  // 1. Resize + re-encode to JPEG. Skip the resize action if the image is
  //    already smaller than maxDimension (manipulator still re-encodes).
  const actions: ImageManipulator.Action[] = []
  if (opts.asset.width && opts.asset.height) {
    const longest = Math.max(opts.asset.width, opts.asset.height)
    if (longest > maxDimension) {
      // resize by whichever axis is longest
      if (opts.asset.width >= opts.asset.height) {
        actions.push({ resize: { width: maxDimension } })
      } else {
        actions.push({ resize: { height: maxDimension } })
      }
    }
  }

  const processed = await ImageManipulator.manipulateAsync(opts.asset.uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  })

  // 2. Read bytes + request presigned URL
  const response = await fetch(processed.uri)
  const blob = await response.blob()

  const sign = await apiClient.post<SignResponse>(opts.signPath, {
    filename: fileNameFromUri(processed.uri),
    content_type: 'image/jpeg',
  })

  // apiClient wraps responses — unwrap if needed. Here we use fetchAPI
  // directly which returns the payload as-is if the envelope says success.
  const signedData = (sign as unknown as { data: SignResponse }).data ?? sign

  if (blob.size > signedData.max_bytes) {
    throw new Error(
      `Image too large after resize: ${blob.size} bytes (max ${signedData.max_bytes})`
    )
  }

  // 3. PUT bytes directly to R2
  const putRes = await fetch(signedData.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  })

  if (!putRes.ok) {
    throw new Error(`R2 upload failed: ${putRes.status} ${putRes.statusText}`)
  }

  return { key: signedData.key }
}

function fileNameFromUri(uri: string): string {
  const tail = uri.split('/').pop() ?? 'image.jpg'
  return tail.split('?')[0]
}
