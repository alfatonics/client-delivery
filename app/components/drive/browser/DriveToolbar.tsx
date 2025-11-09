"use client";

import type { FC } from "react";
import type { DriveLayoutMode } from "./types";

type DriveToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  layout: DriveLayoutMode;
  onChangeLayout: (mode: DriveLayoutMode) => void;
  canUpload?: boolean;
  canCreateFolder?: boolean;
  onNewFolder?: () => void;
  onUploadClick?: () => void;
  rightSlot?: React.ReactNode;
};

const iconClass = "h-4 w-4";

export const DriveToolbar: FC<DriveToolbarProps> = ({
  search,
  onSearchChange,
  layout,
  onChangeLayout,
  canUpload,
  canCreateFolder,
  onNewFolder,
  onUploadClick,
  rightSlot,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe3eb] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-1 items-center gap-3 min-w-[240px]">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search files and folders"
            className="w-full rounded-xl border border-[#e1e5ee] bg-[#f8fafc] pl-11 pr-3 py-2.5 text-sm text-[#202124] placeholder-[#7c8190] focus:border-[#1a73e8] focus:bg-white focus:outline-none shadow-inner"
          />
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5f6368]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="m20 20-3.5-3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-[#e1e5ee] bg-[#f8fafc] p-1">
          <button
            type="button"
            onClick={() => onChangeLayout("grid")}
            className={[
              "flex h-8 w-9 items-center justify-center rounded-full text-sm transition",
              layout === "grid"
                ? "bg-white text-[#1a73e8] shadow-sm"
                : "text-[#6b7280] hover:bg-white",
            ].join(" ")}
            title="Grid view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                fill="currentColor"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                fill="currentColor"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                fill="currentColor"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onChangeLayout("list")}
            className={[
              "flex h-8 w-9 items-center justify-center rounded-full text-sm transition",
              layout === "list"
                ? "bg-white text-[#1a73e8] shadow-sm"
                : "text-[#6b7280] hover:bg-white",
            ].join(" ")}
            title="List view"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="5"
                width="16"
                height="2"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="4"
                y="11"
                width="16"
                height="2"
                rx="1"
                fill="currentColor"
              />
              <rect
                x="4"
                y="17"
                width="16"
                height="2"
                rx="1"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {rightSlot}
        {canCreateFolder && (
          <button
            type="button"
            onClick={onNewFolder}
            className="inline-flex items-center gap-2 rounded-full border border-[#d7def0] bg-white px-4 py-2 text-sm font-medium text-[#1a73e8] transition hover:border-[#1a73e8] hover:bg-[#eef3ff]"
          >
            <svg
              className={iconClass}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 5v14m7-7H5" />
            </svg>
            New folder
          </button>
        )}
        {canUpload && (
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-[#1a73e8] to-[#0b59d0] px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_25px_rgba(26,115,232,0.28)] transition hover:shadow-[0_12px_30px_rgba(26,115,232,0.35)]"
          >
            <svg
              className={iconClass}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 19V5m0 0-5 5m5-5 5 5" />
              <path d="M5 19h14" />
            </svg>
            Upload
          </button>
        )}
      </div>
    </div>
  );
};

export default DriveToolbar;
