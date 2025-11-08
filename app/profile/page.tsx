"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MeResponse = {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF" | "CLIENT";
  name?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const EyeIcon = ({ open }: { open: boolean }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.25 12c1.5-3 5.5-7.5 9.75-7.5s8.25 4.5 9.75 7.5c-1.5 3-5.5 7.5-9.75 7.5S3.75 15 2.25 12z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      {!open && <path d="M3 3l18 18" />}
    </svg>
  );

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401) {
          router.push("/auth/signin");
          return;
        }
        if (!res.ok) throw new Error("Failed to load profile");
        const data = await res.json();
        setUser(data);
      } catch (err: any) {
        setError(err.message || "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data?.error && typeof data.error === "string"
            ? data.error
            : Array.isArray(data?.error)
            ? data.error[0]?.message
            : data?.error?.message) || "Failed to update password."
        );
      }
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="drive-container p-8">
        <div className="text-[#5f6368]">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="drive-container p-6 max-w-3xl mx-auto space-y-6">
      <div className="card space-y-2">
        <h1 className="text-2xl font-normal text-[#202124]">My Profile</h1>
        {user && (
          <div className="text-sm text-[#5f6368] space-y-1">
            <div>
              <span className="font-medium text-[#202124]">Email:</span>{" "}
              {user.email}
            </div>
            <div>
              <span className="font-medium text-[#202124]">Role:</span>{" "}
              {user.role}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <h2 className="text-lg font-medium text-[#202124]">
            Change Password
          </h2>
          <p className="text-xs text-[#5f6368]">
            Enter your current password, then choose a new one. Use at least six
            characters.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#202124] mb-1">
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                minLength={6}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#3c5495] hover:text-[#e98923]"
                tabIndex={-1}
                aria-label={
                  showCurrent
                    ? "Hide current password"
                    : "Show current password"
                }
              >
                <EyeIcon open={showCurrent} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#202124] mb-1">
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowNew((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#3c5495] hover:text-[#e98923]"
                tabIndex={-1}
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                <EyeIcon open={showNew} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#202124] mb-1">
              Confirm new password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#3c5495] hover:text-[#e98923]"
                tabIndex={-1}
                aria-label={
                  showConfirm
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
