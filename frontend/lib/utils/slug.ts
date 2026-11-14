export function toCleanSlug(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getBranchSlug(branch: { name: string; slug?: string; branchCode?: string; id?: string }): string {
  if (branch.slug) return branch.slug;
  if (branch.name) return toCleanSlug(branch.name);
  if (branch.branchCode) return branch.branchCode.toLowerCase();
  return branch.id || '';
}

export function getBranchUrl(branch: { name: string; slug?: string; branchCode?: string; id?: string }): string {
  return `/chi-nhanh/${getBranchSlug(branch)}`;
}
