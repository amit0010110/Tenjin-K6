export interface Options {
  definition: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description?: string;
    };
    servers?: Array<{ url: string; description?: string }>;
    components?: Record<string, unknown>;
    security?: Array<Record<string, string[]>>;
    paths?: Record<string, unknown>;
  };
  apis: string[];
}
