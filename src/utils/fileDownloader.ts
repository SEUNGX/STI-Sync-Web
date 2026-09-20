/**
 * Triggers a file download in the browser.
 * Handles Cloudinary attachment transformation and falls back gracefully
 * to direct link downloads or opening in a new tab if blob fetching is blocked.
 */
export async function downloadFile(url: string, fileName?: string): Promise<void> {
  if (!url) return;

  let downloadUrl = url;
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    if (!url.includes('fl_attachment')) {
      downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }
  }

  // Ensure fileName has proper extension if known
  let targetFileName = fileName;
  if (!targetFileName) {
    const cleanUrl = url.split('?')[0].split('#')[0];
    targetFileName = cleanUrl.split('/').pop() || 'downloaded-file';
  }

  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch file: ${res.statusText}`);
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = targetFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to direct URL navigation:', err);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = targetFileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
