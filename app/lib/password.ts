const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^\d+/, "")
    .slice(0, 6);
}

export function generateFriendlyPassword(
  email: string,
  name?: string | null
): string {
  const baseCandidate =
    slugify(name || "") || slugify(email.split("@")[0] || "");
  const core = baseCandidate.length >= 3 ? baseCandidate : "alf";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
  }
  return `${core}${suffix}`.slice(0, 12);
}
