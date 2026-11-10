---
name: order-app-engineering
description: Implement or review this Order Tracking Workbench React/MUI and Fastify project while preserving its data contracts, calculation rules, architecture boundaries, and staged review workflow.
---

# 项目工程规范

## 开始修改

读取根目录 AGENTS.md 和 README.md，确认当前审核阶段；只完成用户授权的阶段。
涉及数据、计算或物流时读取 [业务规则](references/domain-rules.md)。
选择检查与报告时读取 [验证要求](references/verification.md)。

## 架构边界

- apps/web：React + MUI。页面组织业务组件，请求由 API 客户端及 TanStack Query hooks 承担；订单选择写入路由，不增加无实际需要的全局状态库。
- MUI 主题统一颜色、字体和间距；组件使用主题 token 和 sx，不重复硬编码配色。
- apps/api：路由处理协议和边界校验，服务编排用例，领域函数完成匹配与计算，数据模块读取 JSON，承运商适配器转换外部响应。
- 使用普通函数和模块；只有实际重复或复杂度证明需要时才提取抽象，不默认增加类、依赖注入或通用仓储。
- packages/contracts：公共类型和数据契约。不可依赖服务端模块、凭据或外部 API SDK。
- 计算只在后端，前端负责金额格式化；业务代码不得硬编码订单编号、SKU 判断或计算总额。

## 代码与边界

TypeScript strict；不使用无依据的 any 或类型断言绕过外部数据校验。
英文标识符和页面文案，中文 README；注释说明业务原因。
区分输入校验失败、资源不存在和外部服务不可用；不要吞掉异常或返回看似成功的空数据。
请求有超时，凭据只在后端读取，日志不得包含授权头、密码或完整客户资料。
不把测试响应、占位事件或假价格放入实际运行路径。

## 完成阶段

运行与改动相关的检查，更新实际实现状态和限制，报告完成内容、验证证据、剩余问题及下一阶段范围。
完成一个阶段后停止，等待用户审核通过；不自行进入下一阶段或引入加分功能。

## 排版与简洁性

- 顶层类型、schema、函数和各路由之间留一行空行；函数内按准备数据、校验、计算、返回分组。
- 同一职责内的连续变量可放在一起，不同职责的变量和语句组用空行分开；测试按准备、执行、断言分组，各用例之间留空行。
- 条件分支使用花括号。优先清晰的提前返回，避免多层嵌套和重复三元表达式。
- 只在输入边界校验结构，在领域层保留具体业务规则；已确认的不变量不要在多层重复校验。
- 不为已校验数据添加静默默认值或无意义的兜底；不添加纯粹假设性异常处理。
- 避免无必要的 JSON 序列化往返、中间变量、通用封装；保留类型收窄所需的检查，不用断言掩盖未校验输入。
