// Legacy store-name corrections. Generated drafts sometimes name a retired combination of stores;
// each rule rewrites it to the current display names. Applied in order, before the other copy rules.
// Kept in one place so the names are not spread through the publish code.

export const LEGACY_STORE_NAME_FIXES: [RegExp, string][] = [
  [/MyBrickHouse,\s*Toycra,\s*and\s*Jaiman\s*Toys/gi, 'LEGO.in and Toycra'],
  [/Toycra,\s*and\s*Jaiman\s*Toys/gi,                 'Toycra'],
  [/MyBrickHouse\s*and\s*Jaiman\s*Toys/gi,             'LEGO.in and Toycra'],
  [/,?\s*and\s*Jaiman\s*Toys/gi,                       ''],
  [/Jaiman\s*Toys/gi,                                  'Toycra'],
];
