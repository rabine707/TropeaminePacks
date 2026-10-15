# Artwork quality by view

Original Storage objects remain the source of truth. Preview URLs are derived at
render time; catalog metadata and saved Studio drafts retain the original URL.

| View | Delivery |
| --- | --- |
| Home, Browse, series and binder tiles (including By series) | Near-viewport browse derivative |
| Collection Albums | Lazy browse derivative |
| Studio and Quick Create card pickers | Near-viewport browse derivative |
| Pack front/back reveal | Eager sharp reveal derivative for the current card |
| Pack recap | Near-viewport browse derivative |
| Opened card, flip and fullscreen | Original |
| Studio canvas and Quick Create composition/export | Originals for selected cards |

Browse uses the existing 768 × 1152 representation; reveal uses 1024 × 1536.
Both use contain resizing and quality 82. Original delivery, private bucket
access, publication checks and cache policy are unchanged. A failed derivative
can fall back to the original so the artwork remains usable.

Reveal size is chosen before mounting the image, rather than changing its source
in a MutationObserver. The reveal stabilizer still handles image loading and tap
guards. Only the current front is prepared in the mystery stage; its back is
enabled after the front is revealed. Skipped backs remain disabled.

## Local validation

Checked with real published artwork and synthetic browser-only ownership of 67
cards, without spending Ink or modifying cloud collections:

- By series initially mounted three browse images, zero originals. Offscreen
  rows stayed unmounted; opening a tile requested the original.
- Detail, back and fullscreen loaded original URLs successfully.
- Studio picker mounted nine browse images on desktop and five at 390 × 844.
- Quick Create picker mounted twelve browse images and zero originals.
- A guest pack used reveal URLs directly for its current front and enabled back;
  progression and four-card recap with guaranteed foil worked. Recap images
  used browse URLs; opening a recap card selected the original.
- Studio kept selected-card originals and downloaded a valid 1080 × 1920 PNG.
- Typecheck, 27 application tests and production build passed. Existing artwork
  delivery tests confirm original bytes and publication filtering.

These checks validate routing and local behavior, not monthly egress savings,
production deployment, or a physical-device certification.
