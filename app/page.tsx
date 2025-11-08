import { auth } from "@/app/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  return (
    <div className="drive-container">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
        <div className="text-center max-w-2xl space-y-6">
          <div className="flex justify-center mb-4">
            <img
              src="/logo.png"
              alt="Alfatonics Logo"
              className="w-24 h-24 object-contain"
            />
          </div>
          <h1 className="text-4xl font-normal text-[#202124]">
            Alfatonics Client Delivery Portal
          </h1>
          <p className="text-lg text-[#5f6368]">
            Upload your assets and receive AI-generated video deliveries.
          </p>
          <div className="flex gap-3 justify-center pt-4">
            {role === "ADMIN" && (
              <Link className="btn-primary no-underline" href="/admin">
                Admin Dashboard
              </Link>
            )}
            {role === "STAFF" && (
              <Link className="btn-primary no-underline" href="/staff">
                Staff Dashboard
              </Link>
            )}
            {role === "CLIENT" && (
              <Link className="btn-primary no-underline" href="/client">
                My Projects
              </Link>
            )}
            {!role && (
              <Link className="btn-primary no-underline" href="/auth/signin">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
