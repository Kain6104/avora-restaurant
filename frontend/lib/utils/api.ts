export const buildApiUrl = (path: string, params: Record<string, string | number | boolean | null | undefined>) => {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'ALL') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};
