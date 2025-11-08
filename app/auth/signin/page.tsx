"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });

    if (res?.error) {
      setError("Invalid credentials");
      setLoading(false);
      return;
    }

    const target = res?.url ?? "/";
    router.replace(target);
    setLoading(false);
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
              Sign in
            </h1>
            <p className="text-sm text-[#5f6368]">
              Sign in to Alfatonics Client Delivery
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#3c5495] hover:text-[#e98923]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full btn-primary disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
