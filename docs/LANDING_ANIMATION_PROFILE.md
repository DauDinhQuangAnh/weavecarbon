# Landing animation loading profile

Measured on 2026-10-06 from the frontend production build at `251c9ce`. The desktop hero is
mounted at widths of at least 1024px; smaller viewports use the existing static
decorations.

## Baseline

- `LeafHero3D` requested all 200 WebP frames and the GLB when mounted, and its
  loading manager withheld the sequence until all 201 requests completed.
- The 200 files total 9,445,992 bytes; the model is 3,165,176 bytes. Together
  they are 12,611,168 bytes of asset files before HTTP transfer effects.
- Every frame is 1920×1080 with alpha. A full RGBA decode of 200 frames would
  occupy 1,658,880,000 bytes (about 1.54 GiB), excluding GPU copies and object
  overhead. This is a size estimate, not a measured browser heap value.

## Change

- Begin playback when frame 1 is available. Request at most six frames at once
  and only the next 24 frames relative to the current frame. The initial six
  files total 29,448 bytes; the initial 24 total 117,792 bytes. The GLB still
  starts in parallel so the existing sequence-to-model transition can wait for
  it without changing the visual result.
- Hold the visible frame if the next one arrives late or fails. Failed frames
  are skipped; loaded frames retain their original order, color space, geometry,
  and transition behavior.
- Dispose frames after display and release the sequence when the model takes
  over. A 24-frame RGBA window is 199,065,600 bytes (about 190 MiB) before GPU
  copies; actual browser memory use depends on decoding and caching.

## Verification

- The optimized production build and all eight existing client bundle budgets
  pass. Total emitted client JavaScript is 13,837,236 bytes against the
  14,500,000-byte budget.
- In a local production server with a local health-response stub, a 1280×800
  browser showed the sequence in progress and then the same 3D leaf. The page
  asset inventory observed 126 frames partway through and all 200 frames plus
  one GLB after completion; the browser reported no console errors.
- The browser check confirms progressive requests and the completed visual
  handoff. It is not a network-throttled timing or browser-memory benchmark.
