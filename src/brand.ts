/** Budde's original upright, round-ended sprout. Shared by the host and UI;
 * intentionally not the generic Lucide Sprout used by other products. */
export const BUDDE_MARK = {
  viewBox: "0 0 24 24",
  path: "M12 22V12M12 14C5 14 3 10 3 3c6-1 9 2 9 11Zm0 0c0-9 3-12 9-11 0 7-2 11-9 11Z",
  strokeWidth: 1.75,
} as const;

export const BUDDE_ICON_SYMBOL = `<symbol id="iconBudde" viewBox="${BUDDE_MARK.viewBox}" fill="none" stroke="currentColor" stroke-width="${BUDDE_MARK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important;stroke:currentColor!important"><path fill="none" stroke="currentColor" stroke-width="${BUDDE_MARK.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" style="fill:none!important;stroke:currentColor!important" d="${BUDDE_MARK.path}"/></symbol>`;
