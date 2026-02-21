export const getIndexFromX = (
  x: number,
  barWidth: number,
  spacing: number,
  initialSpacing: number,
  dataLength: number,
): number | null => {
  const cellWidth = barWidth + spacing;
  if (cellWidth <= 0 || dataLength <= 0) return null;
  const adjustedX = x - initialSpacing;
  const index = Math.floor(adjustedX / cellWidth);
  if (index < 0) return 0;
  if (index >= dataLength) return dataLength - 1;
  return index;
};
