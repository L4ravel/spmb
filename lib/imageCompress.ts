export async function compressImageIfNeeded(file: File, maxBytes = 3 * 1024 * 1024) {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= maxBytes) return file;

  // load ke img
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); res(i); };
    i.onerror = rej;
    i.src = url;
  });

  const MAX_SIDE = 2000;
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  // paksa JPEG agar kompatibel (HEIC/PNG → JPEG)
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), "image/jpeg", 0.8)
  );

  // nama baru .jpg
  const name = file.name.replace(/\.(heic|heif|png|webp)$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}
