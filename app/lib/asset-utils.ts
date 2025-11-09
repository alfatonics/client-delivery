/**
 * Auto-detect asset type from MIME type or file extension
 */
export function detectAssetType(
  contentType: string,
  filename?: string
): "SCRIPT" | "IMAGE" | "AUDIO" | "OTHER" {
  // Check by MIME type first
  if (contentType) {
    if (contentType.startsWith("image/")) {
      return "IMAGE";
    }
    if (contentType.startsWith("audio/")) {
      return "AUDIO";
    }
    if (contentType.startsWith("video/")) {
      return "OTHER"; // Videos are treated as OTHER for now
    }
    // Text-based files that could be scripts
    if (
      contentType.includes("text/") ||
      contentType.includes("application/json") ||
      contentType.includes("application/javascript") ||
      contentType.includes("application/xml")
    ) {
      return "SCRIPT";
    }
  }

  // Fallback to file extension if MIME type is not specific
  if (filename) {
    const ext = filename.toLowerCase().split(".").pop() || "";
    const imageExts = [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "bmp",
      "ico",
    ];
    const audioExts = ["mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"];
    const scriptExts = [
      "txt",
      "doc",
      "docx",
      "pdf",
      "md",
      "json",
      "js",
      "ts",
      "jsx",
      "tsx",
      "html",
      "css",
      "xml",
      "csv",
    ];

    if (imageExts.includes(ext)) return "IMAGE";
    if (audioExts.includes(ext)) return "AUDIO";
    if (scriptExts.includes(ext)) return "SCRIPT";
  }

  return "OTHER";
}


