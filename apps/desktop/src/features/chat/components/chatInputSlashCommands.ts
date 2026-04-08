export function getActiveSlashCommandQuery(value: string): string | null {
  const normalizedValue = value.replace(/[\r\n]+$/, "")
  const match = normalizedValue.match(/^\/([^\s\r\n]*)$/)
  return match ? (match[1] ?? "") : null
}
