export const formatStatNumber = (value: number | null | undefined, placeholder = "--"): string => {
  if (value == null) return placeholder;
  return value.toLocaleString();
};

export const formatStatPercent = (rate: number | null | undefined, placeholder = "--"): string => {
  if (rate == null) return placeholder;
  return `${Math.round(rate * 100)}%`;
};
