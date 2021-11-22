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
    set bounds of front window to {20, 100, 870, 500}
end tell
END
```

## Publish

```sh
npm run publish
```

Note that this is not `npm publish`, which would try to publish the npm package to the npm package registry.
