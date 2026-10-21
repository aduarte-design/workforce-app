import { Platform } from 'react-native';
import { fetch as expoFetch } from 'expo/fetch';

export type UploadFile = { uri: string; name: string; mimeType?: string | null };

/**
 * Multipart upload that works on web and native (expo/fetch).
 * Never set Content-Type manually — the runtime adds the boundary.
 */
export async function uploadForm(
  url: string,
  opts: { headers?: Record<string, string>; files: Record<string, UploadFile>; fields?: Record<string, string> }
) {
  const form = new FormData();
  for (const [field, f] of Object.entries(opts.files)) {
    const blob =
      Platform.OS === 'web'
        ? await (await fetch(f.uri)).blob()
        : await (await expoFetch(f.uri)).blob();
    const typed = f.mimeType && blob.type !== f.mimeType ? new Blob([blob], { type: f.mimeType }) : blob;
    form.append(field, typed as any, f.name);
  }
  for (const [k, v] of Object.entries(opts.fields || {})) form.append(k, v);

  const doFetch: any = Platform.OS === 'web' ? fetch : expoFetch;
  const res = await doFetch(url, { method: 'POST', headers: opts.headers, body: form });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    throw new Error(data?.detail || `Error ${res.status}`);
  }
  return data;
}
