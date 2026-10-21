import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

/** Envolve handlers assíncronos para que erros cheguem ao middleware de erro. */
export const route =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };

/** Valida com zod; falha vira 422 com a primeira mensagem. */
export function parse<S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new HttpError(422, r.error.issues[0]?.message ?? 'Dados inválidos.');
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: err.issues[0]?.message ?? 'Dados inválidos.' });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: 'JSON inválido.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
}
