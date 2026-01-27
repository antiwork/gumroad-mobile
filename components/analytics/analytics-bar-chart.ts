import { useCSSVariable } from "uniwind";

export interface ChartDataPoint {
  value: number;
  label?: string;
  frontColor?: string;
  topLabelComponent?: () => React.ReactNode;
}

export const useChartColors = () => {
  const [accent, muted, foreground, background, border] = useCSSVariable([
    "--color-accent",
    "--color-muted",
    "--color-foreground",
    "--color-background",
    "--color-border",
  ]);

  return {
    accent: accent as string,
    muted: muted as string,
    foreground: foreground as string,
    background: background as string,
    border: border as string,
  };
};

export const formatCurrency = (cents: number): string => {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toFixed(2)}`;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

export const getMinBarValue = (values: number[]): number => {
  const positiveValues = values.filter((v) => v > 0);
  if (positiveValues.length === 0) return 1;
  const minPositive = Math.min(...positiveValues);
  const maxValue = Math.max(...values, 1);
  return Math.min(minPositive, maxValue / 75);
};
