/**
 * Utility for generating clean Vietnamese SEO slugs and handling duplicates
 */

export function toCleanSlug(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Generate a unique product slug, appending -sp2, -sp3, etc. if collision occurs.
 */
export async function generateUniqueProductSlug(
  prisma: any,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = toCleanSlug(name) || 'san-pham';
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${base}-sp${counter}`;
    counter++;
  }
}

/**
 * Generate a unique category slug, appending -dm2, -dm3, etc. if collision occurs.
 */
export async function generateUniqueCategorySlug(
  prisma: any,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = toCleanSlug(name) || 'danh-muc';
  let candidate = base;
  let counter = 2;

  while (true) {
    const existing = await prisma.category.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeId) {
      return candidate;
    }

    candidate = `${base}-dm${counter}`;
    counter++;
  }
}
