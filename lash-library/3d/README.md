# 3D Lash Assets

This folder contains Blender-based source generation for realistic lash assets.

## Scope

This thread produces single-fiber lash assets only:

```text
single transparent PNG/WebP
root/tip anchor metadata
length, thickness, curl, color, material parameters
optional alternate angles or curl variants
```

The website composition thread is responsible for dynamic placement on the eye:

```text
eye/face detection
eyelid curve fitting
left/right eye mirroring
root fusion and occlusion
shadow and opacity
SKU density and style layout
```

## Public Website Contract

Each SKU has one public directory:

```text
lash-library/assets/SKU/fiber.png
lash-library/assets/SKU/params.json
lash-library/assets/SKU/variants/fiber-01.png
lash-library/assets/SKU/variants/fiber-02.png
```

`fiber.png` is the default/master fiber for quick use. `params.json` lists all optional variants and their root/tip anchors. The website thread should read only these files for single-fiber composition. It should not depend on Blender files or experiment outputs.

## Production Source

Production source lives here:

```text
production/single-fibers/configs/SKU/fiber-01.json
production/single-fibers/configs/SKU/fiber-02.json
production/single-fibers/renders/SKU/variants/fiber-01/main.png
production/single-fibers/renders/SKU/variants/fiber-01/metadata.json
```

Calibration and old try-on experiments live under `experiments/` and are not part of the website contract.

## Render And Publish

From the project root:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python lash-library/3d/scripts/render_single_fiber.py -- \
  --config-dir lash-library/3d/production/single-fibers/configs

node lash-library/3d/scripts/publish_single_fibers.mjs --all
```
