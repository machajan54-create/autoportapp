export type ResizeOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  preserveFormat?: boolean;
};

export async function resizeImage(
  file: File,
  options: ResizeOptions = {},
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    preserveFormat = false,
  } = options;

  if (!file.type.startsWith("image/")) return file;
  // HEIC/HEIF canvas nezpracuje – vrátíme původní, ať to nezablokuje upload
  if (/image\/heic|image\/heif/i.test(file.type)) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (img.width <= maxWidth && img.height <= maxHeight) {
        resolve(file);
        return;
      }

      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const outType = preserveFormat ? file.type : "image/jpeg";
      const outName = preserveFormat
        ? file.name
        : file.name.replace(/\.[^.]+$/, ".jpg");

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], outName, {
              type: outType,
              lastModified: file.lastModified,
            }),
          );
        },
        outType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
