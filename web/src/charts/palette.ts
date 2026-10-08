// Chart colours. The eight categorical hues are the data-viz skill's validated dark set, checked against
// the app's panel colour (#121A2E): lightness band, chroma, colour-blind separation of neighbours,
// normal-vision separation and contrast all pass. They are used in this fixed order and never cycled:
// a series keeps its colour. One series uses the first colour.
export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const;

/** The colour of the nth series (falls back to the last, never invents a hue). */
export function seriesColor(i: number): string {
  return SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)] as string;
}

export const OTHER_COLOR = '#6b7589';
