# Shared Feature

## Learnings

- `prewarmProjectData()` can reach into `chatStore.loadSessionsForProject()` before any chat UI effect has called `chatStore.initialize()`. Shared hover/prewarm flows must treat chat-store hydration as asynchronous and avoid assuming the chat store is already restored.
