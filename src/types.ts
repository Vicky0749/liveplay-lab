export type TemplateId = 'word-puzzle' | 'truth-rush' | 'relay';

export type PlayTemplate = {
  id: TemplateId;
  name: string;
  shortName: string;
  color: string;
  tagline: string;
  useCase: string;
  rules: string[];
  hostCue: string;
  starterPrompt: string;
};

export type PlayPlan = {
  title: string;
  summary: string;
  rules: string[];
  hostScript: string;
  visualPrompt: string;
  riskNotes: string[];
  codeBrief: string;
  source: 'local' | 'api';
};

export type Brief = {
  theme: string;
  objective: string;
  audience: string;
  duration: string;
  constraints: string;
};

export type EvaluationCase = {
  id: string;
  group: '需求理解' | '代码生成' | '自验证' | '安全与体验';
  title: string;
  prompt: string;
  expected: string;
  failureTag: string;
};
