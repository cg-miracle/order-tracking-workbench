# 阶段 0 进度（2026-11-10）

状态：实现及基础验证完成，等待用户审核；未进入阶段 1。

已完成：

- npm workspaces，React/MUI 基础主题及连通页面，Fastify 健康接口及静态托管，共享类型包。
- 项目 skill、AGENTS、环境变量示例、中文启动说明。
- typecheck、lint、4 个测试、生产 build、format:check 通过。
- 生产首页 HTTP 200，健康检查返回约定 JSON，未知 API HTTP 404。
- Vite 首页 HTTP 200，开发代理健康请求成功。
- skill 上次已通过官方校验。
- 不包含 SKU 数据或订单业务，不包含真实 API 凭据。

兼容性：

- typescript-eslint 8.25.0、React Router 7.1.5 兼容现有 Node 20.18。
- overrides 固定 light-my-request 6.6.0，避免新版 cookie 的 Node 22 要求。
- 显式声明测试环境 jsdom 和工具链 YAML，保证根工作区解析及 lockfile 一致性。
- 网络重试使用 D:/projects/.npm-cache，不修改全局 npm 配置。
- 旧依赖目录保留为 D:/projects/workbench-deps-backup-*，失败 lockfile 在项目外保留。

限制：基础页面通过 HTTP 与组件行为测试验证，尚未进行浏览器视觉验收。
下一阶段：审核通过后获取真实 SKU，检查字段、单位和缺失值。
