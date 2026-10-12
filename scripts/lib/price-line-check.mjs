// Price-line checks for published reviews. A review's India paragraph carries one price line in one
// of two forms: the old "Priced at ₹X on <stores>, confirmed in stock as of <date>." and the new
// "At review, it was priced at ₹X on <stores>." Both forms are read here.
//
// The weekly refresh never rewrites the printed price line (approved option a). It only updates the
// stored source columns, and reports when the printed line names different stores.

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

/**
 * What the weekly refresh does for one re-checked review. It returns flags only; the job decides
 * how to write them. The printed text is never part of the result, so it cannot be written.
 *   updateStoredColumns: the source price, retailer, stock and checked time should be updated
 *   storesMismatch: the printed price line does not name the current stores (report only)
 */
export function planPriceUpdate({ content, storesNow, oldPrice, newPrice, retailerChanged }) {
  return {
    updateStoredColumns: newPrice !== oldPrice || retailerChanged,
    storesMismatch: !priceLineNamesStores(content || '', storesNow),
  };
}
