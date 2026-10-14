import { templates } from '../data';
import type { Brief, PlayPlan, PlayTemplate } from '../types';

const clean = (value: string, fallback: string) => value.trim() || fallback;

/** Model output is untrusted: accept a field only when it is a non-empty string, and bound its length. */
const textField = (value: unknown, fallback: string, max = 4000) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;

/** Keep only non-empty strings. A model may return objects or numbers, which would crash rendering. */
const listField = (value: unknown, fallback: string[], maxItems = 20) => {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 1000))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length ? items : fallback;
};

export function createLocalPlan(brief: Brief, template: PlayTemplate): PlayPlan {
  const theme = clean(brief.theme, '校园游戏夜');
  const objective = clean(brief.objective, '提高有效互动参与');
  const audience = clean(brief.audience, '对主题有轻度兴趣的新观众');
  const duration = clean(brief.duration, '15 分钟');
  const constraints = clean(brief.constraints, '主持人 1 人；不依赖真实平台数据或付费能力');

  return {
    title: `${theme}｜${template.name}`,
    summary: `面向${audience}，在${duration}内用${template.name}完成“${objective}”。首轮降低进入门槛，中段强化反馈，末轮收束到可复盘的行动。`,
    rules: template.rules.map((rule, index) => `${index + 1}. ${rule}`),
    hostScript: `${template.hostCue}\n本场主题是“${theme}”，目标是${objective}。请按屏幕指引参与；每轮结束我会公布结果并进入下一步。`,
    visualPrompt: `轻量直播互动面板；主题：${theme}；模板：${template.name}；信息层级包含当前回合、进度、单一主操作与结果反馈；颜色使用 ${template.color}；不使用任何平台品牌或真实用户数据。`,
    riskNotes: [
      `时长边界：${duration}，每轮必须预留 10-15 秒结果反馈。`,
      `资源边界：${constraints}。`,
      '体验边界：避免诱导刷屏、羞辱性排名或收集个人联系方式。',
    ],
    codeBrief: `实现一个浏览器微应用：顶部显示“${theme}”和回合进度；中心渲染当前题/线索；主按钮执行一次互动并锁定状态；右侧或底部给主持人展示规则和口播。必须覆盖空状态、重复点击、375px 宽度与接口失败回退。`,
    source: 'local',
  };
}

/** Merge an untrusted API payload over the local fallback; any missing or malformed field falls back. */
export function planFromApi(payload: Partial<Record<keyof PlayPlan, unknown>> | null | undefined, fallback: PlayPlan): PlayPlan {
  const data = payload ?? {};
  return {
    title: textField(data.title, fallback.title, 200),
    summary: textField(data.summary, fallback.summary),
    rules: listField(data.rules, fallback.rules),
    hostScript: textField(data.hostScript, fallback.hostScript),
    visualPrompt: textField(data.visualPrompt, fallback.visualPrompt),
    riskNotes: listField(data.riskNotes, fallback.riskNotes),
    codeBrief: textField(data.codeBrief, fallback.codeBrief),
    source: 'api',
  };
}

export const defaultTemplate = templates[0];
