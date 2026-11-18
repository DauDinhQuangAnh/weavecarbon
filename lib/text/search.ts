/** Lower-case and strip Vietnamese diacritics so "thep" matches "Thép". */
export const foldVietnamese = (value: string | null | undefined): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export const matchesSearch = (query: string, ...fields: Array<string | null | undefined>): boolean => {
  const needle = foldVietnamese(query);
  if (!needle) return true;
  return fields.some((field) => foldVietnamese(field).includes(needle));
};
