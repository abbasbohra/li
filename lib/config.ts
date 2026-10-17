// Photo-match confidence settings (similarity is 0 to 1). Tune these after testing with your own products.
export const EXACT_MIN = 0.9;   // best match must score at least this to be called "exact"
export const EXACT_GAP = 0.05;  // ...and beat the 2nd product by at least this much
export const LEARN_MIN = 0.6;   // a tapped match below this is NOT saved as learning data
export const NO_CATEGORY = '__none__'; // products saved without a category
