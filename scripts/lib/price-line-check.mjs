// Price-line checks for published reviews, used by the weekly refresh. A review's India paragraph
// carries one price line in one of two forms: the old "Priced at ₹X on <stores>, confirmed in stock
// as of <date>." and the new "At review, it was priced at ₹X on <stores>." Both forms are accepted,
// so the weekly refresh works on either.

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when the review already names the expected stores in its price line, in either form. */
export function priceLineNamesStores(content, storesNow) {
  const stores = escapeRegExp(storesNow);
  const oldForm = new RegExp(` on ${stores}, confirmed in stock as of `);
  const newForm = new RegExp(`At review, it was priced at ₹[\\d,]+ on ${stores}\\.`);
  return oldForm.test(content) || newForm.test(content);
}

/** Whether the weekly refresh must rewrite a review: the price, the retailer or the stores differ. */
export function rewriteNeeded({ content, storesNow, oldPrice, newPrice, retailerChanged }) {
  return newPrice !== oldPrice || retailerChanged || !priceLineNamesStores(content || '', storesNow);
}