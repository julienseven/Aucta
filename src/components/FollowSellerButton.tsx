"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconUsers } from "@/components/icons";

export function FollowSellerButton({
  sellerId,
  initial,
  signedIn,
  nextPath,
}: {
  sellerId: string;
  initial: boolean;
  signedIn: boolean;
  nextPath: string;
}) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle() {
    if (!signedIn) {
      router.push("/sign-in?next=" + encodeURIComponent(nextPath));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId,
        action: following ? "unfollow" : "follow",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setFollowing(data.following);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`btn ${following ? "btn-outline" : "btn-primary"}`}
    >
      <IconUsers size={15} />
      {following ? "Following" : "Follow seller"}
    </button>
  );
}
