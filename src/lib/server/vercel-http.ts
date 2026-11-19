export type VercelNodeRequest = {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type VercelNodeResponse = {
  status(code: number): VercelNodeResponse;
  setHeader(name: string, value: string): void;
  send(body: string): void;
};

export function toWebRequest(request: VercelNodeRequest): Request {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(request.headers)) {
    if (raw !== undefined) headers.set(name, Array.isArray(raw) ? raw.join(", ") : raw);
  }

  const method = (request.method ?? "GET").toUpperCase();
  const origin = `https://${headers.get("host") ?? "localhost"}`;
  const url = new URL(request.url ?? "/", origin);
  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD" && request.body !== undefined) {
    body = typeof request.body === "string" ? request.body : JSON.stringify(request.body);
  }
  return new Request(url, { method, headers, ...(body === undefined ? {} : { body }) });
}

export async function sendWebResponse(response: VercelNodeResponse, result: Response): Promise<void> {
  response.status(result.status);
  result.headers.forEach((value, name) => response.setHeader(name, value));
  response.send(await result.text());
}
