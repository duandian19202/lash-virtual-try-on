# Lash Library

This folder is the manufacturer lash product repository for the virtual try-on site.

## Structure

- `catalog.json`: product records used by the website.
- `schema.json`: field contract for product records.
- `KNOWLEDGE.md`: professional eyelash extension knowledge model for product data and realistic rendering.
- `docs/advanced-3d-pipeline.md`: high-quality calibrated 3D asset production workflow.
- `3d/`: source 3D assets, param templates, scripts, and offline renders.
- `assets/`: transparent PNG or WebP lash images, named by SKU.
- `scripts/validate.mjs`: basic catalog validator.

## Product Fields

Required fields for every SKU:

- `id`: stable internal product id.
- `sku`: manufacturer SKU.
- `series`: product series, such as `Natural Line` or `Cat Eye`.
- `category`: grouping used by the business.
- `nameZh`: Chinese product name.
- `color`: hex color used for generated preview.
- `colorName`: display color name.
- `lengthMm`: product length range.
- `curl`: curl grade, such as `B`, `C`, `D`, or `L`.
- `thicknessMm`: fiber thickness.
- `spikes`: generated preview lash count.
- `render`: generated preview parameters.

Optional fields:

- `nameEn`
- `material`
- `tags`
- `asset`

## Asset Rules

For real product assets, place files in `assets/` and name them with the SKU:

```text
assets/LS-C-1013-010-DBK.png
```

Recommended image format:

- Transparent PNG or WebP.
- Complete upper lash strip for that SKU, not a program-generated line preview.
- Lash root close to the bottom edge of the image.
- Horizontal layout.
- Width 1000px or higher.
- One product asset per SKU is required for real try-on.

## Validate

Run:

```bash
node lash-library/scripts/validate.mjs
```

Strictly check that every SKU asset file exists:

```bash
node lash-library/scripts/validate.mjs --strict-assets
```

## Realistic Rendering Direction

Before adding production-grade SKUs, read `KNOWLEDGE.md`. The live website should use real transparent SKU assets for try-on. Procedural drawing is not the product source of truth; it can only be used internally for rough planning, not as a customer-facing lash database.
