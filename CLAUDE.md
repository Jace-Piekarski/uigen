# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # Install deps + generate Prisma client + run migrations
npm run dev            # Start dev server (Turbopack) at http://localhost:3000
npm run build          # Production build
npm run lint           # ESLint
npm test               # Run all tests (Vitest + jsdom)
npx vitest run src/path/to/file.test.ts  # Run a single test file
npm run db:reset       # Reset and re-run all migrations (destructive)
npx prisma migrate dev # Apply pending migrations
npx prisma generate    # Regenerate Prisma client after schema changes
```

The dev command requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already included in the npm script) due to a Node.js compatibility shim.

## Architecture

### High-level flow

User sends a chat message → `/api/chat` streams a response using Vercel AI SDK → Claude calls tools (`str_replace_editor`, `file_manager`) to write files into a **VirtualFileSystem** → tool calls are mirrored client-side via `handleToolCall` in `FileSystemContext` → `PreviewFrame` transpiles the virtual files on the fly using Babel and renders them in an iframe via ES module import maps.

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` is an in-memory tree of `FileNode` objects. All generated code lives here; nothing is written to disk. It serializes/deserializes to a plain `Record<string, FileNode>` for persistence in the database (`Project.data` column, stored as JSON string).

### AI tooling

The API route (`src/app/api/chat/route.ts`) gives the model two tools:
- `str_replace_editor` — create/str_replace/insert operations on VFS paths
- `file_manager` — rename/delete operations on VFS paths

When no `ANTHROPIC_API_KEY` is set, `getLanguageModel()` (`src/lib/provider.ts`) returns `MockLanguageModel`, which streams canned counter/card/form components for demo purposes. With a key it uses `claude-haiku-4-5`.

### Preview rendering

`src/components/preview/PreviewFrame.tsx` reads files from `FileSystemContext`, calls `createImportMap()` (`src/lib/transform/jsx-transformer.ts`) to:
1. Transpile every `.js/.jsx/.ts/.tsx` file via `@babel/standalone`
2. Create blob URLs for each transpiled file
3. Build an ES module import map (third-party packages resolve to `esm.sh`, `@/` aliases are resolved)
4. Inject Tailwind CSS CDN + collected CSS file contents
5. Write the resulting HTML into an iframe via `srcdoc`

The entry point is always `/App.jsx` when present, otherwise the first root-level file.

### Client state

Two React contexts wrap the entire app (`src/app/main-content.tsx`):
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) — owns the `VirtualFileSystem` instance; exposes CRUD helpers and `handleToolCall` which applies incoming AI tool calls to the VFS
- `ChatProvider` (`src/lib/contexts/chat-context.tsx`) — owns chat history; calls `/api/chat` and pipes tool call events to `FileSystemContext.handleToolCall`

### Auth & persistence

JWT sessions via `jose`, stored in an `httpOnly` cookie (`auth-token`, 7-day expiry). `src/lib/auth.ts` is `server-only`. Anonymous users can use the app freely; their work is tracked in `sessionStorage` via `src/lib/anon-work-tracker.ts`. On sign-up/sign-in the anon work is promoted to a named project.

Projects are stored in SQLite (Prisma). `Project.messages` and `Project.data` are JSON strings. Prisma client is generated to `src/generated/prisma/`.

### Routing

- `/` — new session (no project)
- `/[projectId]` — loads an existing project for authenticated users

Middleware (`src/middleware.ts`) only protects `/api/projects` and `/api/filesystem`; `/api/chat` is open.
