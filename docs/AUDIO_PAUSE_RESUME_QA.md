# Audio Pause/Resume — Manual QA Scenario

Goal: confirm that pressing **Pause** then **Play** on the narrator resumes from
the saved `currentTime` (no restart from 0) across **Chrome**, **Safari**
(macOS + iOS), and **Firefox**, while reusing the same `Audio` instance.

## How to enable the in-app debug panel

Append `?audioDebug=1` to any preview URL, e.g.:

```
https://<preview-host>/ai-storyteller?audioDebug=1
```

Or in DevTools console:

```js
localStorage.setItem('starry-tales-audio-debug', '1'); location.reload();
```

A floating panel appears bottom-right showing every pause/resume event with:
- `saved`   — position captured on Pause
- `before`  — `currentTime` immediately before restore
- `after`   — `currentTime` immediately after restore
- `rs`      — `readyState` (1 = HAVE_METADATA, 4 = HAVE_ENOUGH_DATA)
- `dur`     — total audio duration

Console mirror is logged as `[Audio][<Browser>][<source>] <kind> {...}`.

## Test matrix

For each browser, run **both** scenarios.

### Scenario A — HD narrator (AI Storyteller)
1. Open `/ai-storyteller?audioDebug=1`.
2. Generate or open an existing story, ensure "HD voice" is ON.
3. Press **Play**, let it run ~6 seconds.
4. Press **Pause**.
   - Expected panel event: `pause` with `saved ≈ 6.0`.
5. Wait 3 seconds.
6. Press **Play** again.
   - Expected panel events in order:
     - `resume-request` with `saved ≈ 6.0`
     - `resume-restored` with `after ≈ 6.0` (NOT 0.0)
     - `resume-playing`
7. Verify audibly that narration continues from second 6, not from the start.

### Scenario B — SEL Story Viewer (Reading Mode)
1. Open `/library`, pick any SEL story, enter reading mode.
2. Press the narrator button, let it run ~5 s.
3. Pause → wait → Play. Same expectations as Scenario A but with `source = SelViewer`.

### iOS Safari notes
- First Play **must** be a direct user tap (autoplay policy).
- On the very first pause+resume after a cold load, you may see a
  `resume-deferred` event followed by `resume-restored`. This is the iOS
  metadata-wait path firing — playback should still resume at `saved`, not 0.

## Pass criteria

| Browser           | `saved` preserved | Resumes at `saved` | Same `<audio>` reused |
|-------------------|:-----------------:|:------------------:|:---------------------:|
| Chrome (desktop)  | ✅                | ✅                 | ✅                    |
| Firefox (desktop) | ✅                | ✅                 | ✅                    |
| Safari (macOS)    | ✅                | ✅                 | ✅                    |
| Safari (iOS)      | ✅                | ✅ (after deferred seek) | ✅              |

Reusing the same instance is verified by the fact that `pause`/`resume-request`
events carry the same `duration` value across the cycle — a recreated `Audio`
object would either reset `duration` to `NaN` or change it.

## Failure logging

Any `play()` rejection or seek error is recorded as:
- `play-rejected` with `{ after, message }`
- `error` with `{ message }`

Capture a screenshot of the debug panel + a copy of the console output and
attach to the bug report along with browser + OS version.
