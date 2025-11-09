"use client";

import Link from "next/link";
import type { FC } from "react";

type BreadcrumbItem = {
  id: string | null;
  name: string;
};

type DriveBreadcrumbProps = {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
};

export const DriveBreadcrumb: FC<DriveBreadcrumbProps> = ({
  items,
  onNavigate,
}) => {
  if (!items.length) return null;

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-[#5f6368]">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        if (isLast) {
          return (
            <span
              key={item.id ?? "root"}
              className="font-medium text-[#202124]"
            >
              {item.name}
            </span>
          );
        }

        return (
          <span key={item.id ?? `level-${index}`} className="flex items-center">
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="text-[#1a73e8] hover:underline"
            >
              {item.name}
            </button>
            <span className="mx-2 text-[#c4c7c5]">/</span>
          </span>
        );
      })}
    </nav>
  );
};

export default DriveBreadcrumb;

