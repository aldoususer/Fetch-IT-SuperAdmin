"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button"
      className="btn"
      style={{ width: "100%", justifyContent: "center" }}
      onClick={async () => {
        if (!window.confirm("Are you sure you want to log out of Fetch-It?")) return;
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Log out
    </button>
  );
}
