export function resolveDeleteFromSystemDefault(
  canDeleteFromSystem: boolean,
  defaultDeleteFromSystem: boolean
): boolean {
  return canDeleteFromSystem && defaultDeleteFromSystem
}
