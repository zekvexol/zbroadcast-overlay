# Current State

## Project Structure

```text
ZBroadcast_Overlay/
  .gitignore
  package.json
  package-lock.json
  server.js
  docs/
    ProjectHistorySummaries.txt
    CURRENT_STATE.md
    DESKTOP_PIVOT_PLAN.md
  public/
    control.html
    overlay.html
    overlay-assets/        # Created at runtime when assets are uploaded
  node_modules/            # Local installed dependencies
```

The repository is currently a compact Node.js web app. The server owns match state and uploaded assets. The browser control page sends operator actions to the server. The browser overlay page receives state updates and renders the broadcast overlay for OBS.

## Current Files

### `server.js`

Runs the Express and Socket.IO server.

Current responsibilities:

- Serves static files from `public/`.
- Redirects legacy `/control.html` and `/overlay.html` URLs into the default room routes.
- Serves room-specific pages at `/room/:roomId/control` and `/room/:roomId/overlay`.
- Holds in-memory room state for each room ID.
- Validates room IDs with a conservative alphanumeric, underscore, and dash allowlist.
- Requires an admin password for control sockets through `ADMIN_PASSWORD`.
- Allows overlay sockets to join without an admin password.
- Stores uploaded PNG assets under `public/overlay-assets/:roomId/`.
- Supports upload and clear routes for overlay background, blue logo, and orange logo assets.
- Broadcasts authoritative room state over Socket.IO.
- Tracks game score, series score, match metadata, rosters, substitute fields, team logos, overlay delay, timing display state, history, and undo snapshots.
- Supports queued display-info updates and instant display-info updates.
- Emits overlay-specific events such as `instantOverlayState` and `overlayQueueReset` to keep delayed overlay queues coherent.

Main HTTP routes:

- `GET /control.html` redirects to `/room/default-room/control`.
- `GET /overlay.html` redirects to `/room/default-room/overlay`.
- `GET /room/:roomId/control` serves the control UI.
- `GET /room/:roomId/overlay` serves the overlay UI.
- `POST /api/room/:roomId/upload-overlay` stores a PNG overlay background.
- `POST /api/room/:roomId/clear-overlay` removes the room overlay background.
- `POST /api/room/:roomId/upload-blue-logo` stores a PNG blue-team logo.
- `POST /api/room/:roomId/clear-blue-logo` removes the blue-team logo file.
- `POST /api/room/:roomId/upload-orange-logo` stores a PNG orange-team logo.
- `POST /api/room/:roomId/clear-orange-logo` removes the orange-team logo file.

Main Socket.IO events:

- `joinRoom`
- `updateDisplayInfoQueued`
- `updateDisplayInfoInstant`
- `blueGoal`
- `orangeGoal`
- `undoBlueGoal`
- `undoOrangeGoal`
- `resetGame`
- `blueSeriesWin`
- `orangeSeriesWin`
- `undoBlueSeries`
- `undoOrangeSeries`
- `blueWins`
- `orangeWins`
- `setOverlayDelay`
- `startTimingDisplay`
- `stopTimingDisplay`
- `resetTimingDisplay`
- `resetSeries`
- `swapTeams`
- `fullReset`
- `undoLastAction`

### `public/control.html`

The operator-facing control interface.

Current responsibilities:

- Determines the current room ID from the URL path.
- Prompts for the admin password and stores it in `sessionStorage` for that room.
- Joins the Socket.IO room as `admin`.
- Shows the room ID and overlay URL.
- Provides controls for team names, league/match metadata, series type, active rosters, substitute players, logos, and overlay background image.
- Sends match info either as queued overlay updates or instant overlay updates.
- Provides blue/orange score controls, undo goal controls, series win controls, undo series controls, game win controls, reset controls, team swap, full reset, and undo last action.
- Supports a configurable overlay delay.
- Supports a timing comparison display with start, stop, and reset controls.
- Shows live game number, game score, series score, current team names, uploaded-logo previews, overlay-asset status, and match history.
- Provides configurable hotkeys saved in browser `localStorage`.
- Avoids firing hotkeys while the operator is typing in form fields.
- Uploads PNG overlay/background and team logo files to the server using `fetch` and `FormData`.

### `public/overlay.html`

The OBS/browser-source overlay output.

Current responsibilities:

- Determines the current room ID from the URL path.
- Joins the Socket.IO room as `overlay`.
- Renders a fixed 1920x1080 transparent overlay surface.
- Displays optional server-stored overlay background image.
- Displays top match metadata when present.
- Displays blue and orange team names, scores, logos, and series pips.
- Renders orange pips in reverse direction for visual balance.
- Displays active-player roster stacks when roster fields are populated.
- Shrinks roster text when needed to fit within its visual containers.
- Displays the timing comparison panel when timing state is running or stopped with an elapsed value.
- Applies overlay delay by scheduling incoming `stateUpdate` payloads.
- Applies instant display-info updates immediately and purges older delayed display-info state where needed.
- Clears scheduled overlay states when reset events require the queue to be rebuilt.

### `package.json`

Defines the Node project metadata, `npm start` script, and runtime dependencies.

Current dependencies:

- `express`
- `socket.io`
- `multer`

### `package-lock.json`

Locks the exact installed dependency tree for reproducible npm installs.

### `.gitignore`

Currently ignores local dependency and runtime-output style files as configured for this repo.

### `docs/ProjectHistorySummaries.txt`

Historical project notes from earlier design and development conversations. It is useful context, but parts of it are older than the current code.

### `node_modules/`

Local dependency install folder. It is not application source and should not be edited manually.

### `public/overlay-assets/`

Runtime asset storage created and used by the server. Uploaded room assets are expected to live under room-specific folders such as:

```text
public/overlay-assets/default-room/overlay.png
public/overlay-assets/default-room/blue-logo.png
public/overlay-assets/default-room/orange-logo.png
```

The code serves those files through `/overlay-assets/...` URLs with cache-busting query strings.

## Current Tech Stack

- Node.js
- npm
- Express 4
- Socket.IO 4
- Multer
- HTML
- CSS
- Browser JavaScript
- OBS Browser Source
- Local filesystem asset storage
- Browser `localStorage` for operator hotkey/settings preferences
- Browser `sessionStorage` for room admin password entry during a session

## Features That Already Work

- Local web server launched with `npm start`.
- Room-based control and overlay pages.
- Default room redirects for old `/control.html` and `/overlay.html` links.
- Real-time state sync from control page to overlay page.
- Admin-gated control socket role.
- Read-only overlay socket role.
- Blue and orange team names.
- Blue and orange game scores.
- Blue and orange series scores.
- Best-of selection with calculated wins required for Bo1, Bo2, Bo3, Bo5, and Bo7.
- Score increment and decrement.
- Series increment and decrement.
- Marking blue or orange as game winner, pushing history, advancing series, and resetting the current game score.
- Reset current game.
- Reset series and history.
- Full reset while preserving the uploaded overlay background path.
- Undo last action from server-side undo snapshots.
- Swap team names, logos, rosters, and subs between blue and orange.
- Match metadata fields for league name, week/round, and series info.
- Roster fields for three active players and two substitutes per team.
- Click-based active/substitute roster swapping in the control UI.
- Server-side PNG upload for overlay background images.
- Server-side PNG upload for blue and orange team logos.
- Overlay display of uploaded background and logos.
- Match history rendering in the control page.
- Overlay delay for delayed broadcast output.
- Queued and instant match-info updates.
- Overlay queue reset handling for full reset and undo.
- Optional timing comparison panel.
- Configurable hotkeys persisted in the operator browser.
- Hotkey suppression while typing.
- OBS-compatible overlay page with transparent body and fixed 1920x1080 canvas.

## Features That Must Be Preserved

- OBS Browser Source compatibility.
- Stable room URLs, especially `/room/:roomId/control` and `/room/:roomId/overlay`.
- Legacy redirects for `/control.html` and `/overlay.html` unless intentionally deprecated later.
- Blue/orange side conventions.
- Fast score changes over Socket.IO.
- Manual operator workflow for goals, game winners, series wins, resets, and undo.
- Series pips and reverse orange pip direction.
- Server-side shared assets instead of browser-only overlay asset storage.
- Room-scoped overlay backgrounds and team logos.
- Admin password gating for the control role.
- Overlay access without operator controls.
- Overlay delay and instant-update behavior.
- Undo/history behavior that operators rely on during live production.
- Hotkeys that do not trigger while typing.
- Current match metadata, roster, logo, and timing-display concepts.

## Known Risks And Fragile Areas

- Room state is in memory only. Restarting the Node process resets match state, undo stacks, and history.
- Uploaded PNG files persist on disk, but the relationship between persistent files and in-memory state is rebuilt only through default-state file checks.
- There is no database or durable state store.
- Admin authentication is a single shared password, and the default value is intentionally unsafe for public deployment.
- Upload routes are not independently authenticated by HTTP middleware; they rely on obscurity of local/private use rather than a verified admin session.
- Only PNG uploads are accepted. That is simple and OBS-safe, but may surprise users with JPEG/WebP assets.
- File uploads use synchronous filesystem writes and deletes.
- Overlay timing uses client/server wall-clock assumptions and browser timers, not a production-grade synchronized clock.
- Delayed overlay queue logic is more complex than the base scoreboard flow and should be treated carefully.
- Undo snapshots clone whole room state through JSON serialization. This is simple, but it can become heavy if state grows.
- The server stores all active rooms in a plain object with no cleanup lifecycle.
- `fullReset` preserves the overlay background path but resets other state to defaults; this behavior should be reviewed before changing reset semantics.
- Logo clear functions in the control UI clear pending logo paths locally; server clear routes exist, but the current UI flow should be checked carefully before relying on disk cleanup behavior.
- The current UI is a single large HTML file for control and a single large HTML file for overlay. This is workable now, but fragile as the app grows.
- Browser storage keeps operator settings local to one browser profile. Different operators/devices may have different hotkeys and settings.
- The overlay is fixed at 1920x1080 and assumes OBS/browser-source usage at that resolution.

## Deployment And Local Run Assumptions

- The app is expected to run with Node.js installed.
- Dependencies are installed with npm.
- The normal local command is:

```bash
npm start
```

- The server listens on `process.env.PORT` or port `3000`.
- Local default control URL:

```text
http://localhost:3000/room/default-room/control
```

- Local default overlay URL:

```text
http://localhost:3000/room/default-room/overlay
```

- Legacy local URLs redirect to the default room:

```text
http://localhost:3000/control.html
http://localhost:3000/overlay.html
```

- The overlay URL is intended to be loaded into OBS as a Browser Source.
- For any public or remote deployment, `ADMIN_PASSWORD` must be set to a real secret before launch.
- The server process needs filesystem write access to `public/overlay-assets/`.
- Uploaded room assets are stored locally on the server machine. Moving to a hosted or packaged desktop app should preserve an equivalent writable asset location.
