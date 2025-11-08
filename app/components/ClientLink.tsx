"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ClientLinkProps = {
  projectId: string;
};

export default function ClientLink({ projectId }: ClientLinkProps) {
  const [copied, setCopied] = useState(false);
  const [clientUrl, setClientUrl] = useState("");

  useEffect(() => {
    // Get the full URL on client side
    if (typeof window !== "undefined") {
      setClientUrl(`${window.location.origin}/client/projects/${projectId}`);
    }
  }, [projectId]);

  const handleCopy = async () => {
    if (!clientUrl) return;

    try {
      await navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = clientUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#dadce0]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#5f6368]">Client access link:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5"
            title="Copy link"
          >
            {copied ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </>
            )}
          </button>
          <Link
            href={`/client/projects/${projectId}`}
            target="_blank"
            className="text-sm text-[#1a73e8] hover:underline flex items-center gap-1 no-underline"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}
