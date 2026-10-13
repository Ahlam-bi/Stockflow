const BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api";

let token = localStorage.getItem("stockflow_token");

export function setToken(value) {
  token = value;

  if (value) {
    localStorage.setItem("stockflow_token", value);
  } else {
    localStorage.removeItem("stockflow_token");
  }
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(BASE + path, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Erreur ${response.status}`);
  }

  return data;
}