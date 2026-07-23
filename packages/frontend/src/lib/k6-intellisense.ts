import { type Monaco } from '@monaco-editor/react';

const K6_TYPE_DEFINITIONS = `
declare module 'k6' {
  export function check(val: any, sets: Record<string, (r: any) => boolean>, tags?: Record<string, string>): boolean;
  export function group<T>(name: string, fn: () => T): T;
  export function sleep(seconds: number): void;
  export function fail(err?: string): never;
}

declare module 'k6/http' {
  export interface Params {
    headers?: Record<string, string>;
    cookies?: Record<string, string | { value: string; replace?: boolean }>;
    tags?: Record<string, string>;
    timeout?: string | number;
    compression?: string;
    responseType?: 'text' | 'binary' | 'none';
  }

  export interface Response {
    status: number;
    status_text: string;
    body: string | ArrayBuffer;
    json(selector?: string): any;
    html(selector?: string): any;
    headers: Record<string, string>;
    cookies: Record<string, any[]>;
    timings: {
      duration: number;
      blocked: number;
      connecting: number;
      tls_handshaking: number;
      sending: number;
      waiting: number;
      receiving: number;
    };
    url: string;
  }

  export function get(url: string, params?: Params): Response;
  export function post(url: string, body?: string | object | ArrayBuffer, params?: Params): Response;
  export function put(url: string, body?: string | object | ArrayBuffer, params?: Params): Response;
  export function patch(url: string, body?: string | object | ArrayBuffer, params?: Params): Response;
  export function del(url: string, body?: string | object | ArrayBuffer, params?: Params): Response;
  export function head(url: string, params?: Params): Response;
  export function options(url: string, body?: string | object | ArrayBuffer, params?: Params): Response;
  export function batch(requests: (string | [string, string, (string | object | ArrayBuffer)?, Params?])[]): Response[];
}

declare module 'k6/metrics' {
  export class Counter {
    constructor(name: string, isTime?: boolean);
    add(value: number, tags?: Record<string, string>): void;
  }
  export class Gauge {
    constructor(name: string, isTime?: boolean);
    add(value: number, tags?: Record<string, string>): void;
  }
  export class Rate {
    constructor(name: string, isTime?: boolean);
    add(value: boolean | number, tags?: Record<string, string>): void;
  }
  export class Trend {
    constructor(name: string, isTime?: boolean);
    add(value: number, tags?: Record<string, string>): void;
  }
}

declare module 'k6/data' {
  export class SharedArray<T> {
    constructor(name: string, fn: () => T[]);
    readonly length: number;
    [index: number]: T;
  }
}

declare module 'k6/execution' {
  export const scenario: {
    name: string;
    iterationInTest: number;
    iterationInInstance: number;
    startTime: number;
  };
  export const vu: {
    iterationInInstance: number;
    iterationInScenario: number;
    idInTest: number;
    idInInstance: number;
    tags: Record<string, string>;
  };
}

declare const __VU: number;
declare const __ITER: number;
declare const __ENV: Record<string, string>;
declare function open(filePath: string, mode?: string): string | ArrayBuffer;
`;

/**
 * Registers rich k6 TypeScript / JavaScript declarations into Monaco Editor.
 */
export function handleEditorWillMount(monaco: Monaco): void {
  // 1. Configure JavaScript defaults
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    K6_TYPE_DEFINITIONS,
    'file:///node_modules/@types/k6/index.d.ts'
  );

  // 2. Configure TypeScript defaults (so both JS and TS languages get full k6 autocompletion)
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
  });
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    K6_TYPE_DEFINITIONS,
    'file:///node_modules/@types/k6/index.d.ts'
  );
}
