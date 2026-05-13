export const adminHostName = "admin.yuzucigarclub.com";

export type AdminHostRedirectLocation = {
  hash?: string;
  hostname: string;
  pathname: string;
  search?: string;
};

export function getAdminHostRedirectPath(location: AdminHostRedirectLocation) {
  const hostname = location.hostname.trim().toLowerCase();
  const pathname = location.pathname || "/";

  if (hostname !== adminHostName || pathname !== "/") {
    return null;
  }

  return `/admin/console/${location.search ?? ""}${location.hash ?? ""}`;
}
