import type { Request, Response } from 'express';
import type { z } from 'zod';

/** Parse req.body with a zod schema; on failure respond 400 and return null. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  req: Request,
  res: Response,
): z.infer<T> | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten().fieldErrors });
    return null;
  }
  return parsed.data;
}

export function idParam(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'invalid_id' });
    return null;
  }
  return id;
}
