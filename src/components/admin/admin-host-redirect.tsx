"use client";

import { useEffect } from "react";

import { getAdminHostRedirectPath } from "@/lib/admin-host-redirect";

export function AdminHostRedirect() {
  useEffect(() => {
    const redirectPath = getAdminHostRedirectPath(window.location);

    if (redirectPath) {
      window.location.replace(redirectPath);
    }
  }, []);

  return null;
}
