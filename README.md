# huaya-socite

基于 Next.js App Router、React、TypeScript 和 Tailwind CSS 的项目。
首页为空白，尚未添加业务页面或数据。

## 开发协作

开始开发前阅读 [AGENTS.md](AGENTS.md)、[开发与维护规范](docs/development-guidelines.md) 和 [公共模块索引](MODULES.md)。先检查已有实现，优先复用或扩展；新增重要公共模块时同步更新索引。

## 本地开发

使用 pnpm 安装依赖并启动开发服务：

```bash
pnpm install
pnpm dev
```

访问 http://localhost:3000。

## 检查与构建

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`pnpm start` 用于启动构建后的生产服务，需要先运行 `pnpm build`。

测试使用 Node.js 24 的内置测试运行器、TypeScript 类型剥离和实验性模块 Mock，无需额外测试依赖。`pnpm test` 不访问云端资源。测试和公共模块内部使用显式 `.ts` 导入，对应 `tsconfig.json` 的 `allowImportingTsExtensions`。

## 基础模块

- [Request](docs/modules/request.md)：原生 fetch 的统一 JSON API 客户端，支持参数、Header、超时、取消和错误处理。
- [Upload](docs/modules/upload.md)：服务端私有 Blob 上传和可复用的文件校验，提供文件、图片、文档三种入口；尚未开放浏览器上传接口。

## 部署与存储

Vercel 项目：`anhuifelix-4955s-projects/huaya-socite`，已关联 GitHub 仓库 `MS-felix/huaya-socite`。

- 后端函数：英国伦敦 `lhr1`，由 `vercel.json` 固定，与数据库同区域。
- Neon：`huaya-socite-db-lhr1`，Free 套餐，英国伦敦 `lhr1`。
- Vercel Blob：`huaya-socite-blob`，私有访问，法国巴黎 `cdg1`。
- 区域面向几内亚用户选择：Neon 当前可选区域中伦敦较近；Blob 使用巴黎，静态页面由 Vercel CDN 分发。实际延迟取决于用户网络线路。
- 两项资源均已连接 Production、Preview、Development 环境；目前这些环境共享资源。
- 数据库连接使用 `DATABASE_URL`，文件存储使用 `BLOB_READ_WRITE_TOKEN`，仅供服务端使用。

新环境先关联项目，再同步开发环境变量：

```bash
vercel link --yes --project huaya-socite --scope anhuifelix-4955s-projects
vercel env pull .env.local --yes
```

`.env.local` 和 `.vercel/` 已被 Git 忽略，不应提交凭据。

手动发布当前本地代码到生产环境：

```bash
vercel deploy --prod
```
