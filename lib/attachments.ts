export interface ImageAttachment {
  kind: "image";
  name: string;
  mediaType: string;
  url: string;
}

export interface CsvAttachment {
  kind: "csv";
  name: string;
  text: string;
}

export type ChatAttachment = ImageAttachment | CsvAttachment;

export const MAX_ATTACHMENTS = 3;
export const MAX_CSV_CHARS = 20000;
export const CSV_MAX_BYTES = 1024 * 1024;

function cleanName(name: string): string {
  return name.replace(/[\[\]()]/g, "").trim().slice(0, 200) || "file";
}

export function composeMessageContent(text: string, attachments: ChatAttachment[]): string {
  const parts = [text.trim()];
  for (const a of attachments) {
    if (a.kind === "csv") {
      parts.push(`\n\n\`\`\`csv:${cleanName(a.name)}\n${a.text}\n\`\`\``);
    } else {
      parts.push(`\n\n![${cleanName(a.name)}](${a.url})`);
    }
  }
  return parts.join("").trim() || "(file attached)";
}

export function composeModelText(text: string, attachments: ChatAttachment[]): string {
  const parts = [text.trim()];
  for (const a of attachments) {
    if (a.kind === "csv") {
      parts.push(`\n\n\`\`\`csv:${cleanName(a.name)}\n${a.text}\n\`\`\``);
    }
  }
  return parts.join("").trim();
}

export function extractImageUrls(text: string): string[] {
  const out: string[] = [];
  const pattern = /!\[[^\]]*\]\(https:\/\/res\.cloudinary\.com\/[^)\s]+\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (!out.includes(match[1])) out.push(match[1]);
  }
  return out;
}

export function mediaTypeForUrl(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return null;
}

export function isCloudinaryUrl(url: string, cloudName: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      cloudName.length > 0 &&
      parsed.pathname.startsWith(`/${cloudName}/`)
    );
  } catch {
    return false;
  }
}
