export function resolveSessionSelectedModelId(
  activeSessionModelId: string | null,
  availableModelIds: string[]
): string | null {
  const normalizedModelId = activeSessionModelId?.trim() ?? null

  if (!normalizedModelId) {
    return null
  }

  return availableModelIds.includes(normalizedModelId) ? normalizedModelId : null
}
