import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Clipboard, ExternalLink, Eye, FileText, FlaskConical, LayoutTemplate, Lightbulb, Menu, Play, Plus, RotateCcw, Settings2, Sparkles, Users, X } from 'lucide-react';
import { evaluationCases, researchSeats, templates, testSeats } from './data';
import { createLocalPlan, defaultTemplate, planFromApi } from './lib/generation';
import type { Brief, PlayPlan, PlayTemplate, TemplateId } from './types';
import './App.css';

type View = 'workbench' | 'templates' | 'evaluation' | 'research' | 'evidence';

const defaultBrief: Brief = {
  theme: '新生游戏夜',
  objective: '让新观众在开场 10 分钟内完成一次低门槛互动',
  audience: '第一次参与社团直播的大一新生',
  duration: '12 分钟',
  constraints: '主持人 1 人；不接平台账户、支付、私信或真实用户数据',
};

const navItems: Array<{ id: View; label: string; icon: typeof Play }> = [
  { id: 'workbench', label: '玩法工作台', icon: Play },
  { id: 'templates', label: '模板与 Remix', icon: LayoutTemplate },
  { id: 'evaluation', label: '评测与负例', icon: FlaskConical },
  { id: 'research', label: '用户研究', icon: Users },
  { id: 'evidence', label: '作品集证据', icon: FileText },
];

function App() {
  const [view, setView] = useState<View>('workbench');
  const [brief, setBrief] = useState<Brief>(defaultBrief);
  const [activeTemplateId, setActiveTemplateId] = useState<TemplateId>(defaultTemplate.id);
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) ?? defaultTemplate;
  const [plan, setPlan] = useState<PlayPlan>(() => createLocalPlan(defaultBrief, defaultTemplate));
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState('');
  const [apiOpen, setApiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', apiKey: '' });
  const [useApi, setUseApi] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [remixes, setRemixes] = useState<Array<{ id: string; name: string; templateId: TemplateId; rules: string[] }>>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [evalGroup, setEvalGroup] = useState<'全部' | '需求理解' | '代码生成' | '自验证' | '安全与体验'>('全部');

  useEffect(() => {
    const saved = window.localStorage.getItem('liveplay-remixes-v1');
    const savedReviewed = window.localStorage.getItem('liveplay-reviewed-v1');
    if (saved) {
      try { setRemixes(JSON.parse(saved)); } catch { window.localStorage.removeItem('liveplay-remixes-v1'); }
    }
    if (savedReviewed) {
      try { setReviewed(JSON.parse(savedReviewed)); } catch { window.localStorage.removeItem('liveplay-reviewed-v1'); }
    }
  }, []);

  useEffect(() => { window.localStorage.setItem('liveplay-remixes-v1', JSON.stringify(remixes)); }, [remixes]);
  useEffect(() => { window.localStorage.setItem('liveplay-reviewed-v1', JSON.stringify(reviewed)); }, [reviewed]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredCases = useMemo(() => evaluationCases.filter((item) => evalGroup === '全部' || item.group === evalGroup), [evalGroup]);
  const reviewedCount = reviewed.length;

  function updateBrief(field: keyof Brief, value: string) {
    setBrief((current) => ({ ...current, [field]: value }));
  }

  async function generatePlan() {
    if (!brief.theme.trim() || !brief.objective.trim()) {
      setToast('先补充主题和目标，才能生成可评审的方案。');
      return;
    }
    setIsGenerating(true);
    const fallback = createLocalPlan(brief, activeTemplate);
    try {
      if (!useApi) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setPlan(fallback);
        setToast('已生成本地可运行方案。');
        return;
      }
      const response = await fetch('http://localhost:8788/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, template: activeTemplate, config: apiConfig }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '模型服务未返回可用方案');
      setPlan(planFromApi(result.plan, fallback));
      setToast('已生成模型方案；请在评测区记录复核结论。');
    } catch (error) {
      setPlan(fallback);
      setToast(`模型调用未完成，已保留本地方案：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function selectTemplate(template: PlayTemplate) {
    setActiveTemplateId(template.id);
    setAnswered(null);
    setScore(0);
  }

  function saveRemix() {
    const name = `${activeTemplate.name}｜${brief.theme.trim() || '未命名主题'}`;
    setRemixes((current) => [{ id: crypto.randomUUID(), name, templateId: activeTemplate.id, rules: plan.rules }, ...current]);
    setToast('已保存到本机 Remix 库。');
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${label}已复制。`);
    } catch {
      setToast(`浏览器未授权剪贴板，请手动选择${label}。`);
    }
  }

  function toggleReviewed(id: string) {
    setReviewed((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark">LP</span><span>LivePlay Lab</span></div>
        <p className="sidebar-caption">直播互动玩法生成与评测工作台</p>
        <nav aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(id); setMenuOpen(false); }}><Icon size={18} />{label}</button>)}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> 研究证据：待执行 / 可记录</div>
      </aside>
      <main>
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div><p className="eyebrow">INDEPENDENT PRODUCT CASE</p><h1>{navItems.find((item) => item.id === view)?.label}</h1></div>
          <div className="topbar-actions"><button className="quiet-button" onClick={() => setApiOpen(true)}><Settings2 size={17} />模型 API</button><button className="quiet-button" onClick={() => setView('evidence')}><FileText size={17} />材料</button></div>
        </header>
        {view === 'workbench' && <Workbench brief={brief} plan={plan} activeTemplate={activeTemplate} templates={templates} answered={answered} score={score} isGenerating={isGenerating} useApi={useApi} onUpdateBrief={updateBrief} onTemplate={selectTemplate} onGenerate={generatePlan} onSaveRemix={saveRemix} onCopy={copyText} onAnswer={(answer) => { if (!answered) { setAnswered(answer); if (answer === '真') setScore((value) => value + 1); } }} onUseApi={setUseApi} />}
        {view === 'templates' && <TemplatesView templates={templates} remixes={remixes} onTemplate={(template) => { selectTemplate(template); setView('workbench'); }} onLoadRemix={(remix) => { const template = templates.find((item) => item.id === remix.templateId) ?? defaultTemplate; selectTemplate(template); setPlan((current) => ({ ...current, title: remix.name, rules: remix.rules, source: 'local' })); setView('workbench'); }} />}
        {view === 'evaluation' && <EvaluationView cases={filteredCases} evalGroup={evalGroup} reviewed={reviewed} reviewedCount={reviewedCount} onGroup={setEvalGroup} onToggle={toggleReviewed} />}
        {view === 'research' && <ResearchView />}
        {view === 'evidence' && <EvidenceView />}
      </main>
      {toast && <div className="toast"><Check size={16} />{toast}</div>}
      {apiOpen && <ApiModal config={apiConfig} useApi={useApi} onClose={() => setApiOpen(false)} onConfig={setApiConfig} onUseApi={setUseApi} />}
    </div>
  );
}

function Workbench({ brief, plan, activeTemplate, templates: allTemplates, answered, score, isGenerating, useApi, onUpdateBrief, onTemplate, onGenerate, onSaveRemix, onCopy, onAnswer, onUseApi }: { brief: Brief; plan: PlayPlan; activeTemplate: PlayTemplate; templates: PlayTemplate[]; answered: string | null; score: number; isGenerating: boolean; useApi: boolean; onUpdateBrief: (field: keyof Brief, value: string) => void; onTemplate: (template: PlayTemplate) => void; onGenerate: () => void; onSaveRemix: () => void; onCopy: (text: string, label: string) => void; onAnswer: (answer: string) => void; onUseApi: (value: boolean) => void }) {
  return <div className="workbench-page">
    <section className="brief-column" aria-label="玩法 Brief">
      <div className="section-heading"><div><p className="eyebrow">01 / INPUT</p><h2>玩法 Brief</h2></div><span className="pill">可编辑</span></div>
      <label>主题<input value={brief.theme} onChange={(event) => onUpdateBrief('theme', event.target.value)} /></label>
      <label>本场目标<textarea rows={3} value={brief.objective} onChange={(event) => onUpdateBrief('objective', event.target.value)} /></label>
      <label>目标观众<input value={brief.audience} onChange={(event) => onUpdateBrief('audience', event.target.value)} /></label>
      <div className="field-row"><label>预计时长<input value={brief.duration} onChange={(event) => onUpdateBrief('duration', event.target.value)} /></label><label>模式<select value={useApi ? 'api' : 'local'} onChange={(event) => onUseApi(event.target.value === 'api')}><option value="local">本地方案</option><option value="api">模型方案</option></select></label></div>
      <label>资源与边界<textarea rows={4} value={brief.constraints} onChange={(event) => onUpdateBrief('constraints', event.target.value)} /></label>
      <div className="template-picker"><p className="label-text">选择规则模板</p>{allTemplates.map((template) => <button key={template.id} className={activeTemplate.id === template.id ? 'template-choice selected' : 'template-choice'} onClick={() => onTemplate(template)}><span className="template-swatch" style={{ backgroundColor: template.color }} /><span><b>{template.name}</b><small>{template.shortName}</small></span><ChevronRight size={16} /></button>)}</div>
      <button className="primary-button full" onClick={onGenerate} disabled={isGenerating}><Sparkles size={18} />{isGenerating ? '正在组织方案...' : useApi ? '调用模型生成' : '生成可运行方案'}</button>
      <p className="field-note">{useApi ? '调用经本机 8788 端口；密钥不会保存。' : '本地方案用于快速原型与无网络演示。'}</p>
    </section>
    <section className="plan-column" aria-label="候选方案">
      <div className="section-heading"><div><p className="eyebrow">02 / REVIEW</p><h2>候选方案</h2></div><span className={plan.source === 'api' ? 'pill api' : 'pill'}>{plan.source === 'api' ? '模型输出' : '本地草案'}</span></div>
      <article className="plan-intro"><div className="plan-number" style={{ backgroundColor: activeTemplate.color }}>01</div><div><h3>{plan.title}</h3><p>{plan.summary}</p></div></article>
      <PlanBlock title="玩法规则" action="复制规则" onAction={() => onCopy(plan.rules.join('\n'), '规则')}><ol>{plan.rules.map((rule) => <li key={rule}>{rule.replace(/^\d+\.\s*/, '')}</li>)}</ol></PlanBlock>
      <PlanBlock title="主持人口播" action="复制口播" onAction={() => onCopy(plan.hostScript, '口播')}><p className="script-text">{plan.hostScript}</p></PlanBlock>
      <PlanBlock title="Coding Agent 实现 Brief"><p className="script-text">{plan.codeBrief}</p></PlanBlock>
      <PlanBlock title="风险与验证点"><ul className="risk-list">{plan.riskNotes.map((note) => <li key={note}>{note}</li>)}</ul></PlanBlock>
      <div className="plan-actions"><button className="quiet-button" onClick={onSaveRemix}><Plus size={17} />保存 Remix</button><button className="quiet-button" onClick={() => onCopy(plan.visualPrompt, '视觉提示词')}><Clipboard size={17} />复制视觉提示词</button></div>
    </section>
    <section className="preview-column" aria-label="浏览器微应用预览">
      <div className="section-heading"><div><p className="eyebrow">03 / PROTOTYPE</p><h2>浏览器微应用</h2></div><span className="pill demo"><Eye size={14} />演示态</span></div>
      <p className="preview-note">中性演示皮肤，不连接任何直播平台、账号或真实数据。</p>
      <div className="device" style={{ '--template-color': activeTemplate.color } as React.CSSProperties}>
        <div className="device-top"><span className="live-dot">LIVE</span><span>{brief.theme || '未命名主题'}</span><span>第 1 / 3 轮</span></div>
        <div className="device-body">
          <span className="round-label">{activeTemplate.name}</span>
          <h3>{activeTemplate.id === 'word-puzzle' ? '三张线索，拼出今晚的关键词' : activeTemplate.id === 'truth-rush' ? '“开黑前热身”是活动的第一环吗？' : '一起把新生破冰进度推到 20 / 20'}</h3>
          <p>{activeTemplate.id === 'word-puzzle' ? '线索：新朋友 / 协作 / 章节开始' : activeTemplate.id === 'truth-rush' ? '8 秒内作答，答对即可进入连胜。' : '点击加入接力，为全场解锁下一任务。'}</p>
          {activeTemplate.id === 'truth-rush' ? <div className="answer-row"><button disabled={!!answered} className={answered === '真' ? 'answer correct' : 'answer'} onClick={() => onAnswer('真')}>真</button><button disabled={!!answered} className={answered === '假' ? 'answer wrong' : 'answer'} onClick={() => onAnswer('假')}>假</button></div> : <button className={answered ? 'preview-action done' : 'preview-action'} onClick={() => onAnswer('参与')} disabled={!!answered}>{answered ? <><Check size={18} />已加入互动</> : activeTemplate.id === 'relay' ? '加入这一棒' : '提交我的答案'}</button>}
          {answered && <div className="feedback"><Check size={16} />{activeTemplate.id === 'truth-rush' ? `本题揭晓：正确，当前积分 ${score}` : '动作已反馈给演示进度'}</div>}
        </div>
        <div className="device-progress"><span style={{ width: answered ? '72%' : '34%' }} /><small>{answered ? '36 / 50 人完成' : '17 / 50 人完成'}</small></div>
      </div>
      <div className="prototype-checks"><p className="label-text">本轮自检</p><span><Check size={15} />重复点击锁定</span><span><Check size={15} />空状态可回退</span><span><Check size={15} />移动端布局</span></div>
    </section>
  </div>;
}

function PlanBlock({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) { return <section className="plan-block"><div className="block-heading"><h3>{title}</h3>{action && <button className="text-button" onClick={onAction}>{action}</button>}</div>{children}</section>; }

function TemplatesView({ templates: allTemplates, remixes, onTemplate, onLoadRemix }: { templates: PlayTemplate[]; remixes: Array<{ id: string; name: string; templateId: TemplateId; rules: string[] }>; onTemplate: (template: PlayTemplate) => void; onLoadRemix: (remix: { id: string; name: string; templateId: TemplateId; rules: string[] }) => void }) { return <div className="content-page"><section className="page-intro"><p className="eyebrow">RULE SYSTEM</p><h2>三个可复用的玩法模板</h2><p>模板不是一套静态文案，而是由触发条件、参与动作、反馈节奏和风险边界组成的可 Remix 规则集。</p></section><div className="template-grid">{allTemplates.map((template, index) => <article className="template-card" key={template.id}><span className="card-index" style={{ color: template.color }}>0{index + 1}</span><h3>{template.name}</h3><p>{template.tagline}</p><dl><dt>适用</dt><dd>{template.useCase}</dd><dt>规则</dt><dd>{template.rules.length} 条核心规则</dd></dl><button className="quiet-button" onClick={() => onTemplate(template)}>载入工作台 <ChevronRight size={16} /></button></article>)}</div><section className="remix-section"><div className="section-heading"><div><p className="eyebrow">LOCAL LIBRARY</p><h2>我的 Remix</h2></div><span className="pill">本机保存</span></div>{remixes.length ? <div className="remix-list">{remixes.map((remix) => <button className="remix-row" key={remix.id} onClick={() => onLoadRemix(remix)}><span className="remix-icon"><RotateCcw size={17} /></span><span><b>{remix.name}</b><small>{remix.rules.length} 条规则 · 刷新后仍可加载</small></span><ChevronRight size={18} /></button>)}</div> : <div className="empty-state"><LayoutTemplate size={25} /><p>还没有保存的变体。先在玩法工作台生成方案，再保存为 Remix。</p></div>}</section></div>; }

function EvaluationView({ cases, evalGroup, reviewed, reviewedCount, onGroup, onToggle }: { cases: typeof evaluationCases; evalGroup: '全部' | '需求理解' | '代码生成' | '自验证' | '安全与体验'; reviewed: string[]; reviewedCount: number; onGroup: (value: '全部' | '需求理解' | '代码生成' | '自验证' | '安全与体验') => void; onToggle: (id: string) => void }) { const groups = ['全部', '需求理解', '代码生成', '自验证', '安全与体验'] as const; return <div className="content-page"><section className="page-intro inline-intro"><div><p className="eyebrow">PROMPTFOO EVALUATION</p><h2>50 条任务评测与失败分类</h2><p>评测集已入库；只有人工或配置模型后的运行结果才可标记为已复核。</p></div><div className="metric-card"><b>{reviewedCount}<small>/ 50</small></b><span>人工已复核</span></div></section><div className="filter-row">{groups.map((group) => <button key={group} className={evalGroup === group ? 'filter active' : 'filter'} onClick={() => onGroup(group)}>{group}{group !== '全部' && <small>{evaluationCases.filter((item) => item.group === group).length}</small>}</button>)}</div><div className="evaluation-table"><div className="table-head"><span>用例</span><span>输入与预期</span><span>失败分类</span><span>复核</span></div>{cases.map((item) => <article className="eval-row" key={item.id}><span className="case-id">{item.id}</span><div><b>{item.title}</b><p>{item.prompt}</p><small>期望：{item.expected}</small></div><span className="failure-tag">{item.failureTag}</span><button className={reviewed.includes(item.id) ? 'review-button reviewed' : 'review-button'} onClick={() => onToggle(item.id)}>{reviewed.includes(item.id) ? <><Check size={15} />已复核</> : '待复核'}</button></article>)}</div><p className="run-note">运行命令与判定说明见 <code>evals/promptfooconfig.yaml</code>。当前页面不虚构模型运行结果。</p></div>; }

function ResearchView() { const Card = ({ title, seats, subtitle }: { title: string; seats: string[]; subtitle: string }) => <section className="research-card"><div className="section-heading"><div><p className="eyebrow">待执行研究</p><h2>{title}</h2></div><span className="pill pending">尚未招募</span></div><p>{subtitle}</p><div className="seat-list">{seats.map((seat) => <div key={seat}><span className="seat-avatar">{seat.slice(-2)}</span><span><b>{seat}</b><small>待填写同意记录、原始观察与匿名摘要</small></span><span className="pending-dot">待执行</span></div>)}</div></section>; return <div className="content-page"><section className="page-intro"><p className="eyebrow">RESEARCH OPERATIONS</p><h2>招募、访谈与无引导测试</h2><p>这里刻意不填入虚构的受访者、完成率或结论。研究包提供招募话术、访谈提纲、同意文本、观察表和聚类模板，完成后再回填事实。</p></section><div className="research-grid"><Card title="第 1 周：探索访谈" seats={researchSeats} subtitle="招募有直播或活动组织经验的参与者；验证他们如何组织互动、在哪些环节耗时、如何判断“有效参与”。" /><Card title="第 5 周：无引导可用性测试" seats={testSeats} subtitle="让新用户独立完成“选模板-生成-预览-保存”路径；记录完成率、编辑率、失败原因和观察时间。" /></div><section className="research-actions"><a className="quiet-button" href="docs/03-research-package.html" target="_blank"><ExternalLink size={17} />打开研究包</a><a className="quiet-button" href="docs/09-user-test-template.html" target="_blank"><ExternalLink size={17} />打开观察记录表</a></section></div>; }

function EvidenceView() { const docs = [['00', '产品概览', '定位、边界、版本范围'], ['01', 'MVP PRD', '目标、流程、规则与验收'], ['02', '原型流程', 'Figma 可复画流程与交互说明'], ['03', '研究包', '招募、访谈、同意与分析模板'], ['04', '评测方案', 'Promptfoo、50 条用例和失败分类'], ['05', '工作日志', '6 周日记、反思和工具使用'], ['06', '运行与操作', '本地、模型 API、评测和录屏'], ['07', '作品集案例', '可投递的产品案例叙事'], ['08', '演示脚本', '5 分钟录屏分镜'], ['09', '用户测试表', '无引导测试记录模板']]; return <div className="content-page"><section className="page-intro"><p className="eyebrow">PORTFOLIO EVIDENCE</p><h2>可复审的作品集材料</h2><p>所有材料均与当前产品实现对应。涉及用户、模型质量或发布数据的部分标注为“待执行”，避免把计划写成既成事实。</p></section><div className="evidence-grid">{docs.map(([id, name, detail]) => <a href={`docs/${id}-${id === '00' ? 'product-overview' : id === '01' ? 'prd' : id === '02' ? 'figma-flow' : id === '03' ? 'research-package' : id === '04' ? 'evaluation-plan' : id === '05' ? 'worklog' : id === '06' ? 'operations' : id === '07' ? 'portfolio-case' : id === '08' ? 'demo-recording-script' : 'user-test-template'}.html`} target="_blank" className="evidence-card" key={id}><span>{id}</span><div><h3>{name}</h3><p>{detail}</p></div><ChevronRight size={18} /></a>)}</div><div className="evidence-callout"><Lightbulb size={20} /><p><b>独创性说明：</b>把“直播互动玩法”作为 Coding Agent 的可评测产物，而不是只展示一次性生成结果；规则模板、微应用状态、失败分类和用户研究记录形成同一条可追踪链路。</p></div></div>; }

function ApiModal({ config, useApi, onClose, onConfig, onUseApi }: { config: { baseUrl: string; model: string; apiKey: string }; useApi: boolean; onClose: () => void; onConfig: (value: { baseUrl: string; model: string; apiKey: string }) => void; onUseApi: (value: boolean) => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="api-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">LOCAL ONLY</p><h2 id="api-title">模型 API 配置</h2></div><button className="icon-button" aria-label="关闭" onClick={onClose}><X size={19} /></button></div><p>支持 OpenAI 兼容的任意厂商端点。密钥只保存在当前页面内存，生成请求经本机服务转发，不写入浏览器存储或 Git。</p><label className="switch-row"><span><b>使用模型方案</b><small>关闭时始终使用本地可运行生成器</small></span><input type="checkbox" checked={useApi} onChange={(event) => onUseApi(event.target.checked)} /></label><label>Base URL<input value={config.baseUrl} placeholder="https://provider.example/v1" onChange={(event) => onConfig({ ...config, baseUrl: event.target.value })} /></label><label>模型名称<input value={config.model} placeholder="your-model-name" onChange={(event) => onConfig({ ...config, model: event.target.value })} /></label><label>API Key<input type="password" value={config.apiKey} placeholder="只在本次会话使用" autoComplete="off" onChange={(event) => onConfig({ ...config, apiKey: event.target.value })} /></label><div className="modal-actions"><button className="quiet-button" onClick={onClose}>取消</button><button className="primary-button" onClick={onClose}><Check size={17} />保存本次会话</button></div></section></div>; }

export default App;
