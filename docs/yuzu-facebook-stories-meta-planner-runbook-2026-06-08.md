# Yuzu Facebook Stories Meta Planner Runbook

Date: 2026-06-08

## Active Channel

- Use Facebook Page Stories for this month.
- Do not use Instagram publishing while the Instagram page is disabled.
- Keep all Story posts adult 21+, educational/community/editorial, and free of marketplace, pricing, inventory, checkout, giveaway, health, reduced-risk, or drug/therapy framing.

## Posting Rhythm

- Use `docs/yuzu-facebook-stories-posting-schedule-2026-06-09.csv`.
- Baseline: two Stories daily at 9:00 AM and 6:30 PM America/Phoenix.
- Extra trend slot: Friday and Saturday at 8:45 PM America/Phoenix.
- Total month schedule: 68 Facebook Story slots from 2026-06-09 through 2026-07-08.

## Meta Planner Workflow

1. Open Meta Business Suite Planner for the Yuzu Cigar Club Facebook Page.
2. Create each Story from the schedule row for the matching date/time.
3. For image/interactive Stories, use the row's hook text plus a poll, question, or reply sticker.
4. For video Stories, upload the matching HyperFrames MP4 only after its audio verification JSON shows `status: pass`.
5. Confirm the scheduled local time in America/Phoenix before saving.
6. After saving, update the schedule row status with the Meta Planner scheduled state or live permalink/readback if available.

## API Status

- Facebook Page feed/photo posts were scheduled through the Graph API and verified by readback.
- Page Stories were probed separately in `output/social/facebook-planner-month-2026-06-09/meta-page-story-api-probe.json`.
- Safe probe conclusion: Page Stories readback is available, but this probe did not find a safe future-scheduling endpoint equivalent to Page post `scheduled_publish_time`.
- Do not use a Story upload/finish API flow for future scheduling until a documented scheduled Story publish path is confirmed and tested. A finish/upload call may publish immediately.

## First Ready Video Asset

- Story slot: 2026-06-13 at 8:45 PM America/Phoenix.
- Theme: Rough week, adult ritual.
- MP4: `output/social/yuzu-facebook-story-rough-week-reset-2026-06-12.mp4`.
- HyperFrames source: `output/social/yuzu-facebook-stories-viral-hyperframes/index.html`.
- Audio verification: `output/social/audio-verification-2026-06-08/yuzu-facebook-story-rough-week-reset-audio-verification.json`.
- Verification result: passed; no clipping, static-like profile, hum/buzz concentration, or large silent sections.
