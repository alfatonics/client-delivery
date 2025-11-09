"use client";

import type { FC } from "react";
import { useId, useMemo } from "react";

type DriveFileIconProps = {
  type: string;
  contentType?: string | null;
  filename?: string | null;
  className?: string;
  size?: number;
  color?: string;
};

type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "doc"
  | "sheet"
  | "slide"
  | "pdf"
  | "archive"
  | "code"
  | "text"
  | "design"
  | "other";

const MEDIA_EXTENSIONS = {
  image: new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "svg",
    "bmp",
    "ico",
    "heic",
    "heif",
  ]),
  audio: new Set([
    "mp3",
    "wav",
    "m4a",
    "aac",
    "flac",
    "ogg",
    "oga",
    "opus",
    "wma",
  ]),
  video: new Set([
    "mp4",
    "mov",
    "wmv",
    "avi",
    "flv",
    "webm",
    "mkv",
    "m4v",
    "3gp",
  ]),
};

const DOCUMENT_EXTENSIONS = {
  doc: new Set(["doc", "docx", "rtf", "pages", "odt", "rtfd"]),
  sheet: new Set(["xls", "xlsx", "csv", "numbers", "ods"]),
  slide: new Set(["ppt", "pptx", "key", "odp"]),
  pdf: new Set(["pdf"]),
  text: new Set(["txt", "md", "markdown", "log", "json", "yml", "yaml"]),
  code: new Set([
    "js",
    "ts",
    "tsx",
    "jsx",
    "py",
    "rb",
    "php",
    "java",
    "c",
    "cpp",
    "cs",
    "go",
    "rs",
    "swift",
    "kt",
    "sh",
    "bat",
    "sql",
    "html",
    "css",
    "scss",
    "sass",
    "xml",
  ]),
};

const DESIGN_EXTENSIONS = new Set([
  "psd",
  "ai",
  "xd",
  "fig",
  "sketch",
  "indd",
  "cdr",
]);

const ARCHIVE_EXTENSIONS = new Set([
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  "bz2",
  "dmg",
]);

const CATEGORY_STYLES: Record<
  FileCategory,
  { accent: string; accentLight: string; background: string }
> = {
  image: { accent: "#1A73E8", accentLight: "#E8F0FE", background: "#FFFFFF" },
  video: { accent: "#EA4335", accentLight: "#FCE8E6", background: "#FFFFFF" },
  audio: { accent: "#34A853", accentLight: "#E6F4EA", background: "#FFFFFF" },
  doc: { accent: "#1967D2", accentLight: "#E8F0FE", background: "#FFFFFF" },
  sheet: { accent: "#0F9D58", accentLight: "#E6F4EA", background: "#FFFFFF" },
  slide: { accent: "#F9AB00", accentLight: "#FEF7E0", background: "#FFFFFF" },
  pdf: { accent: "#D93025", accentLight: "#FDE8E6", background: "#FFFFFF" },
  archive: { accent: "#5F6368", accentLight: "#F1F3F4", background: "#FFFFFF" },
  code: { accent: "#9334E6", accentLight: "#F3E8FD", background: "#FFFFFF" },
  text: { accent: "#3C4043", accentLight: "#E8EAED", background: "#FFFFFF" },
  design: { accent: "#A142F4", accentLight: "#F3E8FD", background: "#FFFFFF" },
  other: { accent: "#607D8B", accentLight: "#ECEFF1", background: "#FFFFFF" },
};

const startsWith = (value: string | undefined | null, prefix: string) =>
  value?.toLowerCase().startsWith(prefix) ?? false;

const getExtension = (filename?: string | null) => {
  if (!filename) return "";
  const base = filename.split(".").pop();
  return (base ?? "").toLowerCase();
};

const detectCategory = (
  type: string,
  contentType: string | null | undefined,
  filename: string | null | undefined
): FileCategory => {
  const normalizedType = type?.toUpperCase?.() ?? "";
  const normalizedContentType = contentType?.toLowerCase() ?? "";
  const extension = getExtension(filename);

  if (
    normalizedType === "IMAGE" ||
    startsWith(contentType, "image/") ||
    MEDIA_EXTENSIONS.image.has(extension)
  ) {
    return "image";
  }

  if (
    normalizedType === "VIDEO" ||
    startsWith(contentType, "video/") ||
    MEDIA_EXTENSIONS.video.has(extension)
  ) {
    return "video";
  }

  if (
    normalizedType === "AUDIO" ||
    startsWith(contentType, "audio/") ||
    MEDIA_EXTENSIONS.audio.has(extension)
  ) {
    return "audio";
  }

  if (
    DOCUMENT_EXTENSIONS.doc.has(extension) ||
    normalizedContentType.includes("word") ||
    normalizedContentType.includes("rtf")
  ) {
    return "doc";
  }

  if (
    DOCUMENT_EXTENSIONS.sheet.has(extension) ||
    normalizedContentType.includes("sheet") ||
    normalizedContentType.includes("excel") ||
    normalizedContentType.includes("csv")
  ) {
    return "sheet";
  }

  if (
    DOCUMENT_EXTENSIONS.slide.has(extension) ||
    normalizedContentType.includes("presentation") ||
    normalizedContentType.includes("powerpoint")
  ) {
    return "slide";
  }

  if (
    DOCUMENT_EXTENSIONS.pdf.has(extension) ||
    normalizedContentType.includes("pdf")
  ) {
    return "pdf";
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return "archive";
  }

  if (
    DESIGN_EXTENSIONS.has(extension) ||
    normalizedContentType.includes("adobe") ||
    normalizedContentType.includes("figma")
  ) {
    return "design";
  }

  if (
    DOCUMENT_EXTENSIONS.code.has(extension) ||
    normalizedContentType.includes("json") ||
    normalizedContentType.includes("javascript") ||
    normalizedContentType.includes("typescript") ||
    normalizedContentType.includes("xml") ||
    normalizedContentType.includes("html")
  ) {
    return "code";
  }

  if (
    DOCUMENT_EXTENSIONS.text.has(extension) ||
    normalizedContentType.startsWith("text/")
  ) {
    return "text";
  }

  return "other";
};

const renderDocumentIcon = ({
  size,
  className,
  accent,
  accentLight,
  background,
  detail,
  gradientId,
}: {
  size: number;
  className?: string;
  accent: string;
  accentLight: string;
  background: string;
  detail:
    | "lines"
    | "grid"
    | "presentation"
    | "pdf"
    | "code"
    | "text"
    | "design";
  gradientId: string;
}) => {
  const detailElements = (() => {
    switch (detail) {
      case "grid":
        return (
          <>
            <rect x="14" y="18" width="20" height="2" rx="1" fill={accent} />
            <rect x="14" y="24" width="20" height="2" rx="1" fill={accent} />
            <rect x="14" y="30" width="20" height="2" rx="1" fill={accent} />
            <rect x="14" y="36" width="20" height="2" rx="1" fill={accent} />
            <rect x="20" y="12" width="2" height="28" rx="1" fill={accent} />
            <rect x="26" y="12" width="2" height="28" rx="1" fill={accent} />
            <rect x="32" y="12" width="2" height="28" rx="1" fill={accent} />
          </>
        );
      case "presentation":
        return (
          <>
            <rect
              x="14"
              y="20"
              width="20"
              height="14"
              rx="2"
              fill={accent}
              opacity="0.2"
            />
            <rect x="16" y="22" width="16" height="10" rx="1" fill={accent} />
            <rect x="16" y="34" width="8" height="2" rx="1" fill={accent} />
            <rect x="26" y="34" width="6" height="2" rx="1" fill={accent} />
          </>
        );
      case "pdf":
        return (
          <>
            <path
              d="M18 22c2 4 6 6 10 8-4 0-6 2-8 4-.5-3-2-5-4-6 2-2 2-4 2-6z"
              fill={accent}
              opacity="0.7"
            />
            <rect x="16" y="34" width="16" height="2" rx="1" fill={accent} />
            <rect x="16" y="28" width="10" height="2" rx="1" fill={accent} />
          </>
        );
      case "code":
        return (
          <>
            <path
              d="M18 26l-4 4 4 4"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M30 26l4 4-4 4"
              stroke={accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="22" y="22" width="4" height="12" rx="1" fill={accent} />
          </>
        );
      case "design":
        return (
          <>
            <circle cx="24" cy="30" r="6" fill={accent} opacity="0.18" />
            <path d="M24 20l5 10h-10l5-10z" fill={accent} opacity="0.9" />
          </>
        );
      case "text":
      case "lines":
      default:
        return (
          <>
            <rect x="14" y="20" width="18" height="2" rx="1" fill={accent} />
            <rect x="14" y="26" width="16" height="2" rx="1" fill={accent} />
            <rect x="14" y="32" width="20" height="2" rx="1" fill={accent} />
            <rect x="14" y="38" width="12" height="2" rx="1" fill={accent} />
          </>
        );
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient
          id={`${gradientId}-paper`}
          x1="12"
          y1="6"
          x2="34"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor={background} />
        </linearGradient>
      </defs>
      <path
        d="M14 6h14l10 10v22a4 4 0 01-4 4H14a4 4 0 01-4-4V10a4 4 0 014-4z"
        fill={`url(#${gradientId}-paper)`}
      />
      <path d="M28 6v8a4 4 0 004 4h8" fill={accentLight} />
      <path d="M28 6l12 12h-8a4 4 0 01-4-4V6z" fill={accent} opacity="0.8" />
      <rect x="14" y="16" width="20" height="2.5" rx="1.25" fill={accent} />
      {detailElements}
    </svg>
  );
};

const renderMediaIcon = ({
  size,
  className,
  accent,
  accentLight,
  background,
  type,
}: {
  size: number;
  className?: string;
  accent: string;
  accentLight: string;
  background: string;
  type: "image" | "video" | "audio";
}) => {
  if (type === "image") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className={className}
      >
        <rect x="6" y="10" width="36" height="28" rx="6" fill={accentLight} />
        <path d="M14 30l6-8 6 7 4-5 8 10H14z" fill={accent} opacity="0.8" />
        <circle cx="19" cy="20" r="4" fill={accent} />
        <rect
          x="6"
          y="10"
          width="36"
          height="28"
          rx="6"
          stroke={accent}
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    );
  }

  if (type === "video") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        className={className}
      >
        <rect x="6" y="12" width="28" height="24" rx="4" fill={accentLight} />
        <path d="M20 20v12l10-6-10-6z" fill={accent} opacity="0.9" />
        <rect
          x="6"
          y="12"
          width="28"
          height="24"
          rx="4"
          stroke={accent}
          strokeWidth="1.5"
        />
        <path d="M34 18l8-6v24l-8-6" fill={accent} opacity="0.6" />
        <path
          d="M34 18l8-6v24l-8-6"
          stroke={accent}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
    >
      <rect x="10" y="8" width="28" height="32" rx="6" fill={accentLight} />
      <path
        d="M22 18h4v12.5a3.5 3.5 0 11-4.9 3.2"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="32" r="4" fill={accent} />
      <rect
        x="10"
        y="8"
        width="28"
        height="32"
        rx="6"
        stroke={accent}
        strokeWidth="1.5"
      />
    </svg>
  );
};

export const DriveFileIcon: FC<DriveFileIconProps> = ({
  type,
  contentType,
  filename,
  className,
  size = 40,
  color,
}) => {
  const category = useMemo(
    () => detectCategory(type, contentType, filename),
    [type, contentType, filename]
  );

  const gradientId = useId();
  const { accent, accentLight, background } = CATEGORY_STYLES[category];
  const resolvedAccent = color ?? accent;

  if (category === "image" || category === "video" || category === "audio") {
    return renderMediaIcon({
      size,
      className,
      accent: resolvedAccent,
      accentLight,
      background,
      type: category,
    });
  }

  const detailType: Parameters<typeof renderDocumentIcon>[0]["detail"] =
    category === "sheet"
      ? "grid"
      : category === "slide"
      ? "presentation"
      : category === "pdf"
      ? "pdf"
      : category === "code"
      ? "code"
      : category === "design"
      ? "design"
      : category === "text"
      ? "text"
      : "lines";

  return renderDocumentIcon({
    size,
    className,
    accent: resolvedAccent,
    accentLight,
    background,
    detail: detailType,
    gradientId,
  });
};

export default DriveFileIcon;
