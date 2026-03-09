/**
 * aiProxy.ts — Client helper for the /api/ai serverless proxy.
 *
 * All Claude API calls go through this function so the API key
 * stays server-side and requests are rate-limited.
 */

export async function callAI(body: {
  model: string;
  max_tokens: number;
  messages: { role: string; content: string }[];
  system?: string;
  tools?: unknown[];
}): Promise<any> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `AI proxy returned ${res.status}`);
  }
  return res.json();
}
