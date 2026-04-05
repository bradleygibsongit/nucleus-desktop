# Chat Feature

## Learnings

- Startup restore must beat any chat mutation or persist path. If `loadSessionsForProject()`, `openDraftSession()`, `createSession()`, or `_persistState()` run before `initialize()` finishes, `chat.json` can be overwritten with an empty worktree bucket and restored tabs from `tabs.json` will point at missing sessions.
- Treat the persisted `chat.json` and `tabs.json` as a coupled restore path: empty chat state with surviving chat tabs is usually a persistence-order bug in the chat store, not a tab-reconciliation bug in `MainContent`.
- `runtime/codexTurnTracker.ts` is the main smooth-streaming choke point. For Codex turns, prefer coalescing delta-driven `onUpdate` snapshots to at most one UI commit per animation frame instead of either suppressing deltas entirely or emitting one store update per token.
- `components/ChatMessages.tsx` performs best with hybrid virtualization: virtualize older history, but keep the newest tail and the active streaming turn mounted so `use-stick-to-bottom` behavior and streaming stability do not regress.
- In the virtualized chat timeline, row-height measurements are width-sensitive. Scope virtualizer measurement keys to timeline width and keep text/tool height estimates in sync with the rendered row types, or upward scrolling will jump when wrapped rows get measured.
