# 3D Lash Assets

This folder contains source files and scripts for calibrated 3D lash assets.

## Prototype SKU

Current prototype:

```text
TEST-C-1013-010-DBK
```

Files:

```text
assets/TEST-C-1013-010-DBK/params.json
assets/TEST-C-1013-010-DBK/notes.md
scripts/generate_lash_blender.py
```

## Run With Blender

From the project root:

```bash
blender --background --python lash-library/3d/scripts/generate_lash_blender.py -- \
  --params lash-library/3d/assets/TEST-C-1013-010-DBK/params.json
```

Expected outputs:

```text
lash-library/3d/assets/TEST-C-1013-010-DBK/source.blend
lash-library/3d/assets/TEST-C-1013-010-DBK/source.glb
lash-library/assets/TEST-C-1013-010-DBK/main.png
```

## Notes

The current workstation does not have the `blender` command installed, so the script has been prepared but not rendered locally.

After rendering, run:

```bash
node lash-library/scripts/validate.mjs --strict-assets
```

The website will use `lash-library/assets/TEST-C-1013-010-DBK/main.png` as the real SKU try-on asset.
