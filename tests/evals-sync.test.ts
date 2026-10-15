// The 50 evaluation cases exist in two places: src/data.ts (shown in the UI) and
// evals/promptfooconfig.yaml (what Promptfoo actually runs). This test fails when
// they drift apart, so the README's "50 tasks" claim stays true for both.
// It lives outside src/ because it reads files with node:fs, which the app
// tsconfig (types: vite/client only) does not cover.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluationCases } from '../src/data';

const yamlPath = fileURLToPath(new URL('../evals/promptfooconfig.yaml', import.meta.url));
const yaml = readFileSync(yamlPath, 'utf8');
const unquote = (value: string) => value.replace(/''/g, "'");

const yamlCases = [...yaml.matchAll(/- description: (LP-\d+) (.+)\n\s+vars: \{ task: '((?:[^']|'')*)', expected: '((?:[^']|'')*)' \}/g)]
  .map(([, id, failureTag, task, expected]) => ({ id, failureTag, prompt: unquote(task), expected: unquote(expected) }));

describe('evaluation cases', () => {
  it('has 50 cases with unique, sequential ids', () => {
    expect(evaluationCases).toHaveLength(50);
    expect(evaluationCases.map((item) => item.id)).toEqual(Array.from({ length: 50 }, (_, index) => `LP-${String(index + 1).padStart(2, '0')}`));
  });

  it('is mirrored one-to-one by evals/promptfooconfig.yaml', () => {
    expect(yamlCases).toHaveLength(evaluationCases.length);
    for (const item of evaluationCases) {
      const match = yamlCases.find((candidate) => candidate.id === item.id);
      expect(match, `${item.id} is missing from promptfooconfig.yaml`).toBeTruthy();
      expect({ ...match }).toEqual({ id: item.id, failureTag: item.failureTag, prompt: item.prompt, expected: item.expected });
    }
  });

  it('gives every case an assertion in the YAML', () => {
    expect((yaml.match(/assert: \[/g) ?? []).length).toBe(evaluationCases.length);
  });
});
