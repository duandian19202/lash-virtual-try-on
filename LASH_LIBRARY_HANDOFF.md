# 睫毛库线程与网站线程交接说明

本文档用于两个线程协作：

- 网站线程：负责网站功能、试戴交互、渲染效果、部署。
- 睫毛库线程：负责产品目录、SKU 数据、真实睫毛 PNG 素材、默认贴合参数。

当前不自动同步 GitHub。先在本地验证效果，确认后再统一提交和部署。

## 当前已有睫毛库文件

```text
lash-library/catalog.json
lash-library/schema.json
```

`catalog.json` 当前已经包含产品基础信息和程序渲染参数。网站线程后续会优先从这个文件接入厂家睫毛库，而不是继续把产品数据硬编码在 `app.js` 里。

## 睫毛库线程负责产出

### 1. 产品目录

主文件：

```text
lash-library/catalog.json
```

每个产品至少需要：

```json
{
  "id": "cat-deep-black",
  "sku": "LS-C-1013-010-DBK",
  "series": "Cat Eye",
  "category": "cat-eye",
  "nameZh": "小猫眼",
  "nameEn": "Soft Cat Eye",
  "color": "#0d0b0a",
  "colorName": "深黑",
  "lengthMm": "10-13mm",
  "curl": "C",
  "thicknessMm": "0.10",
  "material": "PBT",
  "tags": ["猫眼", "眼尾拉长", "日常"],
  "asset": "assets/LS-C-1013-010-DBK.png",
  "spikes": 25,
  "render": {
    "length": 0.54,
    "curve": 0.36,
    "thickness": 1.35,
    "fan": 1.15
  }
}
```

### 2. 真实睫毛素材

建议目录：

```text
lash-library/assets/
```

推荐命名：

```text
LS-C-1013-010-DBK_left.png
LS-C-1013-010-DBK_right.png
LS-C-1013-010-DBK_single.png
LS-C-1013-010-DBK_thumb.png
```

如果只有一张素材，优先提供：

```text
LS-C-1013-010-DBK_single.png
```

网站线程会先支持 `single` 自动镜像；后续再支持左右眼独立素材。

## 睫毛素材标准

- 格式：透明背景 PNG，WebP 可作为补充。
- 尺寸：建议宽 `1200-1800px`，高 `300-600px`。
- 内容：只保留睫毛本体，不要眼皮、皮肤、包装、白底、黑底。
- 姿态：横向摆放，睫毛尖朝上，睫毛根部靠近图片底部。
- 根部：不要硬黑边，要有透明过渡。
- 阴影：素材本身尽量少阴影或无阴影，网站会统一添加自然阴影。
- 留白：四周保留少量透明边距，不要裁切睫毛尖。

## 后续建议扩展字段

真实 PNG 接入后，建议在每个产品里增加 `assets` 和 `fit` 字段：

```json
{
  "assets": {
    "single": "assets/LS-C-1013-010-DBK_single.png",
    "left": "assets/LS-C-1013-010-DBK_left.png",
    "right": "assets/LS-C-1013-010-DBK_right.png",
    "thumb": "assets/LS-C-1013-010-DBK_thumb.png"
  },
  "fit": {
    "scale": 1,
    "lift": 0,
    "opacity": 0.92,
    "rootBlend": 0.55,
    "shadow": 0.35,
    "conceal": 1,
    "left": {
      "x": 0,
      "y": 0,
      "scale": 1,
      "rotate": 0
    },
    "right": {
      "x": 0,
      "y": 0,
      "scale": 1,
      "rotate": 0
    }
  }
}
```

字段说明：

- `assets.single`：单只睫毛，网站可自动镜像。
- `assets.left` / `assets.right`：左右眼独立素材，正式效果优先用这两个。
- `fit.scale`：该 SKU 默认整体大小。
- `fit.lift`：该 SKU 默认上下贴合高度。
- `fit.opacity`：睫毛透明度。
- `fit.rootBlend`：根部融合强度。
- `fit.shadow`：自然阴影强度。
- `fit.conceal`：原生睫毛遮盖强度。
- `fit.left/right`：左右眼独立微调默认值。

## 网站线程接入计划

网站线程后续按以下顺序接入：

1. 从 `lash-library/catalog.json` 加载产品目录。
2. 保留当前硬编码产品作为加载失败 fallback。
3. 如果产品有 `assets.single`，优先用真实 PNG。
4. 如果产品有 `assets.left/right`，左右眼分别使用对应素材。
5. 如果产品有 `fit`，点击款式时自动套用该 SKU 默认参数。
6. 界面继续保留手动微调，用于人工精修和默认参数校准。

## 交接规则

- 睫毛库线程不要改 `index.html`、`styles.css`、`app.js`，除非明确需要网站线程配合。
- 网站线程不要随意改 `lash-library/catalog.json` 的产品内容，只负责读取和渲染。
- 如果睫毛库线程要改字段结构，请同步更新 `lash-library/schema.json` 和本文档。
- 每次新增素材后，确保 `catalog.json` 中的路径能对应到真实文件。
- 产品数据先保证结构稳定，再追求数量。

## 当前状态

- 网站线程已有本地精修功能：左右眼 X/Y/大小/旋转、透明度、根部融合、阴影、遮盖柔和度。
- 睫毛库线程已有 `catalog.json` 和 `schema.json` 初稿。
- 下一步建议：睫毛库线程补真实 PNG 素材；网站线程接入 `catalog.json` 动态加载。

