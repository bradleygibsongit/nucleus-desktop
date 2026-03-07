# Nucleus Desktop

Desktop AI agent app with Tauri + React.

## Project Overview

This project is being built in phases:

1. **Phase 1 (Current)**: UI shell with Tauri + React
2. **Phase 2**: Agent runtime integration
3. **Phase 3**: Migrate UI components from Codex-interface project

## Commands

```bash
bun run dev                # Run Vite dev server
bun run tauri:dev          # Run Tauri app
bun run cli "prompt"       # Run OpenCode CLI (streams by default)
bun run cli "prompt" --stream-tools  # Stream tool activity
bun run cli "prompt" --raw-only      # Only show raw response
bun run cli "prompt" --json-only     # Only show raw JSON
bun run typecheck          # TypeScript type checking
```

## Architecture

### Current (Phase 1 - UI shell)
```
nucleus-desktop/
├── src/                   # React UI shell
├── src-tauri/             # Tauri backend
├── package.json
├── tsconfig.json
└── MIGRATION.md           # Detailed migration plan
```

### Target (Phase 2+)
```
nucleus-desktop/
├── src/
│   ├── main.ts            # Tauri main process
│   ├── agent/             # Agent runtime integration (TBD)
│   └── features/          # UI features (migrated from Codex-interface)
│       ├── chat/          # Chat UI components
│       └── shared/        # Shared UI components
├── src-tauri/             # Tauri Rust backend (minimal)
└── ...
```

## Key Dependencies

- `bun` - JavaScript runtime and package manager
- `@tauri-apps/cli` - Tauri app tooling
- `@opencode-ai/sdk` - OpenCode SDK

## UI Migration Notes

The UI from `Codex-interface` project will be migrated here. Key components to bring over:

- `ChatMessages.tsx` - Message rendering with AgentActivity
- `AgentActivity.tsx` - Collapsible activity panel
- `AgentActivityTool.tsx` - Tool call cards
- `ai-elements/` - Message, Conversation, Loader components
- `shared/components/ui/` - Button, Input, Dialog, etc.

These components have already been decoupled from the old ACP implementation and use local types compatible with a future agent runtime.

## Development Guidelines

- Use Bun instead of Node.js
- Use ESM modules (`type: "module"`)
- TypeScript strict mode enabled
- No Vite - use Bun's built-in bundler when adding frontend

## Integration Learnings

- The current chat runtime is still OpenCode-shaped end-to-end: Tauri starts `opencode serve --port 4096` in `src-tauri/src/lib.rs`, and the React chat store talks to it through `@opencode-ai/sdk/client` plus the global event stream in `src/features/chat/store/chatStore.ts`.
- If adding multiple agent harnesses (OpenCode, Codex, Claude Code), keep orchestration out of this app and introduce a thin per-harness adapter that maps each provider into shared UI-local thread/message/tool/subagent types before data reaches hooks or components.
- Codex is not a drop-in replacement for the OpenCode client. The closest fit is Codex App Server, which uses JSON-RPC `thread/*` and `turn/*` events instead of OpenCode's REST/SSE shape; prefer generating version-matched bindings with `codex app-server generate-ts` rather than hand-rolling protocol types.
