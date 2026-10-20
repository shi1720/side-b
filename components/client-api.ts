/** Same-origin JSON transport with useful errors for offline and failed responses. */
export async function clientApi<T>(
  url: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(
      "We couldn’t reach Side B. Check your connection and try again.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      response.ok
        ? "Side B returned an unreadable response. Please try again."
        : "Side B is temporarily unavailable. Please try again in a moment.",
    );
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : undefined;
    throw new Error(
      typeof message === "string"
        ? message
        : "Something went wrong. Please try again.",
    );
  }
  return data as T;
}
