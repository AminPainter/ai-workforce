import type { RawBodyRequest } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

export function toWebRequest(req: RawBodyRequest<FastifyRequest>): Request {
  const url = `${req.protocol}://${req.host}${req.originalUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers))
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);

  return new Request(url, {
    method: req.method,
    headers,
    body: req.rawBody ? new Uint8Array(req.rawBody) : undefined,
  });
}

export async function sendWebResponse(
  reply: FastifyReply,
  webResponse: Response,
): Promise<void> {
  reply.status(webResponse.status);
  for (const [key, value] of webResponse.headers) reply.header(key, value);
  const body = await webResponse.arrayBuffer();
  await reply.send(Buffer.from(body));
}
