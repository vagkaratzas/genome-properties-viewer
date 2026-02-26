# Project Memory

## Known side effects of running the dev environment

Running `npm install` + `npm run serve` for the first time, may update three tracked files:
- **`package-lock.json`** — npm rewrote it in a newer lockfile schema (v3) with a flattened dependency tree.
- **`bin/d3.custom.min.js`** and **`bin/d3.custom.min.js.map`** — rollup rebuilt the bundle with the locally installed Babel/rollup versions, producing different output than what was committed.

## Running the dev environment

1. If `node_modules/` is missing, install deps first (node comes from nvm, available in base conda env):
   ```
   npm install
   ```
2. Start the dev server (rollup watch + browser-sync):
   ```
   npm run serve
   ```
3. Viewer is available at **http://localhost:3000**. Browser-sync UI at http://localhost:3001.
   Rollup watches `index.js` and rebuilds `bin/d3.custom.min.js` on changes; browser-sync auto-reloads on `bin/*.*` changes.
