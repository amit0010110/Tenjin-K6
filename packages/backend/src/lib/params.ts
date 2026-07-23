import { ParamsDictionary } from 'express-serve-static-core';

export function param(params: ParamsDictionary, key: string): string {
  const val = params[key];
  return Array.isArray(val) ? val[0] : val;
}
