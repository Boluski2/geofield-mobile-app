const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  try {
    if (!API_URL) {
      throw new ApiError("EXPO_PUBLIC_API_URL is not configured.");
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const body = await response.text();
    let data: any;
    try {
      data = body ? JSON.parse(body) : undefined;
    } catch {
      data = body;
    }

    if (!response.ok) {
      const detail = Array.isArray(data?.detail)
        ? data.detail.map((item: { msg?: string }) => item.msg ?? JSON.stringify(item)).join("; ")
        : typeof data?.detail === "string"
          ? data.detail
          : undefined;
      const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
      throw new ApiError(
        detail ? `Request failed (${status}): ${detail}` : `API returned ${status}`,
        response.status
      );
    }

    return data as T;
  } catch (error) {
    console.error(`API request failed (${options.method ?? "GET"} ${path}):`, error);
    throw error;
  }
}
