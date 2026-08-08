export type ApiResponse<T> = {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  error: null | {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }

  if (!json) {
    throw new Error("Invalid API response");
  }

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json;
}

/** Normalize list payloads that may be T[] or { items: T[] } */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  if (data && typeof data === "object" && "results" in data) {
    const results = (data as { results: unknown }).results;
    if (Array.isArray(results)) return results as T[];
  }
  return [];
}
