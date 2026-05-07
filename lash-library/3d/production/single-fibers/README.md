# Single Fiber Production

This directory is the production source for single realistic lash fibers.

## Contract

Each SKU keeps its production source and public website asset separated:

```text
lash-library/3d/production/single-fibers/configs/SKU/fiber-01.json
lash-library/3d/production/single-fibers/configs/SKU/fiber-02.json
lash-library/3d/production/single-fibers/renders/SKU/variants/fiber-01/main.png
lash-library/3d/production/single-fibers/renders/SKU/variants/fiber-01/metadata.json

lash-library/assets/SKU/fiber.png
lash-library/assets/SKU/params.json
lash-library/assets/SKU/variants/fiber-01.png
lash-library/assets/SKU/variants/fiber-02.png
```

The website composition thread reads only:

```text
lash-library/assets/SKU/fiber.png
lash-library/assets/SKU/params.json
lash-library/assets/SKU/variants/*.png
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

This copies the default rendered fiber to `lash-library/assets/SKU/fiber.png`, copies each variant to `lash-library/assets/SKU/variants/`, and writes the variant list plus root/tip anchors into `params.json`.

## Quality Check Renders

`root-detail.png`, `tip-detail.png`, and `preview-gray.png` are production QA files only. They help check root thickness, hard seams, anchor position, tip taper, translucency, and material highlights. The website composition thread should not load these detail images.
