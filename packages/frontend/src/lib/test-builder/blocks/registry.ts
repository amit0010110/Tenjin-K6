import type { BlockType, BlockTypeDefinition } from '../types';
import { scenarios } from './scenarios';
import { requests } from './requests';
import { browser } from './browser';
import { flow } from './flow';
import { validation } from './validation';
import { timing } from './timing';
import { data } from './data';
import { metricsDebug } from './metrics-debug';
import { processors } from './processors';
import { iso } from './iso';
import { ftp } from './ftp';
import { ibmmq } from './ibmmq';
import { extensions } from './extensions';

export const BLOCK_REGISTRY: Record<BlockType, BlockTypeDefinition> = {
  ...scenarios,
  ...requests,
  ...browser,
  ...flow,
  ...validation,
  ...timing,
  ...data,
  ...metricsDebug,
  ...processors,
  ...iso,
  ...ftp,
  ...ibmmq,
  ...extensions,
} as Record<BlockType, BlockTypeDefinition>;
