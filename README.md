# Order Tracking Workbench

澳大利亚订单与物流工作台，使用 React、MUI 和 Node.js/Fastify。
支持订单列表、详情链接、SKU 匹配、GST 计算、收货信息及包裹追踪。页面为英文，说明为中文。


## 安装和运行

要求 Node.js 20.18.0、npm 10+，本项目在 Node 20.18.0 / npm 10.8.2 验证。
使用仓库 lockfile 安装，不需要数据库。

```sh
git clone https://github.com/cg-miracle/order-tracking-workbench.git
cd order-tracking-workbench
npm ci
npm run dev
```

开发页面：http://127.0.0.1:5173

健康接口：http://127.0.0.1:3001/api/health

首次运行可以不配置凭据；订单正常展示，物流显示不可用。
如需查询物流，复制根目录 .env.example 为 .env，通过安全渠道取得测试凭据后填写：
AUSPOST_API_KEY、AUSPOST_API_PASSWORD、AUSPOST_ACCOUNT_NUMBER。
TNT 适配器另读 TNT_TRACKING_USERNAME、TNT_TRACKING_PASSWORD，需具备 ExpressConnect Tracking 权限；不能假定 RTT 或 Weblinking 账户通用。
不要将凭据放在 VITE_ 变量中。根目录 .env 由后端启动入口自动读取，已有进程环境变量优先；修改后重启后端。

PORT 默认 3001，HOST 默认 127.0.0.1，留空使用默认值。
Vite 开发代理固定指向 3001，自定义开发后端端口时须同步修改 apps/web/vite.config.ts。

生产运行：

```sh
npm run build
npm start
```




## 技术与目录

源码按功能组织，测试与对应模块放在一起：

- `apps/api/src`：`orders/` 订单路由与计算、`tracking/` 物流服务与 TNT 适配器、`shipping/` 运费估算、`data/` 数据读取；根目录保留服务入口及应用装配。
- `apps/web/src`：`app/` 应用路由与主题、`features/orders/` 订单页面与查询 hooks、`features/tracking/` 物流展示、`shared/` API 客户端、通用组件及格式化；根目录保留 `main.tsx`。

| 模块                                 | 内容                                           |
| ------------------------------------ | ---------------------------------------------- |
| apps/web                             | React、MUI、React Router、TanStack Query、Vite |
| apps/api                             | Fastify、Zod 输入校验、decimal.js、dotenv      |
| packages/contracts                   | 前后端共享数据契约                             |
| data                                 | 样例订单、产品、包裹、原始查询及来源           |
| scripts/check-data.mjs               | 可重复的数据一致性检查                         |
| .agents/skills/order-app-engineering | 项目代码设计规范                               |
| docs                                 | 分阶段审核与最终验收记录                       |

Vite 6 与现有 Node 20.18 兼容；固定 light-my-request 6.6.0，避免新版本传递依赖要求 Node 22。
前端不计算业务金额，后端不依赖 UI。外部承运商返回先校验、转换为内部契约，再交给页面展示。

## 输入数据与扩展订单

后端启动时读取 data/orders.json、products.json、shipments.json，校验后保存在内存。
修改文件后重启。订单号、SKU 和金额不写死在业务逻辑中；题目提供的 9 个 SKU 是当前最小样例，不是系统支持上限。

| 类型      | 必要结构                                                                               |
| --------- | -------------------------------------------------------------------------------------- |
| Order     | id、orderedAt（YYYY-MM-DD）、status、recipient、items                                  |
| Recipient | company、name、phone、email、address                                                   |
| Address   | line1、suburb、state、postcode（字符串）、country（AU）                                |
| OrderItem | id、sku、quantity（正整数）、shipmentId                                                |
| Product   | sku、name、rrpAud（含 GST 的十进制字符串），description、weightKg、dimensionsCm 等可选 |
| Shipment  | id、orderId、carrier（auspost-startrack 或 tnt）、trackingNumber                       |

新增订单时添加其商品行、相关 SKU 产品和包裹记录。商品行只关联同一订单的包裹；ID 和 SKU 应唯一。
合法结构中新订单无需改代码。结构错误、重复键和孤立包裹阻止启动；缺失 SKU、非法数量、价格或商品包裹引用错误逐行提示，不提供误导性的完整总额。

商品资料通过题目类 SQL 网站实际查询 product_list，使用字段 SKU 过滤。允许离线保存 JSON，不在运行时查询该网站。
原始结果在 data/raw，查询和转换说明在 data/source-metadata.json。
重量 g 转 kg，尺寸 mm 转 cm，体积 mm³ 转 cm³；体积重独立保存，不能当作实际重量。
3 条句点描述被省略，1 条疑似截断描述保留；不推断产品规格、包装或医疗含义。

## 金额、税务和运费

RRP 已含 10% GST，使用 AUD。采用 decimal.js，ROUND_HALF_UP：

1. 不含税单价 = RRP / 1.10，内部保留精度。
2. 行小计 = 未舍入单价 × 数量，然后舍入到分。
3. 订单小计 = 已舍入行小计之和。
4. GST = 订单小计 × 10%，舍入到分。
5. 总额 = 小计 + GST + 运费，不额外叠加运费税。

显示单价为两位小数，不能用显示值反推行金额。
逐行舍入可能使最终金额与含税价直接求和有分币差异，当前两个样例各差 0.01，不隐藏补差。

| 订单              | 不含税小计 | GST    | 运费  | 总额 AUD |
| ----------------- | ---------- | ------ | ----- | -------- |
| PO-20251130-00072 | 1937.28    | 193.73 | 15.75 | 2146.76  |
| PO-20251203-00046 | 1504.55    | 150.46 | 15.75 | 1670.76  |

已实现题目允许的公式估算，界面明确提示不是承运商报价。费率为考核设计假设，不是 Australia Post 或 TNT 合同费率：

1. 发货邮编固定 2111；收货邮编取订单地址。以首位 2 作为简化同区，其他四位邮编为跨区；这不是实际承运商分区或偏远地区识别。
2. 按 shipmentId 分组商品；每组商品重量乘数量后求和，再加 0.25 kg 包装。体积优先使用长×宽×高（cm），否则使用接口中的volumeCm3；乘数量求和，再加 20% 包装空间。
3. 体积重 = 包装体积 / 5000（cm³/kg）。计费重量取实际重与体积重较大者，向上取整到 0.5 kg。5000 是模型假设，不使用源数据中来源不明确的体积重。
4. 每个非 TNT 包裹：同区 A$8 + A$1.50 × 计费 kg，跨区 A$12 + A$2.50 × 计费 kg。费率假定含税，不再加 GST。各包裹四舍五入到分后汇总为订单运费，后端加进订单总额一次。
5. TNT 当前接入权限未验证成功，按题目要求贡献 A$0.00。breakdown 返回各包裹金额及计费重，TNT 计费重为 null。
6. 非 TNT 包裹缺少有效商品、数量、重量或体积时，整个订单估算显示 unavailable、A$0.00 并解释缺失，避免把部分估算当完整报价。没有额外燃油、偏远、保险或危险品附加费；不包含真实打包优化。

## 接口与物流限制

| GET 接口                 | 返回                                      |
| ------------------------ | ----------------------------------------- |
| /api/health              | 健康状态                                  |
| /api/orders              | 订单摘要数组包装在 orders 字段中          |
| /api/orders/:id          | 订单详情、商品、issues、totals、shipments |
| /api/orders/:id/tracking | orderId 和各包裹独立结果                  |

订单不存在返回 404，参数不合法返回 400。
物流 queryStatus 为 available、unavailable 或 not_implemented，与订单原始状态独立。

Australia Post / StarTrack 使用题目指定的测试端点、Basic Auth 和 account-number：
https://digitalapi.auspost.com.au/test/shipping/v1/track

两个题目单号实际返回 HTTP 200、相同历史事件，不能视为当前订单实时状态。
页面明确标识测试环境，MUI 纵向步骤条显示事件，en-AU 日期时间使用 Australia/Sydney 时区及 AEST/AEDT。
承运商未给出完整状态和时间、HTTP 错误、超时或无效数据均降级；不生成虚假事件。TNT 已增加 ExpressConnect XML 适配器，保留单号并明确显示接口失败。

请求超时 7 秒，前端超时 10 秒。进程内按包裹缓存 60 秒，并合并并发请求，手动刷新不绕过缓存。
本应用是本地评估项目，没有多实例缓存、身份认证或生产级访问限流。

参考：[官方 Track Items](https://developers.auspost.com.au/apis/shipping-and-tracking/reference/track-items)、
[官方测试环境 FAQ](https://developers.auspost.com.au/content/apis/shipping-and-tracking/info/api-resources/faq.html)。

## 验证与实现难点

```sh
npm run data:check
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

自动化测试覆盖计算舍入、数据异常、订单隔离、接口、页面导航和错误、物流响应结构、超时、鉴权、缓存和失败隔离。
真实外部 API 尝试独立于自动化测试，测试不依赖外部网络或本地 .env。
最终使用独立干净检出验证 npm ci、构建和无凭据启动；详见 [最终验收](docs/final-review.md)。

主要难点：

- 查询网页示例表名和字段与实际表不一致。
- 数据单位和无效描述混杂：保留原始 JSON，标准化时明确转换和缺失处理。
- GST 和显示舍入易产生差异：统一十进制计算，用固定场景验证。
- 测试 API 返回历史示例：单独标明数据来源，保留不可用降级与原始时间。

## 数据与凭据安全

.env、依赖、构建产物和日志不进入 Git；.env.example 仅列空变量。
题目提供的联系人、地址和运单仍在样例中，属于订单输入，不是匿名数据。最终公开仓库前需确认允许发布，或使用明确标识的脱敏样例。
已对 Git 历史和前端构建产物扫描题目提供的 6 个凭据值，未发现匹配；该检查不是对所有潜在敏感信息的保证。

## 审核记录

[数据](docs/data-review.md) · [后端](docs/backend-review.md) ·
[前端](docs/frontend-review.md) · [物流](docs/tracking-review.md) · [最终验收](docs/final-review.md)

各文档记录其阶段当时的实现；以本 README 和最终验收为当前状态。
不包含支付、库存管理、数据库、登录或生产部署，公式运费估算已实现；TNT 适配器已实现，但真实账户权限与澳洲国内查询仍待承运商确认，不能视为已打通。
