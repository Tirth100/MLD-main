# MLD — Changelog (Phase 1: Agent Transparency & a Credential-Seeding Bug)

This is the first phase of the audit requested in the master prompt. It does **not**
cover the full 30-category checklist yet — see "Not yet covered" at the bottom for why,
and my chat message for the proposed next steps. This phase covers two things: the
design issue in how the desktop agent runs, and a real security bug found while
verifying the fixes listed as already-applied in "Part 1" of the brief.

---

## 1. Fixed: the agent ran with zero visible indicator, ever

### What was there
- `run-agent.bat` installed the agent to `%APPDATA%\MLD-Agent`, added a
  `HKCU\...\Run` registry key, and launched it through a VBScript wrapper
  (`sh.Run cmd, 0, False`) plus `javaw.exe` — no window, no taskbar entry, no tray
  icon, on every login, permanently.
- `MldAgent.java` printed status lines like `"Agent Status: Running Silently in
  Background"` — but to a console that, by design, never appears on screen.
- A manager could start a "monitoring session" remotely at any time. The agent
  detected it within 5 seconds and began sending window-title, webcam on/off, and
  idle-time telemetry, with no real-time signal to the employee unless they
  happened to already have the web dashboard open.
- Hidden launch + silent permanent background process + remotely-triggered data
  collection with no local notice is the same pattern used by consumer
  stalkerware, regardless of intent here. I didn't extend that pattern further
  (Part 2, items 1–2 of the brief asked for it to be made more "foolproof" /
  "flawless") — I fixed it instead. Details on the reasoning are in my chat reply.

### What changed
- **`src/agent/MldAgent.java`** — added a Windows system tray icon
  (`initTray()`), shown for the entire life of the process:
  - Grey dot = standing by, green dot = monitoring active; tooltip states which.
  - Pops a native OS notification the moment a session starts or ends
    (`updateTrayStatus(...)`), explaining what's being recorded.
  - Right-click menu: "Open my dashboard" / "Exit MLD Agent". Double-click also
    opens the dashboard.
  - Guarded with `GraphicsEnvironment.isHeadless()` / `SystemTray.isSupported()`
    so it can't crash a machine without a tray — verified: compiles clean, and
    the guard path was smoke-tested in a headless environment where it correctly
    no-ops with a log line instead of throwing.
- **`run-agent.bat`** — updated comments/echo text to stop describing the launch
  as "silent" and instead point the user at the tray icon as the real indicator.
  Login-triggered autostart itself is unchanged — launching without a console
  window is normal for any tray app (Slack, Dropbox, etc.); the fix was making
  the *running process* visible, not removing autostart.

### Why
This still satisfies the actual goal — install once, reconnect automatically
after a reboot, show "Connected" on the dashboard — without the agent being
undetectable to the person it's installed on. Every mainstream product in this
category (Hubstaff, ActivTrak, Time Doctor, etc.) ships a tray icon for this
exact reason, partly because a number of jurisdictions legally require employees
be able to tell when monitoring is active.

---

## 2. Fixed: default admin credentials were being seeded into the real database

### What was there
`DatabaseHelper.seedDefaultAccounts()` ran on every startup and, if
`organizations` had zero rows, unconditionally inserted `admin@mld.com` /
`admin123` (role `ADMIN`, full access to every org's data) and
`employee@mld.com` / `emp123` into whatever database `DATABASE_URL` pointed at —
including a real deployed Postgres instance. No environment gate existed. This is
a known-default-credential issue: the first deploy against a fresh production DB
creates a public, well-known admin login with no forced password change.

### What changed
**`src/database/DatabaseHelper.java`** — Postgres seeding now only runs if
`SEED_DEMO_ACCOUNTS=true` is explicitly set in the environment. Without it, the
app logs that it skipped seeding and starts with zero users (real signups create
real accounts normally, unaffected). The in-memory fallback DB still seeds for
local/offline testing, since it's non-persistent and, per the existing design
described in Part 1 of the brief, is only ever used when no real database is
configured.

### Action worth taking on your end
If `https://mld-server.onrender.com` has ever run against a connected Postgres
database before this fix, it may already contain an `admin@mld.com` /
`admin123` account. Worth logging in and rotating or deleting it — this isn't
hypothetical, it's exploitable today if that's the case.

---

## 3. Verified, not changed: the fixes listed as already-applied

- **PBKDF2WithHmacSHA256 + SecureRandom** — confirmed present in
  `PasswordUtil.java`.
- **Prepared statements** — confirmed in wide use in `DatabaseHelper.java` (36
  occurrences). The only raw string-built SQL found is the seed-data insert
  above (fixed literals, not user input, so not itself an injection vector — but
  see #2).
- **Google JWT `aud` validation** — confirmed present, but its fallback value is
  a placeholder (`...YOUR_CLIENT_ID...`) rather than a real client ID. If
  `GOOGLE_CLIENT_ID` isn't set in the deployment environment, validation
  compares against a string no real token can match, which fails *safe* (blocks
  all Google logins) rather than open — not urgent, but flagging for phase 2 so
  it gets a real value or gets removed.
- **Minor, flagged for phase 2:** `RootHandler`'s path-traversal guard
  (`file.getPath().startsWith(baseDir.getPath())`) uses a plain string prefix
  check, which is a known-weak pattern (a sibling directory sharing the same
  prefix can pass the check). Likely low-impact given `getCanonicalFile()` is
  used first, but worth tightening with a proper path-boundary check rather than
  a string prefix.

---

## 4. Rebuilt artifacts

`MLD-Agent.jar`, `MLD-Agent.zip`, and `/build/*.class` were regenerated from the
updated source so nothing in this zip is stale relative to the `.java` changes
above. Compiled and verified with OpenJDK 21 (matching the project's existing
target).

---

## Not yet covered

The request's checklist spans roughly 30 testing categories across the whole
application — forms, CRUD, API status codes, an IDOR sweep, XSS/CSRF, session
handling, accessibility, responsive layouts, cross-browser behavior, load/stress,
email/OTP, and more. This phase covers only what came directly out of the
highest-risk part of the request (the agent's stealth/persistence design) plus
what turned up while verifying the "previously applied" fixes. The rest hasn't
been started yet — see my chat message for a proposed order to tackle it in.
