export async function apiFetch(
  url: string,
  options: RequestInit = {}
) {
  const accountId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("active_account")
      : null;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Only default to JSON if body is not FormData
  // When body is FormData, we MUST NOT set Content-Type manually
  // so that the browser can set it with the correct multipart boundary.
  if (!(options.body instanceof FormData)) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  } else {
    // If it is FormData, ensure no manual Content-Type header exists
    delete headers["Content-Type"];
  }

  if (accountId) {
    headers["x-account-id"] = accountId;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
