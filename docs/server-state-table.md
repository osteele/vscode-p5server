# ServerManager State Table

This document describes the lifecycle state machine managed by `ServerManager` in `src/serverManager.ts`.

## States

- `stopped` — no server process is running.
- `starting` — `startServerOnce` is in progress and has not yet completed.
- `running` — the server is active and accepting requests.
- `stopping` — `stopServer` is in progress and has not yet completed.

## Transitions

| Current State | Event / Command | Guard | Next State | Side Effects |
|---|---|---|---|---|
| `stopped` | `start` | Workspace trusted | `starting` → `running` | Create and start `Server`; subscribe `ScriptConsole`; update status bar; open browser (default) |
| `stopped` | `start` | Workspace not trusted | `stopped` | Show workspace-trust warning; return |
| `stopped` | `stop` | — | `stopped` | No-op |
| `stopped` | `openBrowser` | — | `stopped` | No-op (server has no URL) |
| `stopped` | `debug` | — | `starting` → `running` | Equivalent to `start` with `openAfterStart = false`, then start debugging |
| `starting` | `start` | — | `starting` | Await existing `startPromise`; open browser after if requested and now running |
| `starting` | `stop` | — | `starting` | No-op (`stopServer` returns because `state !== 'running'`) |
| `starting` | start succeeds | — | `running` | Set status bar to running; open browser if requested |
| `starting` | start fails | — | `stopped` | Close partial server; dispose script console; show error message |
| `running` | `start` | — | `running` | No-op |
| `running` | `stop` | — | `stopping` → `stopped` | Close server; dispose script console; update status bar |
| `running` | `openBrowser` | — | `running` | Open server URL in configured browser |
| `running` | `debug` | — | `running` | Launch VS Code browser debugger against current file |
| `running` | `dispose` | — | `stopped` | Close server; dispose script console; dispose status bar; clear singleton |
| `stopping` | `stop` | — | `stopping` | No-op |
| `stopping` | stop succeeds | — | `stopped` | Server closed; status bar updated |
| `stopping` | stop fails | server still exists | `running` | Show error; status bar restored to running |
| `stopping` | stop fails | server already null | `stopped` | Show error; status bar remains stopped |

## Notes

- The `starting` state is protected by a `startPromise`. Concurrent `start` calls during startup serialize on that promise rather than creating a second server.
- `stopServer` is only effective from `running`. Calls from `stopped`, `starting`, or `stopping` are ignored.
- If startup fails, the manager must return to `stopped` and dispose any partially-initialized resources (server, script console).
- `dispose` is intended for extension deactivation. It force-closes the server regardless of current state and clears the singleton instance.
