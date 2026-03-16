# PageOn Video Web

`PageOn_video_web` 是 PageOn 视频分析产品的前端仓库。它负责搜索 YouTube 视频、发起分析请求、展示结构化文章、聊天、评论、收藏，以及打包浏览器扩展。

这个仓库不是独立运行的，开发和生产都默认依赖配套后端仓库 `../YouTube-process` 提供 `/api/*` 接口。

## 仓库定位

- 前端框架：React 19 + TypeScript + Vite
- UI：Tailwind CSS 4
- 路由：`vite-plugin-pages`
- 登录与互动数据：Supabase
- 后端代理：开发环境通过 Vite 将 `/api` 代理到 `YouTube-process`
- 扩展：同仓库内包含 Chrome Extension 代码和打包脚本

## 主要功能

- 支持输入 YouTube 链接或关键词
- 首页可直接调用后端搜索 YouTube 视频
- 结果页支持流式分析，渲染结构化文章和章节导航
- 支持聊天、评论、点赞、收藏、PDF 导出、关键结论图片
- 支持多语言切换
- 支持从浏览器扩展把当前 YouTube 视频带回 Web 应用分析

## 目录概览

```text
PageOn_video_web/
├── src/
│   ├── pages/               # 首页、结果页、收藏页等
│   ├── components/          # UI 组件和交互组件
│   ├── services/            # API、Supabase、评论/收藏/点赞服务
│   ├── contexts/            # 认证上下文
│   └── data/                # 本地示例数据
├── routes/                  # Nitro/H3 示例路由（当前业务主要走配套后端）
├── extension/               # 浏览器扩展源码
├── public/                  # 静态资源、扩展 zip 输出
├── ssl/                     # 本地 HTTPS 证书
└── scripts/                 # 扩展打包等脚本
```

## 先决条件

- Node.js 20+
- npm
- 配套后端仓库 `../YouTube-process`

可选：

- Supabase 项目，用于登录、评论、点赞、收藏

## 本地开发

### 1. 先启动后端

默认开发代理会把 `/api` 转发到 `https://localhost:5000`，所以请先启动 `YouTube-process`。

如果你的后端本地只跑 HTTP，请在前端环境变量里把 `VITE_BACKEND_TARGET` 改成 `http://localhost:5000`。

### 2. 配置环境变量

在仓库根目录创建 `.env.local`：

```bash
VITE_DEV_PORT=3000
VITE_BACKEND_TARGET=https://localhost:5000

# 可选：不配置时，登录/评论/收藏功能会降级或不可用
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

说明：

- 开发服务器默认使用仓库内 `ssl/server.crt` 和 `ssl/server.key`
- 默认访问地址是 `https://localhost:3000`
- 如果后端没有 HTTPS，可把 `VITE_BACKEND_TARGET` 改成 HTTP

### 3. 安装并启动

```bash
npm install
npm run dev
```

打开：

- Web: `https://localhost:3000`

## 常用脚本

```bash
npm run dev                # 本地开发
npm run build              # 构建 Web 应用
npm run preview            # 预览构建结果
npm run lint               # ESLint
npm run build:extension    # 构建浏览器扩展
npm run package:extension  # 打包 extension.zip
```

## 浏览器扩展

扩展源码在 `extension/`，构建和打包流程：

```bash
npm run build:extension
npm run package:extension
```

产物输出到：

- `extension/dist/`
- `public/extension.zip`

扩展会在 YouTube 页面注入入口，并把当前视频链接回传到 Web 应用。

## 与后端的协作关系

前端当前核心能力都依赖 `YouTube-process`：

- 搜索视频：`POST /api/search-youtube`
- 流式分析：`POST /api/process-video/stream`
- 聊天：`POST /api/chat`
- 翻译：`POST /api/translate-themes`
- PDF：`GET/POST /api/generate-pdf/{video_id}`
- 图片摘要：`POST /api/generate-key-takeaways-image`

如果后端不可用，首页搜索、分析结果页、聊天和导出都会受影响。

## Docker

仓库内提供了 Web 侧 Docker 构建：

```bash
docker compose up --build
```

默认映射：

- `http://localhost:3000`

注意：这个容器只负责前端静态资源和 Nginx 代理，业务接口仍需要配套后端服务。

## 当前状态说明

- `README` 已按真实代码结构重写
- 仓库名、`package.json` 名称和旧模板文案还未完全统一
- `routes/` 中保留了 Nitro 示例代码，但当前主业务 API 依赖配套 Python 后端
