# Pixel Art Rules

Every pixel is deliberate. These rules keep sprites clean and readable.

---

## Lines & Edges

**Consistent slopes.** Lines follow regular stair patterns (1:1, 2:1, 3:1). Never break the sequence mid-line. A line that goes 2,2,3,2 has a jaggy at the 3.

```
Good (2:1):        Bad (broken):
#                  #
##                  ###
  ##                  #
    ##
```

**No doubles.** Two pixels sharing only a diagonal corner create an ambiguous connection. Every pixel in a line must connect cardinally (up/down/left/right) to the next — not just diagonally.

```
Bad:    Fix:
#.      #.
.#      ##
```

**Single-pixel lines.** Outlines and contour lines should be 1px wide. Double-width segments in a curve break the flow and add unwanted weight.

**Gradual curve segments.** Curves change slope progressively: segments grow or shrink by 1 (e.g., 1,1,2,2,3,3 — not 1,3,1,2). This applies at any scale — bigger curves use longer segments but the same gradual progression.

```
Good curve:    Bad curve:
  ##             ##
 #              #
#              ###
#                #
 #              #
  ##             ##
```

**Manual anti-aliasing.** Place 1 intermediate-color pixel at curves and angled edges to smooth staircases. H/V and 45-degree lines don't need AA.

```
  ##DD          D = dark
 D####          M = mid (AA)
M#####          Transition: bg -> M -> D -> fill
######
```

**AA is max 1px wide.** Never stack 2-3 transition pixels — that creates banding at the edge ("triple alias"). One pixel of intermediate color is enough.

```
Good (1px AA):     Bad (triple alias):
  ##                  ##
 M##               mM##
####              mM####
```

**Hard lines where they matter.** Structural edges (face contours, weapon blades, text) stay crisp with no AA. Reserve anti-aliasing for smooth organic curves only. Over-AA makes everything look fuzzy and muddy.

**Don't AA text.** Pixel fonts must use hard edges. Anti-aliased pixel text loses crispness and becomes unreadable.

---

## Outlines

**Vary outline color with light.** Light-facing edges get a lighter outline, shadow edges stay dark. Uniform black outlines flatten the form.

**Selective outline (sel-out).** Remove or lighten outline segments where the sprite meets a known background, letting the form breathe. Use carefully — breaks readability on varied backgrounds.

---

## Shading & Light

**One light source.** Pick a direction (typically top-left) and keep it consistent across the entire sprite.

**No pillow shading.** Shading must follow the light direction and surface form, not radiate concentrically from the outline inward.

```
Bad (pillow):     Good (directional):
  333               112
 32223              1223
 32123              2233
 32223              2333
  333               233
```

**Form over flatness.** Shade to suggest volume (cylinders, spheres, planes), not just to fill space.

---

## Color & Palette

**Limit colors.** 4-16 colors per sprite. Fewer colors = more cohesion. Shared colors across ramps unify the piece.

**Hue shift in ramps.** Don't just darken/lighten — shift hue too. Shadows toward blue/purple, highlights toward yellow/warm. Straight ramps look dead.

```
Straight ramp:    Hue-shifted ramp:
dark red          dark purple-red
mid red           mid red
bright red        warm orange-yellow
```

**Peak saturation in midtones.** Desaturate both the darkest shadows and brightest highlights. Max saturation at high brightness causes eyeburn.

**No color noise.** Every pixel must belong to an intentional cluster or serve a specific purpose (AA, specular highlight, essential detail like an eye).

---

## Clusters & Readability

**Pixels form groups.** Isolated single pixels read as noise. Group same-color pixels into solid clusters. Cluster borders define neighboring shapes.

```
Bad (noise):    Good (clusters):
#.#.#.          ###..
.#.#.#          ###..
#.#.#.          ..###
```

**Exceptions:** specular highlights, tiny details on small sprites (eyes, stars), and AA pixels.

**Readable silhouette.** Fill the sprite solid — it should still be recognizable. Shape first, detail later.

---

## Banding

**No parallel color bands.** When two colors share long aligned edges they expose the pixel grid and look banded.

```
Bad (banding):    Fix (break alignment):
AAAA              AAAA
BBBB               BBB
CCCC              CCCC
```

Types to watch: hugging (outline mirrors inner shape), fat pixels (2x2 blocks acting as one), skip-one banding (gap between bands doesn't help).

---

## Dithering

**Use sparingly.** Dithering (checkerboard patterns) transitions colors without adding palette entries, but overuse creates unwanted texture.

- 50/50 checkerboard for gradual transitions
- Stylized patterns for material texture (metal, fabric)
- Avoid random dithering — it produces noise

