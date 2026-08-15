# ConsoleMessageProvider State Table

This document describes the state managed by `ConsoleMessageProvider` in `src/console/consoleMessageProvider.ts`.

## State dimensions

- `enabled` — whether `p5-server.editor.infoLens` is true.
- `hasConsoleMessages` — whether at least one console message is stored.
- `hasRuntimeErrors` — whether at least one runtime error is stored.

## Events

- `addMessage` — a browser console or runtime-error event is received.
- `removeMessages` — messages/errors are removed by `file` and/or `clientId`.
- `clear` — all stored state is cleared.
- `disable` — the `p5-server.editor.infoLens` setting changed to `false`.
- `enable` — the `p5-server.editor.infoLens` setting changed to `true`.

## Transitions

| enabled | hasConsoleMessages | hasRuntimeErrors | Event | Next enabled | Next hasConsoleMessages | Next hasRuntimeErrors | Side Effects |
|---|---|---|---|---|---|---|---|
| any | any | any | `disable` | false | false | false | Clear messages/errors; fire change event |
| false | false | false | `enable` | true | false | false | Fire change event |
| true | false | false | `addMessage` (console) | true | true | false | Store message; fire change event |
| true | true | false | `addMessage` (console, same location) | true | true | false | Update existing message count; fire change event |
| true | false | false | `addMessage` (error) | true | false | true | Publish diagnostic; fire change event |
| true | true | true | `addMessage` (console + error) | true | true | true | Store message and error independently; fire change event |
| true | true | false | `removeMessages` (by file) | true | false | false | Remove matching messages; fire change event |
| true | false | true | `removeMessages` (by file) | true | false | false | Remove matching errors; clear diagnostics; fire change event |
| true | true | true | `removeMessages` (by client) | true | * | * | Remove matching messages and errors; update diagnostics; fire change event |
| true | any | any | `clear` | true | false | false | Clear all messages/errors; clear diagnostics; fire change event |
| false | any | any | `addMessage` | false | false | false | No-op |

## Notes

- When `enabled` becomes `false`, all stored messages and errors are discarded and diagnostics are cleared.
- When `enabled` is `false`, incoming messages are ignored.
- `removeMessages` filters independently on `file` and `clientId`. If both are provided, only items matching both are removed.
- Console messages and runtime errors are keyed separately, so a console log and a runtime error on the same line do not overwrite each other.
- Change events are debounced (50 ms) to avoid excessive inlay-hint refreshes.
