# Single Fiber Production

This directory is the production source for single realistic lash fibers.

## Contract

Each SKU keeps its production source and public website asset separated:

```text
lash-library/3d/production/single-fibers/configs/SKU.json
lash-library/3d/production/single-fibers/renders/SKU/main.png
lash-library/3d/production/single-fibers/renders/SKU/metadata.json

lash-library/assets/SKU/fiber.png
lash-library/assets/SKU/params.json
```

The website composition thread reads only:

```text
lash-library/assets/SKU/fiber.png
lash-library/assets/SKU/params.json
```

The 3D source, Blender scripts, calibration renders, and experiments stay under `lash-library/3d/`.

## Render

From the project root:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python lash-library/3d/scripts/render_single_fiber.py -- \
  --config-dir lash-library/3d/production/single-fibers/configs
```

## Publish

After rendering:

```bash
node lash-library/3d/scripts/publish_single_fibers.mjs --all
```

This copies each rendered `main.png` to `lash-library/assets/SKU/fiber.png` and writes `params.json`.
