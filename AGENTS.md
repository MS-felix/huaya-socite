# 项目协作规则

所有回答使用中文；专业名词和固定组合可以使用英文。

## 开始任务前

1. 阅读 [开发与维护规范](docs/development-guidelines.md) 和 [公共模块索引](MODULES.md)。开发与维护规范是本项目的长期约束，索引必须与实际代码核对。
2. 搜索当前目录结构及相关实现、调用方、类型、常量和依赖；不能只依赖文档推断某项能力不存在。
3. 按“直接复用 → 扩展已有模块 → 抽离已有相似逻辑 → 新建公共模块 → 页面内独立实现”的顺序评估，确定最小修改范围后再编码。
4. 涉及 Next.js 时，先阅读当前安装版本 `node_modules/next/dist/docs/` 中的相关文档。

## 实现约束

- 复用现有架构、公共 API、组件、Hook、类型和第三方依赖，不随意替换技术方案或重构无关代码。
- Request/API Client、认证、Session、当前用户、权限、上传、存储和错误处理等基础能力按职责统一维护；业务页面不重复实现。
- 公共模块按明确职责命名，避免将无关能力堆进 `utils.ts`、`common.ts`、`helper.ts` 等文件。
- 页面主要负责 UI、页面状态和交互；共享请求、转换、权限、上传等逻辑放入对应模块。
- 常量、配置、路由、权限标识和公共数据类型统一维护；避免重复类型和为了方便使用 `any`。
- 修改公共模块前查明调用方和影响，尽量保持原 API 兼容，沿用已有响应格式和错误处理机制。
- 添加依赖前检查已有实现、原生能力和现有库，避免引入功能重复或不必要的依赖。
- 只在需求和复用价值明确时新增模块，不预先创建空壳或为未来假设增加复杂功能。
- 未经需求支持，不更改产品逻辑、交互、数据库结构、字段、接口格式或权限规则。

## 完成任务前

- 检查重复实现、不必要依赖、公共 API 兼容性、类型及代码风格，并主动修正问题。
- 执行与改动相关的验证，说明结果及未验证部分；文档变更不要求重复执行应用构建。
- 新增或修改重要公共模块时，同步更新 `MODULES.md`，记录用途、位置、主要 API、参数、返回值、示例、注意事项和调用方。
- 区分“云端资源已配置”和“应用代码已实现”，不能将规划中的能力写成已完成。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
