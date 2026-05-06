# Advanced 3D Lash Asset Pipeline

This document defines how to produce high-quality 3D lash assets for a realistic manufacturer lash database.

## Positioning

Advanced 3D should be treated as a calibrated digital sample pipeline:

```text
real SKU data -> 3D parametric model -> calibrated render -> transparent PNG/WebP -> try-on database
```

It is not a replacement for product truth. The source of truth remains:

- real SKU specification
- real factory sample
- reviewed visual output
- approved transparent asset

## Expected Realism

High-quality 3D can be suitable for:

- SKU preview images
- product detail visual assets
- virtual try-on transparent lashes
- pre-production sample visualization
- consistent style catalog rendering

It should not be represented as a raw real photograph unless it has been explicitly marked and approved.

Expected realism range:

```text
program line drawing: low
basic 3D curves: medium
advanced 3D with calibrated material, roots, fans, layers: high
real scan/photo asset: highest
```

## Folder Structure

```text
lash-library/
  3d/
    assets/
      SKU/
        source.blend
        source.glb
        preview.png
        notes.md
    scripts/
      generate_lash.py
      render_batch.py
    renders/
      SKU/
        main.png
        thumb.png
        detail.png
  assets/
    SKU/
      main.png
      thumb.png
      source.png
```

Final approved renders should be copied into:

```text
lash-library/assets/SKU/main.png
lash-library/assets/SKU/thumb.png
```

The website should use only approved transparent assets from `lash-library/assets/`.

## 3D Model Components

Each SKU model should contain:

- `RootBand`: soft root/black band or invisible root.
- `BaseLayer`: shorter support fibers.
- `StyleLayer`: visible mapping layer that defines the style.
- `SpikeLayer`: optional longer closed spikes for wispy/anime styles.
- `VolumeFans`: optional fan groups for volume styles.
- `CalibrationPlane`: hidden reference plane for scale and alignment.

## Fiber Geometry

Each lash fiber should be a bevelled curve or mesh curve with:

- tapered tip
- thicker root
- slight natural bend
- randomized rotation
- controlled length in millimeters
- segment-specific direction
- optional twist

Recommended 3D fields per fiber:

```json
{
  "rootPosition": 0.42,
  "lengthMm": 12,
  "diameterMm": 0.10,
  "curl": "C",
  "angleDeg": 4,
  "depth": 0.12,
  "layer": "style",
  "fanGroup": null
}
```

## Curl Profiles

Do not model curl as one simple arc. Use curl profile curves:

- `B`: soft continuous curve
- `C`: classic lifted curve
- `CC`: stronger and earlier lift
- `D`: dramatic high lift
- `L`: straighter root, sharp lifted tip
- `M`: straight base with strong lift, more open center

Each curl profile should define:

```json
{
  "rootStraightness": 0.18,
  "midLift": 0.42,
  "tipCurl": 0.56,
  "liftAngleDeg": 32
}
```

## Material Requirements

Use anisotropic dark fiber material, not plain black.

Material controls:

- base color
- root darkness
- roughness
- specular intensity
- anisotropic highlight
- tip transparency

Example material presets:

```json
{
  "deepBlackSatin": {
    "baseColor": "#080706",
    "roughness": 0.42,
    "specular": 0.38,
    "anisotropic": 0.75
  },
  "softBrownSemiMatte": {
    "baseColor": "#4b3124",
    "roughness": 0.58,
    "specular": 0.22,
    "anisotropic": 0.45
  }
}
```

## Lighting Setup

Use consistent lighting for all SKU renders:

- large softbox above/front
- weak rim light from upper side
- low fill light
- transparent background
- orthographic camera
- no harsh product shadow in final try-on asset

Recommended render outputs:

- `main.png`: transparent lash strip for try-on
- `thumb.png`: small catalog preview
- `detail.png`: close-up detail for product page

## Render Requirements

Try-on `main.png`:

- transparent PNG
- horizontal lash strip
- root near bottom edge
- consistent canvas size across SKUs
- width at least 1600px
- no skin, no eye, no white background
- product centered
- root baseline aligned

Recommended:

```text
main.png: 2400 x 600
thumb.png: 800 x 240
detail.png: 1600 x 900
```

## Calibration Workflow

For each series:

1. Pick one real factory sample.
2. Scan or photograph it as reference.
3. Build 3D model from SKU data.
4. Render transparent asset.
5. Compare against real sample.
6. Adjust:
   - length scale
   - curl profile
   - root band thickness
   - density
   - fan spread
   - material reflectivity
7. Mark asset as `approved` only after visual review.

## Catalog Integration

Each SKU should point to approved assets:

```json
{
  "sku": "LS-C-1013-010-DBK",
  "asset": "assets/LS-C-1013-010-DBK/main.png",
  "assets": {
    "main": "assets/LS-C-1013-010-DBK/main.png",
    "thumb": "assets/LS-C-1013-010-DBK/thumb.png",
    "source3d": "3d/assets/LS-C-1013-010-DBK/source.blend"
  },
  "quality": {
    "assetSource": "3d-calibrated",
    "assetStatus": "approved",
    "reviewedBy": "factory",
    "version": "2026-05-06-v1"
  }
}
```

## Approval Levels

Use explicit asset status:

- `missing`: no asset yet
- `draft-3d`: generated but not reviewed
- `calibrating`: being compared to real sample
- `approved`: allowed for customer-facing try-on
- `rejected`: do not use

## Recommendation

Start with 5 SKUs only:

- natural daily
- cat eye
- doll eye
- wispy/anime
- full volume

Do not scale to 100+ SKUs until these five pass visual review.
