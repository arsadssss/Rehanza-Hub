export async function apiFetch(
  url: string,
  options: RequestInit = {}
) {
  const accountId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("active_account")
      : null;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accountId) {
    (headers as any)["x-account-id"] = accountId;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
