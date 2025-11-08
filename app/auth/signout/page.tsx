"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut({
      callbackUrl: "/auth/signin",
      redirect: true,
    });
  };

  const handleCancel = () => {
    // If there's a previous page, go back, otherwise go to home
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8f9fa]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="Alfatonics Logo"
                className="w-16 h-16 object-contain"
              />
            </div>
            <h1 className="text-2xl font-normal text-[#202124] mb-2">
              Sign out
            </h1>
            <p className="text-sm text-[#5f6368]">
              Are you sure you want to sign out?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="btn-secondary flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
