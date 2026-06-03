# Tools

This directory contains all 88 MCP tool definitions for the Google Docs, Sheets, Drive, Forms, and Gmail server. Tools are organized into domain-specific folders, each with its own router (`index.ts`) that registers its tools with the server.

## Architecture

```
tools/
├── index.ts       # Top-level router — delegates to each domain
├── docs/          # Google Docs API operations
├── drive/         # Google Drive file and folder management
├── forms/         # Google Forms creation, editing, publishing, and responses
├── gmail/         # Gmail message and draft operations
├── sheets/        # Google Sheets operations
└── utils/         # Cross-cutting workflow utilities
```

Each domain folder contains:

- **`index.ts`** — A router that registers all tools in the domain
- **`README.md`** — Documentation of the domain and its tools
- **Individual tool files** — One file per tool, each exporting a `register(server)` function

## Domains

| Domain              | Tools | Description                                                      |
| ------------------- | ----: | ---------------------------------------------------------------- |
| [docs](./docs/)     |    19 | Read, write, format, and comment on Google Documents             |
| [drive](./drive/)   |    12 | Search, create, move, copy, rename, and delete files and folders |
| [forms](./forms/)   |     8 | Create, edit, publish, and read responses from Google Forms      |
| [gmail](./gmail/)   |    17 | List, read, draft, label, and send Gmail messages                |
| [sheets](./sheets/) |    30 | Read, write, append, format, validate, and manage spreadsheets   |
| [utils](./utils/)   |     2 | Markdown conversion and other cross-cutting workflows            |

## Adding a New Tool

1. Create a new file in the appropriate domain folder (e.g., `docs/myNewTool.ts`)
2. Export a `register(server: FastMCP)` function that calls `server.addTool({...})`
3. Import and call it from the domain's `index.ts` router
