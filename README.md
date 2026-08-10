# LivePlay Lab

一个面向直播与活动组织者的 AI 轻应用产品案例：把一个玩法 Brief 转成可运行的浏览器互动原型、可 Remix 的规则模板，以及可用 Promptfoo 回归的 Coding Agent 评测集。

> 当前仓库已交付可运行的产品、3 个玩法模板、50 条评测任务和研究记录工具。访谈、无引导测试、真实模型评测与 V2 发布数据均保持为“待执行”，不伪造证据。

## 解决的问题

直播互动玩法通常停在文案或一次性脚本，难以回答三个问题：

1. 这个玩法能否被快速做成可演示的浏览器原型？
2. 生成它的 Coding Agent 是否能处理需求歧义、状态、异常和安全边界？
3. 主持人或活动组织者能否基于同一套规则复用、改造和验证？

LivePlay Lab 用“规则模板 -> 可运行微应用 -> 评测任务 -> 研究记录”把这四件事连到一起。

## 功能

- 玩法工作台：输入主题、目标、受众、时长与边界，生成候选方案。
- 可选真实模型 API：支持任意 OpenAI 兼容端点，经本机代理调用；API Key 不进入 localStorage 或 Git。
- 三个规则模板：关键词拼图、限时真知题、任务接力赛。
- 浏览器微应用预览：可点击、可反馈、可验证重复提交锁定。
- Remix：把方案规则保存为本机变体，并在刷新后重新载入。
- 评测与负例：50 条 Promptfoo 用例，覆盖需求理解、代码生成、自验证、安全与体验。
- 用户研究：5 个探索访谈和 5 个无引导测试的真实记录位与操作包。

## 本地运行

```powershell
npm install
npm run dev
```

打开 Vite 输出的地址，默认是 `http://localhost:5173`。本地方案无需网络或 API Key。

### 使用真实模型 API

另开一个终端：

```powershell
Copy-Item .env.example .env
# 编辑 .env，填写兼容端点、模型名和 API Key
npm run server
```

在网页右上角“模型 API”中开启“使用模型方案”，可以直接输入一次性 Key，或让服务读取 `.env`。密钥只用于当前调用；不要提交 `.env`。

### 运行测试与构建

```powershell
npm run test
npm run lint
npm run build
```

### 运行 Promptfoo 评测

配置用于评测的模型环境变量后再运行：

```powershell
$env:OPENAI_API_KEY = '...'
$env:OPENAI_BASE_URL = 'https://your-provider.example/v1'
npx promptfoo@latest eval -c evals/promptfooconfig.yaml
```

评测结果应保存为一次真实运行的导出物；仓库不预置或伪造通过率。

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [`docs/00-product-overview.md`](docs/00-product-overview.md) | 产品定位、范围与创新点 |
| [`docs/01-prd.md`](docs/01-prd.md) | MVP PRD、流程与验收 |
| [`docs/02-figma-flow.md`](docs/02-figma-flow.md) | 可在 Figma 复画的流程与节点 |
| [`docs/03-research-package.md`](docs/03-research-package.md) | 招募、访谈、同意与分析包 |
| [`docs/04-evaluation-plan.md`](docs/04-evaluation-plan.md) | Promptfoo 运行和失败分类 |
| [`docs/05-worklog.md`](docs/05-worklog.md) | 六周工作日志、反思与工具 |
| [`docs/06-operations.md`](docs/06-operations.md) | 本地运行、操作、录屏和发布步骤 |
| [`docs/07-portfolio-case.md`](docs/07-portfolio-case.md) | 作品集案例叙事 |
| [`docs/08-demo-recording-script.md`](docs/08-demo-recording-script.md) | 五分钟演示脚本 |
| [`docs/09-user-test-template.md`](docs/09-user-test-template.md) | 无引导测试记录模板 |

## 边界

- 这是独立浏览器演示，不连接抖音、淘宝、拼多多、腾讯或任何真实直播平台。
- 不收集真实用户身份或支付信息。
- 研究结论只在获得参与者同意、完成原始记录后才可写入作品集。
- 第三方 API 的条款、价格和数据处理规则由使用者自行确认。

## 参考

- [ByteDance AI Light Application Product Manager, role A25436](https://jobs.bytedance.com/campus/position/7667854712818174261/detail)
- [Promptfoo](https://github.com/promptfoo/promptfoo)
- [DeerFlow](https://github.com/bytedance/deer-flow)

## License

MIT. See [LICENSE](LICENSE).
