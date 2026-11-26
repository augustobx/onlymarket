/**
 * Normalizes text for accent-insensitive, case-insensitive product search.
 */
export function normalizeSearch(value){
 return String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLowerCase()
  .trim();
}

/**
 * Checks whether every space-separated token in query appears in at least one candidate field.
 */
export function matchesSearch(query,fields){
 const normalizedQuery=normalizeSearch(query);
 if(!normalizedQuery)return true;
 const tokens=normalizedQuery.split(/\s+/).filter(Boolean);
 const haystack=fields.map(normalizeSearch).join(" ");
 return tokens.every(token=>haystack.includes(token));
}
