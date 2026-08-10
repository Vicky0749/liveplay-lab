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
});
