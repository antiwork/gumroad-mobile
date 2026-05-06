const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export const formatBytes = (n: number | null | undefined): string => {
  if (n == null || n <= 0) return "—";
  if (n < KB) return `${n} B`;
  if (n < MB) return `${(n / KB).toFixed(1)} KB`;
  if (n < GB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / GB).toFixed(2)} GB`;
};
