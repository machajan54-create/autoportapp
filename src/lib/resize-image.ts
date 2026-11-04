export type ResizeOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  preserveFormat?: boolean;
};

/** Menší soubory už nepřekódováváme, pokud nepřesahují rozměry. */
const SMALL_FILE_BYTES = 400 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((r) => canvas.toBlob(r, type, quality));
}

/**
 * Zmenší fotku na max. rozměry a převede ji do WebP (fallback JPEG),
 * aby fotky z telefonů nezabíraly zbytečně místo. Výsledek se použije,
 * jen pokud je menší než originál.
 */
export async function resizeImage(file: File, options: ResizeOptions = {}): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.82, preserveFormat = false } = options;

  if (!file.type.startsWith("image/")) return file;
  // HEIC/HEIF canvas nezpracuje, GIF by přišel o animaci, SVG je vektor
  if (/image\/(heic|heif|gif|svg)/i.test(file.type)) return file;

  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    const url = URL.createObjectURL(file);
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    el.src = url;
  });
  if (!img) return file;

  const fits = img.width <= maxWidth && img.height <= maxHeight;
  if (fits && file.size <= SMALL_FILE_BYTES) return file;

  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  let blob: Blob | null = null;
  if (preserveFormat) {
    blob = await toBlob(canvas, file.type, quality);
  } else {
    blob = await toBlob(canvas, "image/webp", quality);
    // Starší Safari WebP neumí a vrátí PNG — pak použijeme JPEG
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
  }
  if (!blob || blob.size >= file.size) return file;

  const ext = blob.type === "image/webp" ? ".webp" : blob.type === "image/jpeg" ? ".jpg" : "";
  const outName = ext ? file.name.replace(/\.[^.]+$/, "") + ext : file.name;
  return new File([blob], outName, { type: blob.type, lastModified: file.lastModified });
}
