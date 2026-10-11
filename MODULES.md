# 公共模块索引

本文件记录仓库中已存在的能力。开发前阅读本索引，并搜索实际代码和调用方；新增或修改重要公共模块时同步维护。

开发规则见 [开发与维护规范](docs/development-guidelines.md)。部署和资源信息见 [README](README.md)。

## 当前架构

- Next.js App Router 使用根目录 `app/`，没有 `src/`，不要仅为统一形式移动目录。
- 使用 React、TypeScript strict 模式、Tailwind CSS 和 pnpm。
- `@/*` 指向仓库根目录，定义于 `tsconfig.json`。
- 首页为空白；暂无业务页面、Route Handler、Server Action 或业务数据模型。
- 已有 Request 和 Upload 公共模块；请求使用原生 fetch，上传使用官方 `@vercel/blob` SDK。未引入认证、状态管理、UI 组件、表单或 ORM 库。

## 已有代码与配置

### Request / API Client

- 位置：`lib/request/`。
- 用途：统一 JSON HTTP 请求、参数、Header、超时、取消和错误处理。
- API：`request.get/post/put/patch/delete/send<T>(path, options?)`、`createRequestClient(config?)`、`RequestError`。
- 参数、返回值、示例与边界：[Request 文档](docs/modules/request.md)。
- 当前调用方：`tests/request.test.mts`；暂无业务调用。

### Upload

- 位置：`lib/upload/`，上传函数必须从 `lib/upload/server.ts` 引入。
- 用途：私有 Blob 上传，统一文件校验、命名、进度和错误处理。
- API：`uploadFile/uploadImage/uploadDocument(file, options?)` 返回 `Promise<UploadResult>`；共享 `validateUpload`、类型策略常量与 `UploadError`。
- 参数、返回值、示例与边界：[Upload 文档](docs/modules/upload.md)。
- 当前调用方：两个上传快捷函数复用 `uploadFile`，测试覆盖校验与存储适配；暂无业务接口。
- 注意：仅服务端上传能力，尚无用户鉴权和浏览器上传入口。

### 根布局

- 位置：`app/layout.tsx`。
- 用途：统一 HTML 文档结构、中文语言属性、站点标题和全局样式入口。
- API：默认导出 `RootLayout({ children }: LayoutProps<"/">)`；导出 `metadata`。
- 参数：`children` 为 Next.js 注入的页面内容。
- 返回值：包含 `html`、`body` 和页面内容的 JSX。
- 使用方式：由 App Router 自动应用，业务页面不手动调用。
- 当前调用方：App Router，覆盖 `app/page.tsx`。
- 注意：认证、用户信息和权限能力尚未实现，不应假定布局已提供这些能力。

### 全局样式

- 位置：`app/globals.css`。
- 用途：导入 Tailwind CSS。
- 使用方式：`app/layout.tsx` 通过 `import "./globals.css"` 引入。
- 参数及返回值：不适用，属于样式资源。
- 当前调用方：根布局。
- 注意：暂无业务主题、组件样式库或设计 Token；按实际页面需求扩展。

### 部署配置

- 位置：`vercel.json`、`.vercelignore`、`.gitignore`。
- 用途：固定后端函数区域为伦敦 `lhr1`，排除不应上传或提交的本地文件。
- 主要配置：`regions`；不是可调用的应用 API，无函数参数或返回值。
- 使用方式：Vercel 部署时读取；例如运行 `vercel deploy --prod`。
- 当前使用方：Vercel CLI 和 Git 部署流程。
- 注意：`vercel.json` 中的函数区域不等于构建机器区域；`.env.local` 和 `.vercel/` 不提交 Git。

## 云端资源与应用接入状态

| 能力 | 现状 | 服务端配置入口 | 代码与调用方 |
| --- | --- | --- | --- |
| Neon Postgres | 已创建伦敦数据库并关联 Vercel | `DATABASE_URL`、`DATABASE_URL_UNPOOLED` | 无数据库客户端封装、ORM、Schema、迁移脚本或调用方 |
| Vercel Blob | 已创建巴黎私有存储并关联 Vercel | `BLOB_READ_WRITE_TOKEN` | 已有 `lib/upload/server.ts` 上传封装和共享校验；尚无业务调用或下载接口 |

凭据由 Vercel 集成管理；本地开发使用被 Git 忽略的 `.env.local`。它们仅供服务端使用，不使用 `NEXT_PUBLIC_` 前缀，也不写入日志、文档或提交内容。

生产、预览、开发环境目前共享上述资源。首次引入数据库写入、迁移或文件处理时必须考虑其影响范围。资源配置不等于已经具备上传、身份验证或访问控制能力。

## 尚未实现的公共能力

以下是能力盘点，不是要求一次性建设的任务清单。遇到实际需求时重新搜索仓库，优先复用或扩展当时已有的实现。

| 能力 | 当前状态与后续约束 |
| --- | --- |
| API Response | 暂无业务 API 或响应约定；Request 已统一传输错误，业务响应保持原样 |
| Auth / Session / Current User | 暂无认证方案、用户模型或用户状态；不自行选择供应商或添加用户表 |
| Permission | 暂无角色、权限 Key 或鉴权规则；基于实际业务需求统一设计 |
| Download / Storage 读写扩展 | 已有 Upload；下载、删除及客户端直传授权根据实际需求扩展，不另建重复上传模块 |
| Constants / Types / Configuration | 已有 Request、Upload 自身的类型及策略常量；暂无公共业务类型，不创建占位类型和枚举 |
| Notification / Logger | 暂无统一通知 UI 或日志模块；根据实际交互和运行需求确定实现 |
| Cache / Store / Context | 无应用级缓存和共享状态模块；不预先引入状态管理库 |
| Form / Validation | 无表单或校验机制；后续先检查原生和已有能力 |
| Modal / Table / Pagination / Search / Filter | 无业务组件或查询逻辑；出现需求时按职责复用 |
| Date / Money / String | 无格式化工具；仅在实际规则和复用价值明确时新增 |

## 后续模块记录要求

新增重要公共模块时，在“已有代码与配置”中新增条目，或链接详细的 `docs/modules/<模块名>.md`，同时更新上述能力状态。至少记录：

- 模块名称、用途和实际文件位置。
- 主要 API、参数、返回值和可用示例。
- 服务端或客户端边界、错误处理方式和其他注意事项。
- 当前实际调用方；没有调用方时明确说明，不编造使用情况。

这里不规定尚不存在的目录结构；模块落点按当时项目模式和单一职责决定。
