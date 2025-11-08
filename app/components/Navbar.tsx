import Link from "next/link";
import { auth } from "@/app/lib/auth";

export default async function Navbar() {
  const session = await auth();
  const role = session?.user?.role;
  const user = session?.user;

  return (
    <nav className="bg-white border-b border-[#dadce0] h-16 flex items-center px-3 sm:px-4 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-4 md:gap-8 flex-1 max-w-[1800px] mx-auto w-full">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 sm:gap-3 no-underline shrink-0"
        >
          <img
            src="/logo.png"
            alt="Alfatonics Logo"
            className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
          />
          <span className="text-[#202124] font-medium text-base sm:text-lg hidden sm:block">
            Alfatonics
          </span>
        </Link>

        {/* Search Bar - Hidden on mobile, shown on tablet+ */}
        <div className="flex-1 max-w-[720px] hidden md:block">
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#5f6368]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search in Drive"
              className="w-full pl-10 pr-4 py-2 bg-[#f1f3f4] border-none rounded-lg text-[#202124] placeholder-[#5f6368] focus:outline-none focus:bg-white focus:shadow-md transition-all"
            />
          </div>
        </div>

        {/* Mobile Search Icon */}
        <button className="md:hidden btn-icon shrink-0" title="Search">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </button>

        {/* Navigation Links - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2">
          {role === "ADMIN" && (
            <Link
              href="/admin"
              className="px-3 sm:px-4 py-2 text-[#202124] hover:bg-[#f1f3f4] rounded-lg transition-colors text-sm font-medium"
            >
              Admin
            </Link>
          )}
          {role === "STAFF" && (
            <Link
              href="/staff"
              className="px-3 sm:px-4 py-2 text-[#202124] hover:bg-[#f1f3f4] rounded-lg transition-colors text-sm font-medium"
            >
              Staff
            </Link>
          )}
          {role === "CLIENT" && (
            <Link
              href="/client"
              className="px-3 sm:px-4 py-2 text-[#202124] hover:bg-[#f1f3f4] rounded-lg transition-colors text-sm font-medium"
            >
              My Projects
            </Link>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!role ? (
            <Link
              href="/auth/signin"
              className="btn-primary text-sm px-3 sm:px-4 py-2 no-underline whitespace-nowrap"
            >
              <span className="hidden sm:inline">Sign in</span>
              <span className="sm:hidden">Sign in</span>
            </Link>
          ) : (
            <div className="flex items-center gap-1 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#3c5495] flex items-center justify-center text-white font-medium text-xs sm:text-sm">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <Link
                href="/profile"
                className="px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-[#3c5495] border border-[#3c5495] rounded-lg hover:bg-[#3c5495] hover:text-white transition-colors no-underline"
                title="Profile"
              >
                Profile
              </Link>
              <Link
                href="/auth/signout"
                className="px-2 sm:px-4 py-2 text-[#5f6368] hover:bg-[#f1f3f4] rounded-lg transition-colors text-xs sm:text-sm font-medium no-underline"
                title="Sign out"
              >
                <span className="hidden sm:inline">Sign out</span>
                <svg
                  className="sm:hidden w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
