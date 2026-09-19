export function optimisticTitle(text: string, firstFileName?: string): string {
  return text.slice(0, 60) || firstFileName || "Untitled";
}
