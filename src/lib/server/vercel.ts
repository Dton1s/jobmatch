import type { IncomingMessage, ServerResponse } from "node:http";

export type VercelApiRequest = IncomingMessage & { body?: unknown };
export type VercelApiResponse = ServerResponse & {
  status(code: number): VercelApiResponse;
  json(body: unknown): VercelApiResponse;
};

export function respondJson(response: VercelApiResponse, status: number, body: unknown): void {
  response.status(status).json(body);
}

export async function readRawBody(request: VercelApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function parsedBody(request: VercelApiRequest): unknown {
  if (Buffer.isBuffer(request.body)) {
    try { return JSON.parse(request.body.toString("utf8")); } catch { return null; }
  }
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { return null; }
  }
  return request.body;
}
