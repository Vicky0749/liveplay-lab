import { describe, expect, it } from 'vitest';
import { templates } from '../data';
import { createLocalPlan, planFromApi } from './generation';

const brief = { theme: '迎新夜', objective: '拉动互动', audience: '大一新生', duration: '12 分钟', constraints: '主持人 1 人' };

describe('generation', () => {
  it('builds a complete local fallback plan from the brief and template', () => {
    const plan = createLocalPlan(brief, templates[0]);
    expect(plan.title).toContain('迎新夜');
    expect(plan.rules).toHaveLength(3);
    expect(plan.source).toBe('local');
  });

  it('keeps a valid fallback when an API output is partial', () => {
    const fallback = createLocalPlan(brief, templates[1]);
    const plan = planFromApi({ title: '模型方案', rules: [] }, fallback);
    expect(plan.title).toBe('模型方案');
    expect(plan.rules).toEqual(fallback.rules);
    expect(plan.riskNotes).toEqual(fallback.riskNotes);
  });

  it('does not crash on malformed model output and falls back field by field', () => {
    const fallback = createLocalPlan(brief, templates[2]);
    const plan = planFromApi({ title: 42, summary: { text: 'x' }, rules: [{ a: 1 }, 7, null], hostScript: '   ', riskNotes: 'not a list', codeBrief: ['x'] }, fallback);
    expect(plan.title).toBe(fallback.title);
    expect(plan.summary).toBe(fallback.summary);
    expect(plan.rules).toEqual(fallback.rules);
    expect(plan.hostScript).toBe(fallback.hostScript);
    expect(plan.riskNotes).toEqual(fallback.riskNotes);
    expect(plan.codeBrief).toBe(fallback.codeBrief);
    expect(plan.source).toBe('api');
  });

  it('accepts null or undefined payloads', () => {
    const fallback = createLocalPlan(brief, templates[0]);
    expect(planFromApi(null, fallback).title).toBe(fallback.title);
    expect(planFromApi(undefined, fallback).rules).toEqual(fallback.rules);
  });

  it('trims strings, drops blank or non-string list items, and bounds list length', () => {
    const fallback = createLocalPlan(brief, templates[0]);
    const manyRules = Array.from({ length: 40 }, (_, index) => `规则 ${index + 1}`);
    const plan = planFromApi({ title: '  新方案  ', rules: ['  一  ', '', 5, '二'] }, fallback);
    expect(plan.title).toBe('新方案');
    expect(plan.rules).toEqual(['一', '二']);
    expect(planFromApi({ rules: manyRules }, fallback).rules).toHaveLength(20);
  });

  it('bounds absurdly long text so one response cannot blow up the layout', () => {
    const fallback = createLocalPlan(brief, templates[0]);
    expect(planFromApi({ summary: 'x'.repeat(50_000), title: 't'.repeat(5_000) }, fallback).summary).toHaveLength(4000);
    expect(planFromApi({ title: 't'.repeat(5_000) }, fallback).title).toHaveLength(200);
  });

  it('falls back to defaults for an empty brief', () => {
    const plan = createLocalPlan({ theme: '  ', objective: '', audience: '', duration: '', constraints: '' }, templates[0]);
    expect(plan.title).toContain('校园游戏夜');
    expect(plan.riskNotes).toHaveLength(3);
  });
});
