// Shared 401 handling for client-side fetches: every caller previously repeated
// `if (res.status === 401) router.push("/signin")`. Returns true when the
// response was a 401 and a redirect was issued, so callers keep their own
// continuation (return vs throw) with a one-line check.
export function redirectIfUnauthorized(
  res: Response,
  router: { push: (url: string) => void }
): boolean {
  if (res.status === 401) {
    router.push("/signin");
    return true;
  }
  return false;
}
