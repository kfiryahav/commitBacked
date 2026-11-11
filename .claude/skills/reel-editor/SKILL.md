---
name: reel-editor
description: >-
  Edits a raw talking-head video shot on a phone into a finished, branded vertical reel (1080x1920) in the AY
  house style: Hebrew transcription, a tight cut on the pauses, 2-4 gentle emphasis zooms, a light warm grade,
  one brand card that appears only on the meaningful lines (30-40% of the runtime) and changes on the spoken
  words (hook, numbered tips, list, quote, compare, send/follow), soft white captions under the chin, sparse
  sound and -14 LUFS. Use when the user uploads or points to a video and asks to edit it, cut it, make it a
  Reel/TikTok/Short, add captions or a branded card, or "same edit for this video". Hebrew triggers: "תערוך",
  "ערוך לי את הסרטון", "עריכה ממותגת", "נקי וקריאייטיבי", "תוסיף כתוביות", "תעשה מזה רילס".
---

# Reel editor

The method, in one line: **the speaker is the centre of the frame, the brand lives in one elegant card in the
lower part of the frame, captions sit under the chin, and every visual change lands on a spoken word.** Nothing
on screen is invented: every title, chip and quote is the speaker's own words, shortened.

Based on AY Video Editor by Amir Yacoby / AY Digital Marketing (MIT), with the motion engine by Barty-Bart
(MIT). See `LICENSE` and `engine/LICENSE`.

## Paths

```bash
RE=<this skill's base directory>     # every script, font, template and reference is under it
PY=$([ -x reels/.venv/bin/python3 ] && echo reels/.venv/bin/python3 || echo python3)
V=reels/v1                           # one folder per video: reels/v1, reels/v2, ...
```

Run everything from the project root. `reels/` is the workspace (git-ignored): sound effects in
`reels/inputs/sfx/`, card sources in `reels/clips/`, built cards in `reels/dist/`. Never commit video files.

## Before the first edit of a session

1. **Read `$RE/brand.json` and `$RE/my-notes.md`.** The notes are what the user taught you; they override this
   file. If `brand.json` has `"confirmed": false`, ask once, in one round (AskUserQuestion): the card colours (or
   keep the default ink/gold/ivory), the name on the Follow card, and the CTA keyword if they use one (e.g. the
   word people comment to get a guide). Save the answers and set `"confirmed": true`.
2. **Set up the tools:** `bash $RE/setup.sh`. In a cloud container run it directly. On the user's own computer
   tell them first that it installs Python libraries (into `reels/.venv` if needed) and Playwright, and ask.
   It prints `MISSING:` with the install command if ffmpeg, Python or Node are missing.
3. **Transcription needs Hugging Face.** The Whisper models download from `huggingface.co` and its file storage
   (`*.hf.co`). If a cloud environment blocks them, tell the user to add both under the environment's Network
   access → Allowed domains, and meanwhile ask for an `.srt` (Instagram/CapCut export) and use `--srt`.

## The pipeline

| # | Step | Command | Output |
|---|---|---|---|
| 0 | Source | `mkdir -p $V/out && cp <video> $V/source.mp4` (Drive: `bash $RE/scripts/fetch_drive.sh <id-or-link> $V/source.mp4`) | `source.mp4` |
| 1 | Words | `$PY $RE/scripts/transcribe.py $V/source.mp4 $V/words.json --lang he` (`--srt file.srt` if given; `--lang en` for English speech) | `words.json` |
| 2 | Analyse | `$PY $RE/scripts/analyze.py $V/source.mp4 $V/words.json $V` | `transcript.md`, `video.json`, `contact.png` |
| 3 | Plan | one table, **wait for approval** | |
| 4 | Cut | `$PY $RE/scripts/auto_cut.py $V/words.json $V/edit.json --source $V/source.mp4 --video-json $V/video.json --push "…" --snap "…" --print` | `edit.json` |
| 5 | Render cut | `$PY $RE/scripts/render_cut.py $V/edit.json $V/out` | `rough.mp4`, `words_edited.json` |
| 6 | Card | spec → `make_tips_card.py`, or a template; build, preview, render (below) | `card.mov` |
| 7 | Grade | `bash $RE/scripts/grade.sh $V/out/rough.mp4 $V/out/rough_graded.mp4 [hold]` | `rough_graded.mp4` |
| 8 | Captions | `align_script.py` (if there is a script) → `make_captions.py --style soft --below-face` | `captions.ass`, `captions.srt` |
| 9 | Finish | `make_finish.py` → `finish.py` | `final_master.mp4`, -14 LUFS |
| 10 | QA | `stills.sh` at every card state + loudness | look at every still |
| 11 | Deliver | `bash $RE/scripts/deliver.sh $V/out/final_master.mp4 $V/out/final.mp4` | `final.mp4` ≤ 29 MB, `captions.srt` |

The card (6) and grade/captions (7-8) are independent: start the card render in the background and grade and
caption meanwhile.

### 0. The video

- Check it: `ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of compact $V/source.mp4`.
  Output is 1080x1920 at the source frame rate (`auto_cut.py` takes it from `video.json`).
- Chat uploads stop at ~30 MB. Bigger: Google Drive shared as "Anyone with the link", fetched with
  `fetch_drive.sh` (needs `drive.google.com` and `drive.usercontent.google.com` allowed in a cloud environment).

### 1-2. Words and analysis

- `analyze.py` snaps Whisper's early word starts to the end of silences (it rewrites `words.json`), finds the
  face, and writes `transcript.md` with `[fillers]`, low-confidence words marked `?`, and `⚠ RETAKE?` where a
  sentence restarts. **Read `transcript.md` and look at `contact.png` yourself.**
- **A script makes the captions right.** If the video was shot from a script (for example one written with
  `/ig-reel`, or the user pastes what they meant to say), save it as `$V/script.txt` with real punctuation: the
  captions take their spelling and line breaks from it. With no script, write one from the transcript and fix
  misheard words, names and English terms (Claude, Instagram, ChatGPT...).

### 3. Plan, and wait for approval

Write for yourself the one-sentence point, the hook (first 1-3 s), the beats and the CTA. Then show the user
one scannable table and wait:

| # | Time | Line | Keep / cut | Zoom | Card state (on which word) |

plus length before → after and the CTA. Real phone footage usually has retakes: keep the **last good take** of
a repeated sentence, cut false starts and fillers, never leave half a sentence. (Repetition used on purpose,
"Never... Never...", is not a retake.)

### 4-5. The cut

`auto_cut.py` turns every pause over 0.45 s into a cut and pads 0.10 s before / 0.24 s after the words (a
breath, not a gasp). Base framing stays at the source framing (1.0): every zoom above 1.0 upscales and softens
the face, so only the emphasis lines zoom, and only by phrase:

- `--push "phrase"`: slow push-in (+0.07) across that line: the hook, the key lesson, the payoff.
- `--punch "phrase"`: the line one step tighter (+0.06), back after: a punchline, the CTA.
- `--snap "phrase"`: fast punch-in (+0.08 in 0.3 s), **once per video**, the strongest line.
- 2-4 emphasis lines per video in total, never two in a row. Most of the video is steady.

Then `render_cut.py`. Check `$V/out/words_edited.json` around the cuts: a word Whisper stretched across a pause
can land on the wrong side or get `e < s`; fix it by hand before captions and card timing.

Jump cuts between two takes that look rough: `$PY $RE/scripts/smooth_cut.py` (optical-flow morph between takes,
speed ramp inside a take; schema in its header, pitfalls in `reference/lessons.md`).

### 6. The brand card: one shape that changes on words

Read `reference/card-patterns.md` (the pattern library) and, before writing card HTML by hand,
`reference/engine-api.md`. The rules:

- **On screen 30-40% of the video only.** 60-70% is the speaker alone with captions. Pick 3-5 moments: the
  hook, the strongest list or contrast, the key quote, the CTA. Check: `sum(window lengths) / length` is 0.30-0.40.
- **One transparent clip for the whole video** (`bg:null`, stage 1080 x 420-560), overlaid at `y ≈ 1060-1120`:
  the lap/table area, under the captions, above the platform buttons. Clip time = rough-cut time, so card times
  are word times from `words_edited.json`.
- **Every change sits on its word:** the state change on the word that opens the section or the spoken number,
  each chip on the word it names.
- **Colours from `brand.json`:** ivory cards with ink text for content; ink cards with ivory/gold text for the
  hook, quotes and CTA; a 2 px gold hairline around the shape so black cards show on dark shirts.
- **Text is the speaker's words**, 2-6 words. No new numbers, claims or names.
- **Hebrew:** `class="rtl"` on Hebrew text, mirrored layout (number/icon on the right, text growing left, bars
  filling right to left), layer `anchor:'r'`, `right:` offsets. See "Hebrew and RTL" in `reference/engine-api.md`.
  The templates in `templates/` are English: mirror them when you adapt one.
- **Ending:** a "Send this" pill clicked by the cursor on "send", then a Follow button that flips to
  "Following" on "follow". If "follow" is the last word, hold the end 0.6 s (`grade.sh … 0.6`).
- **CTA keyword** (from `brand.json`): if the speaker says "comment X", put the keyword in the CTA text (in the
  tips card: `follow.label`, e.g. `תגיבו "מדריך"`), on the word "comment".

**Numbered tips** ("3 טעויות", "5 כלים"): don't hand-write. Copy `templates/tips-spec.example.json` to
`$V/tips.json`, set `"rtl": true` for Hebrew, the brand colours, the hook, each tip's `at` (the spoken number) and
title, send and follow, then:

```bash
$PY $RE/scripts/make_tips_card.py $V/tips.json reels/clips/$(basename $V)-tips.html
$PY $RE/engine/build.py reels/dist reels/clips/$(basename $V)-tips.html
node $RE/engine/beats.js reels/dist/$(basename $V)-tips.html $V/beats.png <one time inside each state>
node $RE/engine/render.js reels/dist/$(basename $V)-tips.html $V/out/card.mov <source fps, e.g. 30/1>
```

**Look at `beats.png` before rendering.** Typical fixes: text overflowing the card (shorten it), an element
sliding past the card edge. `render.js` takes about a minute per 25 s of video.

### 7. Grade

`grade.sh`: contrast +4%, saturation +6%, a little warmth in the highlights, no vignette, near-lossless. Skin
must stay natural.

### 8. Captions

```bash
$PY $RE/scripts/align_script.py $V/out/words_edited.json $V/script.txt $V/words_captions.json   # if script.txt exists
$PY $RE/scripts/make_captions.py $V/words_captions.json $V/captions.ass --W 1080 --H 1920 \
  --style soft --below-face $V/out/rough.mp4 --srt $V/out/captions.srt [--strong-shadow] [--fix $V/fixes.json]
grep -v -- '-->' $V/out/captions.srt | grep -v '^[0-9]*$' | grep . | tr '\n' '|'   # read every line
```

- No script: caption `$V/out/words_edited.json` directly, with `--fix` (`{"קלוד": "Claude"}`) for names and
  English terms.
- `soft` = white Heebo Bold, 2-3 words, soft shadow, on the top line of the chest. Light shirt or wall behind
  the captions: `--strong-shadow`.
- Fix a split word, an orphan last word or an awkward break (merge words in the JSON, or add a comma in
  `script.txt` at the speaker's pause and re-align). Hebrew must read right to left, numbers and English included.
- Captions never touch the card: if they would, move them (`--y`) or shorten the card window.

### 9. Finish

```bash
$PY $RE/scripts/make_finish.py $V/finish.json --video $V/out/rough_graded.mp4 --final $V/out/final_master.mp4 \
  --card $V/out/card.mov --card-y 1100 --captions $V/captions.ass \
  --whoosh <card window opens> --swoosh <section changes> --pop <chips/rows> --click <cursor clicks>
$PY $RE/scripts/finish.py $V/finish.json
```

Sound is sparse: one whoosh as a card window opens, a short swoosh on a section change, a soft pop on a chip, a
click on each cursor click. No music unless the user gives a track (`--music`). `finish.py` normalises to -14 LUFS.

### 10. QA, always, before sending

- `bash $RE/scripts/stills.sh $V/out/final_master.mp4 $V/sheet.png <hook> <one time per card state> <end>`, then
  look at it: face clear, captions under the chin and clear of the card, card text fits, nothing over the mouth.
- `ffmpeg -i $V/out/final_master.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2` →
  I ≈ -14 LUFS, peak below -1 dBFS.

### 11. Deliver

`deliver.sh` copies the master if it fits in 29 MB, otherwise one two-pass encode that fits (never a second CRF
re-encode). Send `final.mp4` and `captions.srt` (with the file-sending tool if there is one; otherwise give the
paths). Reply in Hebrew with:

- length before → after;
- the card states in order, each with the word it lands on;
- the emphasis zooms;
- what was cut or shortened, and that every word on screen is the speaker's own;
- what's missing and the one question that unblocks it.

If the Instagram skills are installed, offer `/ig-caption` for the post text, with the CTA keyword.

## House rules

- The person is the centre. Graphics in the lower part of the frame, never over the face or mouth.
- Card on 30-40% of the runtime only, on meaningful lines. No extra pop-ups that repeat the captions.
- Zooms gentle and few; base framing 1.0. No slanted or 3D caption styles.
- Never invent numbers, quotes, results or names.
- Quality: near-lossless intermediates, master at crf 14, `deliver.sh` for the chat copy.

## Learning

When the user corrects or confirms something that should hold for future videos (caption look, zoom amount,
card style, pacing, how to spell a name, their CTA), add one short dated line to `$RE/my-notes.md`. Brand
colours, name and keyword go in `$RE/brand.json`. Say which file you changed. If this skill lives in a git
repository, those two files are the only ones to commit after an edit; the videos stay out of git.

More detail: `reference/card-patterns.md` (card patterns with code), `reference/lessons.md` (pitfalls and their
fixes), `reference/engine-api.md` (writing a card by hand), `templates/` (working cards), each script's header
(its full options).
