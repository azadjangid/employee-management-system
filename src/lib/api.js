// Small fetch wrapper for the EmployeeHub API.
// In development Vite proxies /api to the Express server (see vite.config.js).
// Set VITE_API_URL when the API lives on another origin.
const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Full URL of an API path, for links and <img>/<a href> (e.g. receipt downloads). */
export const apiUrl = (path) => `${BASE_URL}/api${path}`;

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let unauthorizedHandler = null;
/** Called on any 401 so the app can send the user back to the login page. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export async function request(path, { method = "GET", body, params, signal, skipAuthRedirect } = {}) {
  let url = `${BASE_URL}/api${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "All")
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "include",
      signal,
      headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Is the API running?");
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) unauthorizedHandler?.();
    throw new ApiError(
      res.status,
      data?.error?.message || `Request failed (${res.status})`,
      data?.error?.details
    );
  }
  return data;
}

export const api = {
  get: (path, params, opts) => request(path, { ...opts, params }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};
