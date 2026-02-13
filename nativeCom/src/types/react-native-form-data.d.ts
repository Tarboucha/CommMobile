/**
 * React Native FormData type augmentation
 *
 * React Native's FormData.append() accepts a file-like object
 * with { uri, name, type } for file uploads, but the standard
 * Web API types only accept string | Blob.
 *
 * This augmentation adds proper typing for the RN file pattern
 * so we don't need `as any` casts when appending files.
 */

/**
 * React Native file object for FormData uploads
 */
interface ReactNativeFormDataFile {
  uri: string;
  name: string | undefined;
  type: string;
}

interface FormData {
  append(name: string, value: ReactNativeFormDataFile, fileName?: string): void;
}
