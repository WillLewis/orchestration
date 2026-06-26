export function slugify(heading: string, seen: Set<string>): string {
  const base = toBaseSlug(heading);
  let slug = base;
  let suffix = 1;

  while (seen.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  seen.add(slug);
  return slug;
}

function toBaseSlug(heading: string): string {
  const slug = heading
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}
