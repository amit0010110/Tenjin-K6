declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';
  const serve: RequestHandler[];
  function setup(spec: Record<string, unknown>, options?: Record<string, unknown>): RequestHandler;
  export { serve, setup };
}
