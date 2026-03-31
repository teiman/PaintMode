# PaintMode — Pixel Art Editor

A browser-based pixel art editor built for creating clean, expressive sprite work.

## Canvas

- 80x80 pixel grid

## Tools

All tools revert to **Normal Pen** on right-click unless stated otherwise.

### Normal Pen (default)
- **Left-click:** paint with the selected color
- **Right-click:** pick (copy) the color under the cursor

### Mirror Mode
- Pixels painted on one side of the canvas are mirrored to the other side (horizontal symmetry)

### Eraser
- Turns pixels transparent

### Delete Row
- Deletes an entire row and shifts everything below it up by one pixel

### Shadow Brush
- Paints a darker version of the color already on the canvas

### Light Brush
- Paints a brighter version of the color already on the canvas

### Shadow Pattern
- Draws a dithered pixel pattern using the current color

### Pixel Radar
- Highlights pixels that violate pixel-perfect rules (doubles, jaggies, etc.)

## Layers

- Support for multiple layers
- **Solo mode** button: makes all layers semi-transparent except the active one
- **Background layer:** visible wherever all layers are transparent; displays an animated pattern

## Palette

- Colors loaded from `palette.png` + a transparent color slot

## Export

- **Save as PNG** — exports at native 80x80 resolution
- **Save as x4 PNG** — exports at 320x320 (each pixel scaled to 4x4, nearest-neighbor / no interpolation)

## Tech Stack

- **Framework:** Vue
- **Rendering:** HTML Canvas
- **Dev server:** `npm run serve`
