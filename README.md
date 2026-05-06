# Lash Studio Virtual Try-On

睫毛虚拟试戴网站原型。用户可以上传脸部照片或打开摄像头，选择厂家睫毛款式或上传自有睫毛 PNG 素材，在浏览器本地完成眼部识别和试戴预览。

## 本地运行

```bash
python3 -m http.server 5173
```

打开：

```text
http://127.0.0.1:5173/
```

## GitHub Pages 自动部署

本项目已包含 GitHub Actions 工作流：

```text
.github/workflows/deploy-pages.yml
```

推送到 GitHub 的 `main` 分支后，会自动部署到 GitHub Pages。

首次使用时，需要在 GitHub 仓库设置里确认：

1. 进入仓库 Settings。
2. 打开 Pages。
3. Source 选择 GitHub Actions。
4. 推送 `main` 分支，等待 Actions 完成。

部署成功后，GitHub 会生成 HTTPS 地址。手机打开该 HTTPS 地址后，可以调用手机摄像头。

## 重要文件

- `index.html`：页面结构
- `styles.css`：界面布局和视觉样式
- `app.js`：识别、试戴、素材库、交互逻辑
- `lash-library/`：厂家睫毛产品仓库，包含产品 JSON、字段规范、素材目录和校验脚本
- `models/face_landmarker.task`：本地人脸识别模型
- `vendor/mediapipe/tasks-vision/`：本地 MediaPipe 依赖
- `vendor/lucide/lucide.min.js`：本地图标库
- `PROJECT_CHECKLIST.md`：项目功能和后续开发清单

## 睫毛产品仓库

厂家款式不再写死在页面逻辑里，网站会读取：

```text
lash-library/catalog.json
```

新增或修改 SKU 后，运行：

```bash
node lash-library/scripts/validate.mjs
```

## 隐私说明

当前原型在浏览器本地处理照片和摄像头画面，不上传服务器。
