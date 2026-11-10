# Order Tracking Workbench

澳大利亚订单与物流工作台。当前仅完成阶段 0，订单数据、金额计算和真实物流接口尚未实现。

## 环境与启动

Node.js 20.18.0 或兼容的更新版本，npm 10+。当前采用兼容现有环境的 Vite 6。

在项目根目录执行：

```sh
npm ci
npm run dev
```

前端：http://127.0.0.1:5173

后端健康检查：http://127.0.0.1:3001/api/health

开发代理默认指向 3001。更改后端端口时也需调整 Vite 代理。

生产模式：

```sh
npm run build
npm start
```

访问 http://127.0.0.1:3001。Fastify 提供前端构建文件及 API。

阶段 0 不需要凭据。未来在服务端通过环境变量提供 API 配置；.env.example 只列出空变量，真实 .env 不入库。当前启动命令不会自动读取 .env，请使用进程环境变量。

## 目录与检查

- apps/web：React、MUI、路由和健康检查页面。
- apps/api：Fastify 启动、健康检查和静态资源托管。
- packages/contracts：前后端共享契约。
- .agents/skills/order-app-engineering：项目代码设计规范。

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

## 分阶段审核

0. 项目骨架与规范（当前，待审核）。
1. 真实 SKU 数据及字段、单位、缺失值检查。
2. 后端匹配、金额计算和接口。
3. 订单详情界面。
4. 物流及加载、失败状态。
5. 完整验证、中文说明和启动交付。

每阶段完成后停止，由用户审核通过再继续。完整业务规则和验收约束见项目 skill 的 references。

## 工具链兼容性

固定 light-my-request 6.6.0 以支持当前 Node 20.18，后续升级 Node 后再评估解除 overrides。
当前机器默认缓存曾因 C 盘空间不足而失败，可执行 npm ci --cache=D:/projects/.npm-cache；无需修改全局配置。
阶段 0 检查结果见 STAGE-0-STATUS.md。当前等待用户审核，尚未进入 SKU 数据阶段。
