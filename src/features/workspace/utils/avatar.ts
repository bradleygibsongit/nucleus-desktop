const DICEBEAR_BOTTTS_NEUTRAL_BASE_URL = "https://api.dicebear.com/9.x/bottts-neutral/svg"
const AGENT_AVATAR_BACKGROUND_COLORS = [
  "b6e3f4",
  "c0aede",
  "d1d4f9",
  "ffd5dc",
  "f9d7ff",
  "fcd5ce",
  "ffdfbf",
  "ffe8a3",
  "d8f5c6",
  "b8f2e6",
  "c7f0ff",
  "cfe1ff",
]

export function createAgentAvatarSeed(): string {
  return crypto.randomUUID()
}

export function getAgentAvatarUrl(seed: string): string {
  const params = new URLSearchParams({
    seed,
    backgroundType: "solid",
    backgroundColor: AGENT_AVATAR_BACKGROUND_COLORS.join(","),
  })

  return `${DICEBEAR_BOTTTS_NEUTRAL_BASE_URL}?${params.toString()}`
}
