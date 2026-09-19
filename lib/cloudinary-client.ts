export interface CloudinaryImage {
  url: string;
  name: string;
  format: string;
  bytes: number;
}

interface CloudinaryResponse {
  secure_url?: unknown;
  original_filename?: unknown;
  format?: unknown;
  bytes?: unknown;
  error?: { message?: unknown };
}

export function uploadImage(
  file: File,
  opts: {
    cloudName: string;
    preset: string;
    onProgress: (pct: number) => void;
  }
): { promise: Promise<CloudinaryImage>; abort: () => void } {
  let current: XMLHttpRequest | null = null;
  const promise = new Promise<CloudinaryImage>((resolve, reject) => {
    const req = new XMLHttpRequest();
    current = req;
    req.open("POST", `https://api.cloudinary.com/v1_1/${opts.cloudName}/image/upload`);
    req.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    req.onload = () => {
      let data: CloudinaryResponse;
      try {
        data = JSON.parse(req.responseText) as CloudinaryResponse;
      } catch {
        reject(new Error(`Upload failed (${req.status}).`));
        return;
      }
      if (req.status >= 200 && req.status < 300 && typeof data.secure_url === "string") {
        const format = typeof data.format === "string" ? data.format : "";
        const base =
          typeof data.original_filename === "string" && data.original_filename.length > 0
            ? data.original_filename
            : "photo";
        resolve({
          url: data.secure_url,
          name: format ? `${base}.${format}` : base,
          format,
          bytes: typeof data.bytes === "number" ? data.bytes : file.size,
        });
      } else {
        const detail =
          data.error && typeof data.error.message === "string"
            ? data.error.message
            : `Upload failed (${req.status}).`;
        reject(new Error(detail));
      }
    };
    req.onerror = () => reject(new Error("Upload failed. Check your connection."));
    req.onabort = () => reject(new Error("Upload cancelled."));
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", opts.preset);
    req.send(form);
  });
  return { promise, abort: () => current?.abort() };
}
