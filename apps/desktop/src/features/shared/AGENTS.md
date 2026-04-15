# Shared Feature

## Learnings

- `prewarmProjectData()` can reach into `chatStore.loadSessionsForProject()` before any chat UI effect has called `chatStore.initialize()`. Shared hover/prewarm flows must treat chat-store hydration as asynchronous and avoid assuming the chat store is already restored.
- When the right sidebar keeps `BrowserSidebar` mounted for persistence, the `activeTab === "browser"` path must short-circuit the other sidebar body branches; otherwise the browser panel and files/changes/checks content can render together.
