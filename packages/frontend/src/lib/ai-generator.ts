import { SCRIPT_TEMPLATES, ScriptTemplate } from './test-builder/templates';

interface MatchResult {
  template: ScriptTemplate;
  score: number;
  extracted: { baseUrl?: string; endpoint?: string; method?: string; vuCount?: number; duration?: string };
}

const METHOD_KEYWORDS: Record<string, string[]> = {
  get: ['get', 'fetch', 'retrieve', 'list', 'query'],
  post: ['post', 'create', 'add', 'submit', 'insert'],
  put: ['put', 'update', 'modify', 'edit'],
  patch: ['patch', 'partial'],
  delete: ['delete', 'remove', 'destroy'],
};

export function generateScript(description: string): { template: ScriptTemplate; code: string; match: MatchResult } {
  const lower = description.toLowerCase();

  const extracted: MatchResult['extracted'] = {};

  const urlMatch = lower.match(/https?:\/\/[^\s,]+/);
  if (urlMatch) extracted.baseUrl = urlMatch[0].replace(/\/+$/, '');

  const pathMatch = lower.match(/\/(?:api\/)?[a-z0-9_\-/]+/gi);
  if (pathMatch && !extracted.baseUrl) {
    extracted.endpoint = pathMatch[0];
  }

  for (const [method, keywords] of Object.entries(METHOD_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      extracted.method = method;
      break;
    }
  }

  const vuMatch = lower.match(/(\d+)\s*(?:vu|user|vus|users)/i);
  if (vuMatch) extracted.vuCount = parseInt(vuMatch[1]);

  const durMatch = lower.match(/(\d+)\s*(?:s|sec|second|m|min|minute|h|hour)/i);
  if (durMatch) extracted.duration = durMatch[0];

  const keywords = description.toLowerCase().split(/[\s,;.:!?]+/).filter(Boolean);

  const scored = SCRIPT_TEMPLATES.map((t) => {
    const allTags = [t.name.toLowerCase(), t.description.toLowerCase(), ...t.tags.map((tg) => tg.toLowerCase())];
    const tagWords = allTags.flatMap((s) => s.split(/[\s-]+/).filter((w) => w.length > 2));
    const score = keywords.reduce((s, kw) => s + (tagWords.includes(kw) ? 1 : 0), 0);
    return { template: t, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || scored[0];
  const match: MatchResult = { template: best.template, score: best.score, extracted };

  let code = best.template.code;

  if (extracted.baseUrl) {
    code = code.replace(/https:\/\/api\.example\.com/g, extracted.baseUrl);
    code = code.replace(/https:\/\/example\.com/g, extracted.baseUrl);
  }
  if (extracted.endpoint) {
    code = code.replace(/\/health/g, extracted.endpoint);
    code = code.replace(/\/api\/users/g, extracted.endpoint);
    code = code.replace(/\/api\/products/g, extracted.endpoint);
  }
  if (extracted.vuCount) {
    code = code.replace(/vus:\s*\d+/g, `vus: ${extracted.vuCount}`);
  }

  return { template: best.template, code, match };
}
