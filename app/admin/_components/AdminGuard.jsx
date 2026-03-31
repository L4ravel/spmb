"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getAllowedRoutes, isAllowedPath } from "./getAllowedRoutes";
import { useAuthEmail } from "./useAuthEmail";

// Redirect otomatis jika user buka halaman yang tidak diizinkan
export default function AdminGuard({ children }) {
  const email = useAuthEmail();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname) return;
    const allowed = getAllowedRoutes(email);
    if (!isAllowedPath(pathname, allowed)) {
      const fallback =
        allowed.has("*") ? "/admin" : Array.from(allowed.values())[0] || "/admin/pembayaran";
      router.replace(fallback);
    }
  }, [email, pathname, router]);

  return <>{children}</>;
}
