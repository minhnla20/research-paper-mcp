import axios from "axios";

const timeoutMs = Number(process.env.PDF_DOWNLOAD_TIMEOUT || 30000);
const maxSizeMb = Number(process.env.MAX_PDF_SIZE_MB || 50);

export async function downloadPdf(url: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      signal: controller.signal as any,
      maxContentLength: maxSizeMb * 1024 * 1024,
      headers: { Accept: "application/pdf" },
    });
    return new Uint8Array(res.data);
  } finally {
    clearTimeout(timer);
  }
}

