# Desktop Pivot Plan

## Target Direction

ZBroadcast is pivoting from a web-app-first overlay system into a desktop-first broadcast control app.

The target product should launch like a normal PC program. A caster or producer should be able to open ZBroadcast from the desktop, Start Menu, taskbar, or an installed application shortcut without thinking about Node commands, ports, or browser paths first.

The first app window should open to a Caster Command dashboard/main menu. That dashboard should become the primary operator home for creating or opening a broadcast session, managing match state, launching control surfaces, copying or opening OBS overlay outputs, and eventually managing remote operators.

The current web overlay system is still valuable. The pivot should preserve the existing scoreboard and overlay logic where useful instead of rebuilding everything at once.

Remote rooms and remote operators should remain part of the future architecture, but they should not be the immediate foundation of the desktop pivot. The immediate foundation should be a reliable local desktop app for one production machine.

## Product Shape

Near-term desktop app goals:

- Launch as a normal Windows desktop app.
- Open first to a Caster Command dashboard/main menu.
- Make local operation obvious without requiring manual URL entry.
- Keep OBS output available as a browser-source URL or packaged local overlay view.
- Keep existing scoreboard, overlay delay, room state, assets, rosters, history, and undo behavior available during the transition.
- Avoid breaking the working Node/Express/Socket.IO prototype while the desktop shell is introduced.

Longer-term desktop app goals:

- Manage multiple broadcast profiles or events.
- Provide local persistent storage for sessions, teams, assets, and defaults.
- Launch or expose overlay outputs cleanly for OBS.
- Support remote operators later through explicit hosted, LAN, or relay architecture.
- Separate operator workflows from transport details.

## Current App Areas

### Likely Stay

- Core scoreboard state model: blue/orange names, scores, series score, series type, and wins required.
- Goal, undo goal, game winner, series winner, reset, swap teams, full reset, history, and undo-last-action concepts.
- OBS browser-source overlay output.
- Socket.IO-style real-time update model, at least internally during the transition.
- Server-side/shared asset model for overlay backgrounds and team logos.
- Room-scoped state concept, but as a future-friendly boundary rather than the first desktop UX.
- Overlay delay and instant update behavior.
- Roster and substitute concepts.
- Timing comparison concept.
- Blue/orange visual convention.

### Likely Pause

- Building remote rooms/operators as the main architecture driver.
- Public deployment hardening beyond preserving current safety warnings.
- Multi-room product UX as the first desktop screen.
- OCR/timer automation research.
- Large-scale UI rewrite of the existing control page before the desktop shell exists.
- Database design, unless needed for a small local persistence step.

### Likely Change

- The app entry point should change from "open a browser URL" to "launch ZBroadcast."
- The first user-facing screen should become Caster Command, not the current room control page.
- Local server startup should be hidden behind the desktop app.
- URLs and ports should become implementation details, not the primary operator workflow.
- Room selection should become session/profile selection in the desktop UI.
- Admin password behavior should be reconsidered for local desktop use. A local app may not need the same prompt-first control flow, but remote control still will.
- Asset storage should move toward an app-owned writable data directory instead of source-controlled `public/overlay-assets/`.
- Browser `localStorage` settings should eventually become app settings or profile settings.
- Current single-file HTML pages should eventually be split or wrapped behind clearer modules, but only after behavior is protected.

### Likely Replace

- Manual command-line startup as the normal operator path.
- Browser prompt as the primary admin-login experience for local control.
- Treating `server.js` as both prototype server and long-term desktop application core.
- In-memory-only match state if desktop sessions need persistence across app restarts.
- Public web deployment assumptions as the default mental model for local productions.

## Preservation Rules During The Pivot

- Do not break existing OBS overlay URLs until replacement URLs are proven.
- Do not remove room routes while the overlay depends on them.
- Do not remove Socket.IO state sync until the desktop replacement path is working.
- Do not change scoreboard semantics casually during shell work.
- Do not replace asset upload/storage behavior until there is a tested desktop-safe storage path.
- Keep migration steps small and reviewable.
- Prefer adding a desktop shell around the current working core before extracting or rewriting internals.

## Phased Migration Plan

### Phase 0: Documentation And Baseline

Goal: Freeze the current understanding before changing architecture.

Small steps:

1. Keep `CURRENT_STATE.md` up to date as the baseline reference.
2. Keep this pivot plan current as product direction changes.
3. Add a short manual smoke-test checklist before code changes begin.
4. Identify current routes, events, state fields, and asset paths that must remain compatible.

Exit criteria:

- The current app behavior is documented.
- The desktop direction is documented.
- The working web overlay path is treated as the regression baseline.

### Phase 1: Local Desktop Shell Prototype

Goal: Launch the existing app through a normal desktop wrapper with minimal behavior changes.

Small steps:

1. Choose a conservative desktop shell approach, likely Electron or a similar wrapper that can host the existing local web app.
2. Add a desktop entry process that starts or embeds the existing server locally.
3. Open the first window to a new Caster Command dashboard.
4. From Caster Command, provide links/buttons into the existing default control page and overlay URL.
5. Keep the current browser URLs working.

Exit criteria:

- A user can launch ZBroadcast as a desktop app.
- The existing control and overlay pages still work.
- OBS can still load an overlay output.
- No scoreboard behavior changes are introduced by the shell.

### Phase 2: Caster Command Dashboard

Goal: Make the first window useful without replacing the control page yet.

Small steps:

1. Add a dashboard view with clear actions: Open Control, Copy OBS Overlay URL, Open Overlay Preview, and Manage Local Session.
2. Show current room/session name and server status.
3. Keep one default local session as the primary path.
4. Avoid exposing multi-room complexity as the main workflow.
5. Add lightweight app settings only where needed for desktop launch and operator convenience.

Exit criteria:

- The desktop app starts on Caster Command.
- A caster can reach the current production tools from the dashboard.
- The dashboard reduces reliance on memorized URLs.

### Phase 3: Local Persistence And Asset Location

Goal: Make desktop sessions survive normal app restarts.

Small steps:

1. Move writable assets toward an app data directory while preserving served URLs.
2. Persist current room/session state to a local file or small local database.
3. Persist operator settings outside browser `localStorage` where practical.
4. Add migration or fallback logic for existing `public/overlay-assets/` files.
5. Keep state persistence narrow: match/session state first, not a full account system.

Exit criteria:

- Closing and reopening the desktop app can restore useful local state.
- Uploaded overlay and logo assets are stored in a desktop-safe writable location.
- Existing OBS output remains stable.

### Phase 4: Gradual Control UI Integration

Goal: Bring operator workflows into the desktop app without a risky rewrite.

Small steps:

1. Keep the existing control page available as the fallback.
2. Move dashboard-level workflows first, not all match controls.
3. Extract duplicated state or event knowledge only when a desktop control needs it.
4. Add tests or smoke checks around score, series, undo, overlay delay, queued update, instant update, and reset behavior before deeper edits.
5. Consider splitting current large HTML files only after behavior is protected.

Exit criteria:

- Caster Command can own more of the operator workflow.
- The legacy control page remains available during transition.
- Core live-production behavior remains unchanged.

### Phase 5: Future Remote Architecture

Goal: Reintroduce remote rooms/operators deliberately after the local desktop app is stable.

Small steps:

1. Decide whether remote control means LAN, hosted server, relay service, or peer-assisted connection.
2. Keep room IDs and roles as useful concepts, but do not force the desktop UX to look like a web admin panel.
3. Replace the single shared admin password with a more appropriate remote access model.
4. Add explicit operator invites or session codes.
5. Harden upload routes, authentication, transport security, and persistence before public use.

Exit criteria:

- Remote operation has a defined security and hosting model.
- Local desktop operation remains simple.
- Remote rooms/operators extend the desktop app instead of dictating its first-run experience.

## Suggested First Desktop Milestone

The first practical milestone should be:

```text
Launch ZBroadcast -> Caster Command opens -> existing local server is running -> buttons open/copy the existing control and overlay URLs.
```

This milestone is intentionally small. It proves the desktop-first direction without disturbing the working overlay system.

## Caster Command Dashboard Draft

Initial dashboard sections:

- Current Session: default local broadcast session name and status.
- Production Controls: open the existing control page.
- OBS Output: copy overlay URL and open overlay preview.
- Assets: shortcut into existing overlay/logo upload workflow.
- Settings: app startup, port, and local storage location later.
- Future Remote: visibly reserved but not required for first use.

The dashboard should not start as a marketing landing page. It should be an operational main menu for a caster preparing or running a broadcast.

## Compatibility Notes

- OBS may still prefer a browser-source URL even when the control app is desktop-first.
- The desktop app can hide startup complexity while still using an internal local server.
- Existing web pages can be embedded, opened in app windows, or opened externally during early phases.
- Room IDs can remain under the hood as session IDs.
- The current server can be treated as the compatibility core until a cleaner application core is extracted.

## Risks To Manage

- Rewriting the control page too early could break live-production behavior.
- Moving assets too early could break OBS background/logo loading.
- Removing room concepts too early could block future remote support.
- Keeping everything in `server.js` forever will make the desktop app harder to maintain.
- Adding persistence without clear ownership could create mismatches between memory, files, and UI.
- Desktop packaging may require careful handling of writable paths, ports, process startup, and shutdown.

## Recommended Next Safe Steps

1. Add a smoke-test checklist for the current web app.
2. Decide on the desktop wrapper technology.
3. Prototype the smallest possible desktop launcher around the existing server.
4. Add a minimal Caster Command dashboard that links to the existing tools.
5. Verify OBS still renders the overlay exactly as before.
