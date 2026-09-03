export interface Account {
  id: string;
  name: string;
  slug?: string;
}

export const ACTIVE_ACCOUNT_STORAGE_KEY = "active_account";
export const ACTIVE_ACCOUNT_NAME_STORAGE_KEY = "active_account_name";
export const ACTIVE_ACCOUNT_COOKIE_KEY = "active_account_id";
export const ACTIVE_ACCOUNT_CHANGED_EVENT = "active-account-changed";

export function getStoredAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
}

export function getStoredAccountName(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_ACCOUNT_NAME_STORAGE_KEY);
}

export function setStoredAccount(account: { id: string; name?: string }): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, account.id);
  if (account.name) {
    sessionStorage.setItem(ACTIVE_ACCOUNT_NAME_STORAGE_KEY, account.name);
  }
  document.cookie = `${ACTIVE_ACCOUNT_COOKIE_KEY}=${account.id}; path=/; max-age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent(ACTIVE_ACCOUNT_CHANGED_EVENT, { detail: account }));
}

let resolvePromise: Promise<Account | null> | null = null;

export async function resolveActiveAccount(forceRefresh = false): Promise<Account | null> {
  if (typeof window === "undefined") return null;

  const storedId = sessionStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  const storedName = sessionStorage.getItem(ACTIVE_ACCOUNT_NAME_STORAGE_KEY);

  if (!forceRefresh && storedId && storedName && storedName.toLowerCase().includes("fashion")) {
    return { id: storedId, name: storedName };
  }

  if (resolvePromise && !forceRefresh) {
    return resolvePromise;
  }

  resolvePromise = (async () => {
    try {
      const res = await fetch("/api/accounts");
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success || !json.data || json.data.length === 0) return null;

      const accounts: Account[] = json.data;
      const fashion = accounts.find((a) => a.name.toLowerCase().includes("fashion")) || accounts[0];

      setStoredAccount(fashion);
      return fashion;
    } catch (err) {
      console.error("Failed to resolve active account:", err);
      if (storedId) return { id: storedId, name: storedName || "Account" };
      return null;
    } finally {
      resolvePromise = null;
    }
  })();

  return resolvePromise;
}
