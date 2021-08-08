# Development Docs

## Local Install

```sh
npm run package
code --install-extension $(ls *.vsix|tail -1)
```

## Screenshot

```sh
code ../p5-server/p5-server/examples
```

```sh
osascript <<'END'
tell application "Visual Studio Code"
    set bounds of front window to {20, 100, 870, 450}
end tell
END
```
