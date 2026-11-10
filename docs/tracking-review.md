# 阶段 4 物流审核说明

状态：实现完成，待审核；未自动提交或推送。

## 接口与凭据

服务端使用 Australia Post Track Items：GET https://digitalapi.auspost.com.au/test/shipping/v1/track?tracking_ids=单号。
通过 Basic Auth 和 account-number 请求，支持 StarTrack consignment、Australia Post article 及嵌套 items 事件结构。
来源：[官方 Track Items](https://developers.auspost.com.au/apis/shipping-and-tracking/reference/track-items)、[官方测试环境 FAQ](https://developers.auspost.com.au/content/apis/shipping-and-tracking/info/api-resources/faq.html)。

凭据保存在项目根 .env，由 server.ts 启动时加载；环境变量优先于文件。该文件已被 Git 忽略。
.env.example 只有空变量，不提供测试凭据。前端不持有授权信息。

## 真实尝试

2026-11-10 实际请求题目两个单号，使用题目测试凭据和 StarTrack 测试账号：

- 2FWZ50008569：HTTP 200，首次耗时约 970ms。
- 2FWZ50008645：HTTP 200，首次耗时约 645ms。
- 适配器再次验证成功，均返回 Delivered in Full，最后事件时间 2025-02-13T11:49:59+11:00。
- 两个单号返回相同历史事件，属于测试环境响应，不能认为是当前样例订单的真实配送进度。
- 去除时间、描述、地点完全相同的重复事件，不改写日期或补造内容。

没有尝试创建订单、发货、收费或修改承运商数据。

## 降级与界面

7 秒请求超时，前端请求超时 10 秒。结果缓存 60 秒，同一包裹并发请求合并，刷新按钮不会绕过缓存。
官方文档说明 10 次/分钟限制；当前样例两个单号分别查询，不混用不同承运商类型。
这是本地评估应用的进程内缓存，不宣称具备多实例共享限流或生产部署能力。

401/403、429、非成功 HTTP、网络错误、超时、非 JSON、异常结构、无匹配单号、响应内 errors 和缺失状态/时间均明确返回 unavailable。
每个包裹独立处理，TNT 返回 not_implemented，不阻塞订单详情。
未配置凭据返回 unavailable，应用仍可启动。
成功时显示当前状态、最后更新时间及事件，并标注测试环境与缓存说明；初次加载和刷新有明确状态。
运费仍按计划为 0.00，未实现估算。

## 验证

受控测试覆盖成功、AP 嵌套记录、重复事件、字段缺失、单号不匹配、承运商业务错误、无效时间、401/403/429/500、超时、网络异常、非 JSON、缓存过期、并发复用、TNT 和包裹失败隔离。
前端测试覆盖真实状态结构展示与测试环境标识；真实承运商请求独立于自动化测试执行。

下一阶段：用户审核后再进行完整交付验证与 README 整理。

物流事件使用 MUI 纵向 Stepper，日期时间为 en-AU（日 月 年、12 小时），固定 Australia/Sydney 时区并显示 AEST/AEDT，避免依赖浏览器所在时区。新版页面已验证 390px 无整体横向溢出，59 个测试通过。
