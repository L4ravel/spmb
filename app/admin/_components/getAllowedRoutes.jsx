import { EMAIL_ACCESS, DEFAULT_ALLOWED } from "./emailAccess";

export function getAllowedRoutes(email) {
  const key = (email && (email.toLowerCase?.() || email)) || "";
  const list = EMAIL_ACCESS[key] || DEFAULT_ALLOWED;
  return new Set(list);
}

export function isAllowedPath(pathname, allowed) {
  if (allowed.has("*")) return true;
  for (const base of allowed) {
    if (pathname === base || pathname.startsWith(base + "/")) return true;
  }
  return false;
}
