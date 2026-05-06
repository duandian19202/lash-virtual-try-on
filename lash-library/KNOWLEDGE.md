# Eyelash Extension Knowledge Model

This document is the product and rendering knowledge base for building a realistic manufacturer lash library.

## Goal

The virtual try-on must not treat a lash style as a simple curve. A realistic lash SKU is a structured extension plan:

- fiber specification
- curl type
- length mapping
- diameter and weight
- density and fan strategy
- root/band behavior
- eye-shape correction
- styling intent

The website should render from these production rules, not from a generic drawing preset.

## Core Product Variables

### Length

Professional extension lengths are measured in millimeters. Common usable ranges are roughly `5mm-18mm`, while daily salon maps often use `8mm-14mm`.

For a manufacturer library, avoid storing only a range such as `10-13mm`. Store a map:

```json
"segments": [
  { "zone": "inner", "lengthMm": 8 },
  { "zone": "mid-inner", "lengthMm": 9 },
  { "zone": "center", "lengthMm": 10 },
  { "zone": "mid-outer", "lengthMm": 12 },
  { "zone": "outer", "lengthMm": 13 }
]
```

Rendering impact:

- longer fibers need larger visible arc length
- stronger curls can look visually shorter from the front
- inner corner must usually stay shorter for realism and comfort
- outer corner must not be blindly lengthened on downturned eyes

### Curl

Curl letters describe lift and shape. Common professional curls include:

- `J`: very soft, close to natural direction
- `B`: natural lift
- `C`: classic daily curl
- `CC`: stronger open-eye curl
- `D`: dramatic lift
- `L`: straighter base with lifted tip, useful for liner/foxy effects
- `M`: strong lift with straighter base, often useful for hooded/deep-set eyes

Rendering impact:

- curl is not only vertical lift; it changes the curve profile
- `L/M` should have a flatter root segment and sharper lift later
- `D` should lift earlier and higher than `C`
- curl must be combined with natural lash direction and eye shape

### Diameter / Thickness

Diameter is measured in millimeters. Industry examples:

- classic: often around `0.10`, `0.12`, `0.15`
- volume: often around `0.03`, `0.05`, `0.07`
- very thick classic styles may use higher diameters, but they look heavier

Rendering impact:

- diameter controls stroke weight, opacity, and root darkness
- thin volume fibers need more individual hairs/fans but lighter strokes
- thick classic fibers need fewer, clearer, heavier strokes
- width should taper strongly toward the tip

### Density And Fan Type

Density is not just hair count. It depends on:

- classic single extension
- hybrid mix of singles and fans
- volume fans
- mega volume
- wet look / closed fans
- anime or wispy spikes

Rendering impact:

- classic: fewer separated fibers
- volume: many thinner fibers, softer mass
- wet look: closed groups with stronger spikes
- wispy/anime: short base layer plus longer spike layer
- density must vary by segment, not be uniform

### Color

Useful manufacturer color categories:

- black
- soft black / mid black
- deep black
- brown
- gray
- color accent, such as wine, navy, purple, green

Rendering impact:

- deep black needs stronger root and higher contrast
- brown/gray need lower contrast and softer opacity
- color accent should not always color every fiber; often mixed placement is more realistic

### Root / Band Behavior

Realistic lashes need root behavior:

- invisible/clear root
- black band
- eyeliner effect
- cluster root
- fan root
- closed spike root

Rendering impact:

- root line should follow the eyelid curve
- root darkness should vary by style
- strong black band can look like eyeliner
- roots need soft blending and shadow to avoid floating

## Lash Mapping Styles

### Natural

Typical pattern:

```text
8 / 9 / 10 / 11 / 10
```

Use:

- daily wear
- natural enhancement
- mature or conservative looks

Rendering:

- low-to-medium density
- soft random spacing
- shorter inner and outer corners

### Cat Eye / Outer Longer

Typical pattern:

```text
8 / 9 / 10 / 12 / 13
```

Use:

- elongating the eye
- liner effect
- almond or round eyes

Risk:

- can pull down already downturned eyes if outer corner is too long

Rendering:

- gradual outer increase
- stronger outward lean near outer zone
- avoid overly heavy inner corner

### Doll Eye / Open Eye

Typical pattern:

```text
8 / 10 / 12 / 10 / 9
```

Use:

- opening the center of the eye
- rounder, brighter effect

Rendering:

- longest fibers near center/iris
- less outer drag
- higher vertical lift in center

### Wispy / Anime / Spike

Typical structure:

- short base layer
- longer spike layer
- closed fans or grouped spikes

Rendering:

- separate base density from spike density
- spikes should have positions and strengths
- tips should look sharper and more separated

### Volume

Typical structure:

- more fibers or fan groups
- thinner diameters
- darker root mass

Rendering:

- many thin strokes
- layered opacity
- more root blend
- less uniform spacing

## Eye Shape Strategy

The same SKU should not render identically on every eye.

Important eye-shape rules:

- hooded/deep-set eyes often benefit from lifted curls like `L/M`, but overly long curls can hide under the lid
- downturned eyes should avoid excessive outer length unless lift is strong
- wide-set eyes can use more center/inner emphasis
- close-set eyes can use outer emphasis
- round eyes can be elongated with cat-eye maps
- small eyes can look closed if lashes are too dense or too long

Rendering implication:

The engine eventually needs an eye-shape modifier layer:

```json
"eyeShapeRules": {
  "hooded": { "maxLengthAdjustmentMm": -1, "preferredCurl": ["L", "M", "C"] },
  "downturned": { "outerDensityMultiplier": 0.8, "outerLiftMultiplier": 1.2 },
  "round": { "outerLengthMultiplier": 1.08 }
}
```

## Data Model Needed For Realistic Rendering

Each SKU should eventually support:

```json
{
  "sku": "TEST-C-1013-010-DBK",
  "series": "Cat Eye",
  "category": "cat-eye",
  "fiber": {
    "material": "PBT",
    "thicknessMm": 0.10,
    "finish": "satin",
    "tipShape": "tapered",
    "rootColorDepth": 0.86
  },
  "curlProfile": {
    "grade": "C",
    "curveStrength": 0.40,
    "rootStraightness": 0.18,
    "liftAngleDeg": 32
  },
  "layout": {
    "style": "outer-longer",
    "segments": [
      { "zone": "inner", "lengthMm": 8, "density": 0.68, "angleDeg": -8 },
      { "zone": "mid-inner", "lengthMm": 9, "density": 0.86, "angleDeg": -3 },
      { "zone": "center", "lengthMm": 10, "density": 0.98, "angleDeg": 0 },
      { "zone": "mid-outer", "lengthMm": 12, "density": 1.08, "angleDeg": 6 },
      { "zone": "outer", "lengthMm": 13, "density": 1.12, "angleDeg": 12 }
    ]
  },
  "fan": {
    "type": "classic",
    "fanSize": 1,
    "closedFanRatio": 0
  },
  "root": {
    "type": "soft-black-band",
    "bandOpacity": 0.55,
    "blendPx": 2
  },
  "render": {
    "lashCount": 42,
    "randomness": 0.18,
    "layerCount": 2,
    "opacity": 0.93
  }
}
```

## Why The Current Output Still Looks Fake

The current renderer has improved but still lacks several professional details:

- no true multi-layer application
- no natural-lash direction modeling
- no fan geometry for volume lashes
- no individual root attachment points
- no accurate `L/M/D` curl profile shapes
- no product-specific left/right asset calibration
- no eye-shape correction
- no real sample comparison loop

## Recommended Next Implementation Steps

1. Upgrade SKU data with `angleDeg`, `fan`, `root`, and `layerCount`.
2. Rewrite renderer to generate separate base layer, fan layer, and spike layer.
3. Add curl profile functions for `B/C/CC/D/L/M`.
4. Add eye-shape modifiers before drawing.
5. Calibrate 5 real SKU samples against reference photos or artist-approved maps.
6. Only after the renderer matches those 5 SKUs, scale the library to 100+ SKUs.

## Sources Used For Knowledge Modeling

- LashVee curl, length, diameter starter SKU guidance.
- LashVee eyelash extension sizes guide.
- SalonServe curl, diameter, length guide.
- Pro Lash length and mapping guidance.
- Nikole Rose lash mapping style guide.
- Paris Lash Academy lash mapping overview.
- Milady eyelash extension application preview chapter.
