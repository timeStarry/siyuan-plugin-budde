/** Budde's original asymmetric sprout: a gently curved stem with a lower
 * tender bud and an upward-unfolding main leaf. Shared by the host and UI;
 * intentionally not the generic Lucide Sprout used by other products. */
export const BUDDE_MARK = {
  viewBox: "0 0 24 24",
  path: "M11.2 21.5C11.2 18 11.5 15 12 12.4M11.5 16C6.6 16 4.1 13.2 3.8 8.4C8.4 7.9 11.1 10.6 11.5 16ZM12 12.4C12.4 6.2 15.6 3 20.5 3.4C20.3 8.9 17.4 12.4 12 12.4Z",
  strokeWidth: 1.75,
} as const;

export const BUDDE_ICON_SYMBOL = `<symbol id="iconBudde" viewBox="${BUDDE_MARK.viewBox}" fill="none" stroke="currentColor" stroke-width="${BUDDE_MARK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important;stroke:currentColor!important"><path fill="none" stroke="currentColor" stroke-width="${BUDDE_MARK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important;stroke:currentColor!important" d="${BUDDE_MARK.path}"/></symbol>`;
