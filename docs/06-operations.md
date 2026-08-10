# 运行、操作与发布手册

## 1. 环境

- Node.js 20+（推荐当前 LTS）。
- npm 10+。
- 可选：任意 OpenAI-compatible chat completions API。
- 可选：Promptfoo 用于真实模型回归。

## 2. 首次启动

```powershell
cd D:\VSCODE\project\liveplay-lab
npm install
npm run dev
```

浏览器打开终端输出的地址，通常为 `http://localhost:5173`。首次运行直接使用“本地方案”，无需 API Key。

## 3. 主路径操作

1. 进入“玩法工作台”，输入主题、本场目标、目标观众、预计时长和资源边界。
2. 选择“关键词拼图 / 限时真知题 / 任务接力赛”之一。先看色条和规则摘要确认已选中。
3. 选择“本地方案”，点击“生成可运行方案”。检查候选方案是否包含规则、口播、实现 Brief 和风险点。
4. 点击右侧微应用的主操作；确认反馈出现，重复点击不能重复记分或重复提交。
5. 点击“保存 Remix”，到“模板与 Remix”确认刷新后仍可以载入。
6. 复制规则、口播或视觉提示词，粘贴到文档或 Coding Agent 中进行下一轮工作。

## 4. 接入真实模型 API

**界面临时配置：** 点击右上“模型 API”，启用“使用模型方案”，输入兼容端点、模型名与 Key。Key 只在浏览器内存中存在到页面关闭或刷新，不会写入 localStorage。

**本机 `.env` 配置：**

```powershell
Copy-Item .env.example .env
# 编辑 .env：LLM_BASE_URL、LLM_API_KEY、LLM_MODEL
npm run server
```

前端生成时访问 `http://localhost:8788/api/generate`。本机代理不会记录 Key；请勿在浏览器控制台、截图、Issue、Git commit 或 README 中粘贴真实密钥。

### 失败排查

| 现象 | 检查顺序 |
| --- | --- |
| “模型调用未完成” | 先确认 `npm run server` 正在运行，再检查 Base URL 和模型名 |
| 401/403 | 确认 Key 权限和厂商账户状态；不要把 Key 发到聊天或仓库 |
| 返回非 JSON | 选择支持 JSON 输出的模型，或检查上游对 `response_format` 的兼容性 |
| CORS/端口错误 | 前端保持 Vite 默认 `5173`；代理保持 `8788`；不要直接从前端请求外部 Key |

## 5. 测试与验收

```powershell
npm run test
npm run lint
npm run build
```

浏览器验收至少覆盖：
- Desktop：选模板、编辑 Brief、本地生成、微应用交互、复制、Remix 保存与刷新恢复。
- Mobile 375px：导航、字段输入、主按钮、微应用不横向溢出。
- 失败路径：空主题、未启服务的模型模式、无 Key、模型返回不完整字段。

## 6. Promptfoo 执行

```powershell
$env:OPENAI_API_KEY = '...'
$env:OPENAI_BASE_URL = 'https://provider.example/v1'
npx promptfoo@latest eval -c evals/promptfooconfig.yaml
```

每次运行必须在记录中写明：执行日期、模型、Base URL（可脱敏）、提示版本、评审规则、成本、原始输出位置、失败编码、人工复核人。不要只截取“好看的”样例。

## 7. 真实研究执行

1. 使用 `docs/03-research-package.md` 招募 R01-R05 和 U01-U05。
2. 获得同意后，再开始访谈或录屏；原始笔记放在不提交 Git 的受控目录。
3. 每次无引导测试使用 `docs/09-user-test-template.md`，观察员前 10 分钟不提示。
4. 整理去标识化结论时，区分原话、观察事实和解释；5 个样本不推导总体结论。
5. 把真实证据映射到 V2 backlog，并在回归完成后更新产品状态。

## 8. 发布前检查

- [ ] `.env`、录屏原文件、用户可识别信息不在 Git 暂存区。
- [ ] 四项测试通过，且浏览器桌面/手机截图已检查。
- [ ] README 的功能、边界和状态与源码一致。
- [ ] 若声称“V2”或“研究发现”，有对应真实记录和日期。
- [ ] 录制演示前清空 API Key 字段，并确认没有个人账号/联系人出镜。
