# Shared camera extraction — Phase 1

## Scope

Move `src/features/gallery/components/CameraOverlayPage.vue` to `src/shared/components/CameraOverlay.vue`, content byte-identical, and repoint its one consumer plus two stale doc references.
Gallery behaviour, appearance, compression and upload unchanged.

## Decisions (fixed — do not re-decide during execution)

```
target path      = src/shared/components/CameraOverlay.vue
target name      = CameraOverlay          # SFC name is inferred from filename; "Page" is reserved for route components
file content     = byte-identical to the pre-move file, zero edits inside it
consumer edit    = src/features/gallery/pages/OrderGalleryPage.vue lines 7 and 351 only
props/emits      = unchanged: prop `open`, emits `close` and `capture(file, { skipCompression: true })`
imports inside   = unchanged: `vue`, `@/utils/imageCompression`   # `@` -> src/, still resolves from src/shared/
strings inside   = unchanged, byte for byte, Thai aria-labels included
barrel/index     = none created
git writes       = none, by any agent
```

## Agent roster (from `.codex/agents/`)

```
explorer            -> stage 0   read-only
ui-builder          -> stage 1   workspace-write
frontend-reviewer   -> stage 3   read-only, sign-off
frontend-architect  -> NOT INVOKED   # placement is fixed above
frontend-designer   -> NOT INVOKED   # no design decision exists; its own definition says stop on a refactor
frontend-integrator -> NOT INVOKED   # no API/state/auth/routing wiring
```

```
GAP: no agent in .codex/agents/ can drive a browser.
 L stage 2 is dispatched by the orchestrating Claude via the `frontend-test` skill, not by a .codex/agents/ agent
 L stage 2 is NOT optional and NOT substitutable by an agent review
```

## Flow

```
runPhase1() -> Accepted | Blocked
 L stage0_preflight(explorer) -> Preflight            # blocks stage 1
 L stage1_move(ui-builder, Preflight) -> MoveReport   # blocks stage 2
 L stage2_browserProof(frontend-test skill) -> BrowserReport   # blocks stage 3
 L stage3_review(frontend-reviewer, MoveReport, BrowserReport) -> APPROVED | CHANGES_REQUIRED | BLOCKED
 L if APPROVED -> Accepted                            # frontend-reviewer is the sign-off
   else -> fixLoop()
 L nothing runs in parallel                           # every stage touches the same files
```

## Functions

```
stage0_preflight(agent: explorer, sandbox: read-only) -> Preflight
 L ls src/shared/components/ src/shared/layouts/      # record actual contents, do not trust this doc
 L grep -rn "CameraOverlayPage" src/ tests/ docs/ --exclude-dir=plans
    L record every hit with file:line                 # docs/plans/ is excluded: this plan quotes the old name on purpose
 L sed -n '18p' src/App.vue                           # record the KeepAlive exclude array verbatim
 L assert "CameraOverlayPage" not in that array
 L assert "OrderGalleryPage" not in that array
 L test -f src/utils/imageCompression.js
 L test ! -e src/shared/components/CameraOverlay.vue
 L git status --porcelain | sort                       # print it; write no file, the sandbox is read-only
    L this output is `baseline`; it may be non-empty, it is a snapshot, not a cleanliness gate
 L return Preflight { sharedListing, hitList, excludeArray, baseline }
    L `baseline` is carried as literal text in the report, never as a file in the repo
 L report only these facts, no recommendation, no next step
```

```
stage1_move(agent: ui-builder, sandbox: workspace-write, input: Preflight) -> MoveReport
 L run this stage exactly once, in round 1 only                # rounds 2+ use stage1_fix
 L if "CameraOverlayPage" in Preflight.excludeArray -> report BLOCKED, stop
 L if src/shared/components/CameraOverlay.vue already exists -> report BLOCKED, stop
 L cp src/features/gallery/components/CameraOverlayPage.vue src/shared/components/CameraOverlay.vue
    L make no edit of any kind inside the copy
 L rm src/features/gallery/components/CameraOverlayPage.vue   # plain rm, never `git rm`
 L edit src/features/gallery/pages/OrderGalleryPage.vue
    L line 7:   import CameraOverlay from '@/shared/components/CameraOverlay.vue'
    L line 351: <CameraOverlay                        # opening tag only; the self-closing `/>` at 355 is untouched
    L nothing else in this file changes
 L edit docs/frontend-layout-nav-refactor.md line 138
    L replace the token `CameraOverlayPage` with `CameraOverlay`, rest of the line untouched
 L edit docs/features/orders/forms/create-order-image.md line 63
    L replace `src/features/gallery/components/CameraOverlayPage.vue` with `src/shared/components/CameraOverlay.vue`, rest of the line untouched
 L edit no other doc, ever                            # docs/plans/ in particular is never rewritten
 L verifyMove(Preflight)
 L return MoveReport { filesChanged, verifyOutputs, buildExitCode, baseline, unverified }
    L echo `baseline` back verbatim so the next round has it
 L do not run any git command that writes: no add, commit, checkout, branch, rm, stash
```

```
stage1_fix(agent: ui-builder, sandbox: workspace-write, input: findings + Preflight) -> MoveReport
 L used in fixLoop rounds 2+ instead of stage1_move
 L do not cp and do not rm; the move already happened      # the source file no longer exists
 L edit in place only the files named in `findings`
 L verifyMove(Preflight)                                   # same `baseline` text, every round
 L return MoveReport
```

```
verifyMove(Preflight) -> void                          private, run by ui-builder before reporting
 L run under bash: `git show HEAD:src/features/gallery/components/CameraOverlayPage.vue | diff --strip-trailing-cr -q - src/shared/components/CameraOverlay.vue`
    L assert exit 0 and no output                      # proves the content is byte-identical
    L `--strip-trailing-cr` is required because Windows working-tree CRLF differs from the LF-normalized git blob; PowerShell's `diff` is a `Compare-Object` alias
 L grep -rn "CameraOverlayPage" src/ tests/
    L assert 0 hits
 L grep -rn "CameraOverlayPage" docs/ --exclude-dir=plans
    L assert 0 hits
 L grep -rn "features/gallery/components" src/ tests/
    L assert 0 hits
 L grep -n "CameraOverlay" src/features/gallery/pages/OrderGalleryPage.vue
    L assert exactly 2 hits, at lines 7 and 351
 L write Preflight.baseline verbatim to <scratchpad>/baseline.txt   # outside the repo; never inside it
 L git status --porcelain | sort > <scratchpad>/current.txt
 L comm -13 <scratchpad>/baseline.txt <scratchpad>/current.txt   # added entries, compared as a sorted set, never by order
    L assert exactly these 5 lines and nothing else:
      ` D src/features/gallery/components/CameraOverlayPage.vue`
      ` M docs/features/orders/forms/create-order-image.md`
      ` M docs/frontend-layout-nav-refactor.md`
      ` M src/features/gallery/pages/OrderGalleryPage.vue`
      `?? src/shared/components/CameraOverlay.vue`
 L comm -23 <scratchpad>/baseline.txt <scratchpad>/current.txt
    L assert empty                                     # nothing that existed before disappeared
 L npm run build
    L assert exit 0; record the exit code in MoveReport
 L state in the report: a green build is NOT evidence the camera works    # esbuild, no type-check
```

```
stage2_browserProof(dispatcher: orchestrating Claude, skill: frontend-test, input: MoveReport + Preflight) -> BrowserReport
 L write the brief to a file, then: codex exec -s workspace-write -c sandbox_workspace_write.network_access=true -m gpt-5.6-luna -c model_reasoning_effort="xhigh" - < <brieffile>
 L brief must state:
    L do not modify any repo file; do not start, restart, or kill any dev server
    L server discovery, by capability not by port number:
       L for port in 3000, 3102: GET http://localhost:<port>/api/customers
       L accept the first port whose response content-type STARTS WITH `application/json`   # `; charset=utf-8` is expected, do not exact-match
       L a port answering that request with HTML is plain `vite` -> reject it, do not use it
       L if no port qualifies -> BLOCKED, report the status code and content-type of both
    L router is createWebHashHistory(); judge navigation by location.hash only
    L install playwright into the scratchpad; package.json and package-lock.json must be byte-identical afterwards
    L launch chromium with args --use-fake-ui-for-media-stream and --use-fake-device-for-media-stream
      L also context.grantPermissions(['camera'])
      L forbid a silent fallback if the launch fails -> report the error and stop
    L obtain a real gallery key by navigating the app to an order gallery; never invent or hardcode a key
    L this test uploads a real photo to Firebase; report the gallery key and the uploaded filename so a human can delete it
 L establish the photo-count selector BEFORE any scenario runs:
    L count `element.children` of the gallery grid `div.grid.grid-cols-3`, never `querySelectorAll('button')` and never `childNodes`   # one direct-child button per photo; the remove button is nested inside it
    L print the pre-capture count and the number of visible photos; if they differ -> BLOCKED, do not guess a selector
 L scenarios, each PASS/FAIL decided by a script assertion and reported with its raw value:
    L S1 open: goto `/#/gallery/<key>/camera` -> assert the overlay root is visible
    L S2 stream: assert video.readyState >= 2 AND video.videoWidth > 0
    L S3 capture: click the shutter (aria-label "ถ่ายภาพ") -> poll until img[alt="ภาพล่าสุด"] has a src starting "blob:"
    L S4 close: click the button with aria-label "เปิดแกลเลอรี" -> assert the overlay is gone, print location.hash before and after
    L S5 upload: poll the photo count after S4 -> assert after == before + 1, print both integers
    L S6 repo untouched: print `git status --porcelain | sort`, and comm it against Preflight.baseline
       L PASS when the added set is exactly verifyMove's 5 lines and the removed set is empty   # the move's own changes are expected here, only NEW entries fail
       L FAIL on any 6th added entry, including a stray file written by the test itself
 L screenshot at every assertion point; record video for the session
 L return BrowserReport { perScenarioVerdict, rawValues, screenshotPaths, videoPath, browserAndVersion, headedOrHeadless, gitStatus }
 L the model reports what the script printed; it never forms the verdict from an image
```

```
stage3_review(agent: frontend-reviewer, sandbox: read-only, input: MoveReport + BrowserReport) -> Status
 L read src/shared/components/CameraOverlay.vue and src/features/gallery/pages/OrderGalleryPage.vue directly
    L never accept MoveReport's claims without re-running the checks
 L re-run independently every read-only assertion in verifyMove(): the git show | diff, all four greps, and `git status --porcelain | sort` compared by eye against MoveReport.baseline
    L do not write baseline.txt / current.txt                # read-only sandbox; compare the two listings directly
    L do NOT run npm run build                          # read-only sandbox; the build writes dist/
    L instead assert MoveReport.buildExitCode == 0 is present, and treat BrowserReport as the runtime evidence
 L assert src/shared/components/CameraOverlay.vue imports no store, service, API client, or router
 L assert src/shared/components/CameraOverlay.vue contains no history.pushState / back / forward / popstate
 L assert no file under src/shared/ other than the new component changed     # this pass authorises that one file only
 L assert no file under server/, api/, contracts/ changed
 L assert no file under docs/plans/ changed
 L read BrowserReport's raw values; if any scenario lacks its raw value -> CHANGES_REQUIRED
 L if BrowserReport has any FAIL or BLOCKED -> CHANGES_REQUIRED
 L return APPROVED | CHANGES_REQUIRED | BLOCKED
 L flag only; never fix
```

```
fixLoop() -> Accepted | Blocked
 L round = 2
 L while round <= 3
    L stage1_fix(ui-builder, findings, Preflight)      # resume; stage 0 and stage1_move never re-run
       L Preflight is the unchanged stage-0 report; its `baseline` text is required by verifyMove
       L findings: the exact findings from the failing stage; fix those and nothing else
    L stage2_browserProof(...)                         # always re-run in full after any code change
    L stage3_review(...)
    L if APPROVED -> return Accepted
    L round = round + 1
 L return Blocked                                      # stop, hand the open findings to the user
```

## Edge Cases

stage0_preflight
- working tree already dirty -> record it as baseline; not a blocker, every later assertion is a delta from it
- `CameraOverlayPage` found in the App.vue exclude array -> report it, whole plan halts pending a rename decision
- `src/shared/components/CameraOverlay.vue` already exists -> report it, whole plan halts
- `CameraOverlayPage` hit in a file this plan does not name -> report it; stage 1 must not edit it without a new decision

stage1_move
- ui-builder judges a design decision is needed -> BLOCKED; there is none, so this means the brief was misread
- editor rewrites `<CameraOverlayPage` closing tag that does not exist -> the tag is self-closing; only line 351 changes
- delta over baseline shows a 6th entry -> BLOCKED, revert nothing, report the extra path
- an entry present in baseline disappears -> BLOCKED, a pre-existing change was clobbered
- diff against `git show HEAD:...` is non-empty -> BLOCKED, the copy was edited
- `npm run build` fails -> fix the import path only; a build failure here is a path typo

stage2_browserProof
- no port answers `/api/customers` with a JSON content-type -> BLOCKED with both ports' status and content-type; never start a server
- content-type is `application/json; charset=utf-8` -> that is a PASS; match by prefix, not equality
- a port answers the api route with HTML -> that is plain `vite`; reject the port, run no scenario against it
- no order with a reachable gallery route -> BLOCKED; do not fabricate a key
- fake camera device produces a synthetic pattern -> expected, still a valid capture; report it
- gallery grid still loading -> poll for real items, exclude skeleton nodes; never a fixed wait
- photo count selector matches nested remove buttons -> counts jump by 2; count direct children only, and BLOCK if the pre-count disagrees with the visible photos
- `package.json` or `package-lock.json` changed -> FAIL the run regardless of scenario verdicts

stage3_review
- BrowserReport missing entirely -> BLOCKED, not APPROVED
- reviewer wants to change the component's props, copy, or styling -> out of scope, reject the finding
- reviewer cannot run `npm run build` -> expected, read-only sandbox; assert MoveReport.buildExitCode instead
- reviewer cannot write baseline.txt / current.txt -> expected; compare the two porcelain listings without redirecting to a file
- reviewer finds a second file under `src/shared/` modified -> CRITICAL, CHANGES_REQUIRED

## Out of Scope

- `server/`, `api/`, `contracts/`, any Google Sheet, any schema JSON
- `G:\My Drive\Magicwash\Database\GoogleSheets\*.json` — read-only registry, never written
- moving upload to the backend; Firebase upload stays in the frontend
- API authentication
- wiring order-image capture to the camera (Phase 2)
- `src/utils/imageCompression.js` — stays at its current path; `src/api/storage.js` and `src/composables/usePhotoUpload.js` untouched
- the Thai aria-label copy inside the component, including `เปิดแกลเลอรี`
- any other file under `src/shared/`, including `BaseOverlay.vue` / `BaseFullOverlay.vue`
- `src/features/gallery/pages/OrderGalleryPage.vue` beyond lines 7 and 351
- `src/App.vue` and its KeepAlive exclude list — read and asserted, never edited
- `docs/plans/*` — never rewritten, and excluded from every stale-name grep
- `baseline.txt` / `current.txt` — scratchpad files, never created inside the repo
- a barrel / `index.ts` re-export
- any git write: add, commit, branch, checkout, `git rm`, stash
- restyling, redesigning, or restructuring the camera UI
- new tests under `tests/web/`

## Status

FINAL
