export type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

const FALLBACK_CURRENCIES = [
  'USD',
  'BRL',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'ARS',
  'MXN',
  'CLP',
  'COP',
];

// Known non-tender, testing, precious metals or legacy codes to exclude from UI
// Keep XAF/XOF/XPF (current tender), but exclude XAU/XAG/XPT/XPD, XDR, XXX, XTS, XBA..XBD, XSU, XUA, XFO, XFU, etc.
const EXCLUDED_CODES = new Set<string>([
  'XAU', 'XAG', 'XPT', 'XPD', // precious metals
  'XDR', 'XUA', 'XSU', // IMF/units
  'XTS', 'XXX', // testing/unknown
  'XBA', 'XBB', 'XBC', 'XBD', // European units (bond markets)
  'XFO', 'XFU', // historic francs
  // Common legacy/obsolete national codes (pre-euro and others)
  'BRB', 'BRC', 'BRE', 'BRN', 'BRR', // Brazilian legacy (incl. Cruzado Real BRR)
  'RUR', // Russian ruble (1991–1998)
  'BYR', // Belarusian ruble (2000–2016)
  'MXP', // Mexican peso (1861–1992)
  'VEF', // Venezuelan bolívar fuerte (2008–2018)
  'ZWD', 'ZWR', 'ZWN', // Zimbabwe legacy
  'TRL', // Turkish lira (pre-2005)
  'ROL', // Romanian leu (pre-2005)
  'PLZ', // Polish zloty (1950–1995)
  'PTE', 'ESP', 'ITL', 'FRF', 'DEM', 'NLG', 'BEF', 'LUF', 'IEP', 'ATS', 'GRD', // pre-euro
]);

export function getCurrencyOptions(locale = 'en-US'): CurrencyOption[] {
  const codes = (() => {
    const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    if (typeof anyIntl.supportedValuesOf === 'function') {
      try {
        return anyIntl.supportedValuesOf('currency') ?? FALLBACK_CURRENCIES;
      } catch {
        return FALLBACK_CURRENCIES;
      }
    }
    return FALLBACK_CURRENCIES;
  })();

  let displayNames: Intl.DisplayNames | null = null;
  try {
    // Some environments may not support DisplayNames for currency
    displayNames = new Intl.DisplayNames([locale], { type: 'currency' });
  } catch {
    displayNames = null;
  }

  const options = codes
    .map((code) => {
      let name = code;
      try {
        name = displayNames?.of(code) ?? code;
      } catch {
        name = code;
      }

      let symbol = code;
      try {
        // Format zero with currency to derive symbol; strip digits and spaces
        const formatted = (0).toLocaleString(locale, {
          style: 'currency',
          currency: code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
        // Heuristic: remove digits, separators, minus signs to isolate symbol/code
        symbol = formatted.replace(/[\d\s.,-]/g, '').trim() || code;
      } catch {
        symbol = code;
      }

      return { code, name, symbol } as CurrencyOption;
    })
    // Exclude known non-tender/testing and legacy codes
    .filter((opt) => !EXCLUDED_CODES.has(opt.code))
    // If display name includes a year range in parentheses (e.g., "(1993–1994)"), treat as historic and exclude
    .filter((opt) => !/\(.*\d{4}(?:–|-)?\d{0,4}.*\)/.test(opt.name))
    // Deduplicate any oddities
    .filter((v, i, a) => a.findIndex((x) => x.code === v.code) === i)
    // Sort by localized name
    .sort((a, b) => a.name.localeCompare(b.name));

  return options;
}
