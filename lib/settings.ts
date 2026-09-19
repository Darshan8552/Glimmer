export const SYSTEM_PROMPT_MAX_LENGTH = 2000;

export function normalizeSystemPrompt(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
