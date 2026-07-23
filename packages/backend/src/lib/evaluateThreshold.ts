import { ThresholdResult } from '@tenjint6/shared';

export function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function evaluateThreshold(
  metric: string,
  expr: string,
  sortedValues: number[],
): ThresholdResult {
  const match = expr.match(/^(\w+(?:\(\d+(?:\.\d+)?\))?)\s*(<|>|<=|>=|==)\s*(\d+\.?\d*)$/);
  if (!match) {
    return { metric, expression: expr, passed: false, actual: null, aborted: false };
  }

  const [, aggregator, operator, thresholdStr] = match;
  const threshold = parseFloat(thresholdStr);
  let actual: number;

  switch (aggregator) {
    case 'avg': actual = sortedValues.reduce((a, b) => a + b, 0) / sortedValues.length; break;
    case 'min': actual = sortedValues[0]; break;
    case 'max': actual = sortedValues[sortedValues.length - 1]; break;
    case 'med': actual = percentile(sortedValues, 50); break;
    case 'count': actual = sortedValues.length; break;
    default: {
      const pMatch = aggregator.match(/^p\((\d+(?:\.\d+)?)\)$/);
      if (pMatch) {
        actual = percentile(sortedValues, parseFloat(pMatch[1]));
      } else {
        return { metric, expression: expr, passed: false, actual: null, aborted: false };
      }
    }
  }

  let passed: boolean;
  switch (operator) {
    case '<': passed = actual < threshold; break;
    case '>': passed = actual > threshold; break;
    case '<=': passed = actual <= threshold; break;
    case '>=': passed = actual >= threshold; break;
    case '==': passed = actual === threshold; break;
    default: passed = false;
  }

  return { metric, expression: expr, passed, actual, aborted: false };
}
