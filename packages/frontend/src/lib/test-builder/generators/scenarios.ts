import { TestBlock, BlockType } from '../types';

export const TG_TYPES: BlockType[] = ['scenario', 'stages-scenario', 'arrivals-scenario', 'group'];

function sanitizeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export function generateOptionsForTg(
  tg: TestBlock,
  optionsLines: string[],
  options: { vus?: number; duration?: string; iterations?: number; thresholds?: Record<string, string[]> } | undefined,
  index: number,
  useExec: boolean,
  execName?: string,
) {
  const p = tg.properties as Record<string, any>;
  const name = `tg_${sanitizeLabel(tg.label)}_${index}`;

  if (tg.type === 'scenario' || tg.type === 'group') {
    let vus = p.vus;
    let duration = p.duration;
    let iterations = p.iterations;

    if (tg.type === 'group') {
      const nameStr = String(p.name || tg.label || '');
      const vusMatch = nameStr.match(/VUs:\s*(\d+)/i);
      const rampMatch = nameStr.match(/ramp:\s*(\d+)s/i);
      if (vusMatch && vusMatch[1]) vus = parseInt(vusMatch[1], 10) || 1;
      else vus = vus || 1;
      if (rampMatch && rampMatch[1] && parseInt(rampMatch[1], 10) > 0) {
        duration = duration || `${Math.max(30, parseInt(rampMatch[1], 10) + 30)}s`;
      } else {
        duration = duration || '30s';
      }
    } else {
      vus = vus || 1;
      duration = duration || '30s';
    }

    if (useExec && execName) {
      optionsLines.push(`    ${name}: {`);
      optionsLines.push(`      executor: 'constant-vus',`);
      optionsLines.push(`      vus: ${vus},`);
      if (duration && !iterations) optionsLines.push(`      duration: '${duration}',`);
      if (iterations && String(iterations).trim()) {
        optionsLines.push(`      iterations: ${String(iterations).trim()},`);
      }
      optionsLines.push(`      exec: '${execName}',`);
      optionsLines.push(`    },`);
    } else {
      if (options?.vus) optionsLines.push(`    vus: ${options.vus},`);
      else if (vus) optionsLines.push(`    vus: ${vus},`);
      if (options?.duration) optionsLines.push(`    duration: '${options.duration}',`);
      else if (duration && !iterations) optionsLines.push(`    duration: '${duration}',`);
      if (iterations && String(iterations).trim()) {
        optionsLines.push(`    iterations: ${String(iterations).trim()},`);
      } else if (options?.iterations) {
        optionsLines.push(`    iterations: ${options.iterations},`);
      }
    }
  } else if (tg.type === 'stages-scenario') {
    const stages = p.stages;
    if (Array.isArray(stages) && stages.length > 0) {
      if (useExec && execName) {
        optionsLines.push(`    ${name}: {`);
        optionsLines.push(`      executor: 'ramping-vus',`);
        optionsLines.push('      stages: [');
        for (const s of stages) optionsLines.push(`        { duration: '${s.duration}', target: ${s.target} },`);
        optionsLines.push('      ],');
        optionsLines.push(`      exec: '${execName}',`);
        optionsLines.push(`    },`);
      } else {
        optionsLines.push('    stages: [');
        for (const s of stages) optionsLines.push(`      { duration: '${s.duration}', target: ${s.target} },`);
        optionsLines.push('    ],');
      }
    }
  } else if (tg.type === 'arrivals-scenario') {
    const executor = p.executor || 'constant-arrival-rate';
    const startRate = p.startRate || 10;
    const timeUnit = p.timeUnit || '1s';
    const preAllocatedVUs = p.preAllocatedVUs || 5;
    const maxVUs = p.maxVUs || 20;
    if (useExec && execName) {
      optionsLines.push(`    ${name}: {`);
      optionsLines.push(`      executor: '${executor}',`);
      optionsLines.push(`      startRate: ${startRate},`);
      optionsLines.push(`      timeUnit: '${timeUnit}',`);
      optionsLines.push(`      preAllocatedVUs: ${preAllocatedVUs},`);
      optionsLines.push(`      maxVUs: ${maxVUs},`);
      if (executor === 'ramping-arrival-rate') {
        const stages = p.stages;
        if (Array.isArray(stages) && stages.length > 0) {
          optionsLines.push('      stages: [');
          for (const s of stages) optionsLines.push(`        { duration: '${s.duration}', target: ${s.target} },`);
          optionsLines.push('      ],');
        }
      }
      optionsLines.push(`      exec: '${execName}',`);
      optionsLines.push(`    },`);
    } else {
      optionsLines.push('    scenarios: {');
      optionsLines.push(`      ${name}: {`);
      optionsLines.push(`        executor: '${executor}',`);
      optionsLines.push(`        startRate: ${startRate},`);
      optionsLines.push(`        timeUnit: '${timeUnit}',`);
      optionsLines.push(`        preAllocatedVUs: ${preAllocatedVUs},`);
      optionsLines.push(`        maxVUs: ${maxVUs},`);
      if (executor === 'ramping-arrival-rate') {
        const stages = p.stages;
        if (Array.isArray(stages) && stages.length > 0) {
          optionsLines.push('        stages: [');
          for (const s of stages) optionsLines.push(`          { duration: '${s.duration}', target: ${s.target} },`);
          optionsLines.push('        ],');
        }
      }
      optionsLines.push('      },');
      optionsLines.push('    },');
    }
  }
}
