/** Reads the filename from a Content-Disposition header, quoted or not. */
export function filenameFromDisposition(header: string | null): string | undefined {
  const match = header?.match(/filename\*?=(?:UTF-8'')?(?:"([^"]+)"|([^;]+))/i);
  const name = match?.[1] ?? match?.[2]?.trim();
  if (!name) return undefined;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** Saves a response body as a file, named by the server when it says so. */
export async function downloadResponse(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallbackName;
  a.click();
  // Revoking in the same tick can cancel the download in Safari.
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
