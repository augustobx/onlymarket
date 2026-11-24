// All quantities are integer grams (KG) or thousandths of a unit (UNIT).
// Money is integer ARS cents. No floating point stock or money arithmetic.
function nonnegative(value, name) {
  if (typeof value !== "bigint" || value < 0n) throw new Error(name + ": entero no negativo requerido");
  return value;
}
export function consumeCost(balance, cost, quantity) {
  nonnegative(balance, "stock"); nonnegative(cost, "costo"); nonnegative(quantity, "cantidad");
  if (quantity === 0n || quantity > balance) throw new Error("Cantidad inválida o stock insuficiente");
  return quantity === balance ? cost : cost * quantity / balance;
}
// Allocate by mass, including gifts and waste, with largest remainder.
// Stable ordering resolves equal remainders. Sum of allocated cost is exact.
export function planTransformation(inputMilli, inputCostCents, outputs) {
  nonnegative(inputMilli, "entrada"); nonnegative(inputCostCents, "costo");
  if (inputMilli === 0n || !Array.isArray(outputs) || outputs.length === 0 || outputs.length > 100)
    throw new Error("Transformación inválida");
  let total = 0n;
  const lines = outputs.map((line, index) => {
    const quantity = nonnegative(line.quantityMilli, "peso");
    if (quantity === 0n || !["STOCK", "GIFT", "WASTE"].includes(line.disposition))
      throw new Error("Salida inválida");
    if (line.disposition === "STOCK" && !line.productId) throw new Error("Producto de salida requerido");
    if (typeof line.reason !== "string" || !line.reason.trim()) throw new Error("Motivo requerido");
    total += quantity;
    const numerator = quantity * inputCostCents;
    return {...line, index, costCents: numerator / inputMilli, remainder: numerator % inputMilli};
  });
  if (total !== inputMilli) throw new Error("El balance de peso no coincide; registrar todas las salidas");
  let rest = inputCostCents - lines.reduce((sum, l) => sum + l.costCents, 0n);
  const ranked = [...lines].sort((a,b) => a.remainder === b.remainder ? a.index-b.index : a.remainder > b.remainder ? -1 : 1);
  for (const line of ranked) { if (!rest) break; line.costCents++; rest--; }
  return lines.map(({index, remainder, ...line}) => line);
}
function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Fecha inválida");
  const ms = Date.parse(value+"T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0,10) !== value) throw new Error("Fecha inválida");
  return ms / 86400000;
}
export function classifyLot({today, expiresOn, reviewOn, alertDays, status, quantityMilli}) {
  nonnegative(quantityMilli, "stock");
  if (!Number.isSafeInteger(alertDays) || alertDays < 0) throw new Error("Días de aviso inválidos");
  const now = day(today);
  const expiry = expiresOn == null ? null : day(expiresOn);
  const review = reviewOn == null ? null : day(reviewOn);
  if (!["AVAILABLE","REVIEW","BLOCKED","EXHAUSTED"].includes(status)) throw new Error("Estado inválido");
  if (quantityMilli === 0n || status === "EXHAUSTED") return "EXHAUSTED";
  // Conservative policy: block beginning on expiration date.
  if (status === "BLOCKED" || (expiry !== null && expiry <= now)) return "BLOCKED";
  if (status === "REVIEW" || (review !== null && review <= now)) return "REVIEW";
  if (expiry !== null && expiry-now <= alertDays) return "EXPIRING";
  return "AVAILABLE";
}
export function allocateFEFO(lots, quantity, today) {
  nonnegative(quantity,"cantidad");
  if (!quantity) throw new Error("Cantidad inválida");
  const eligible = lots.filter(l => ["AVAILABLE","EXPIRING"].includes(classifyLot({...l,today})))
    .sort((a,b) => (a.expiresOn ?? "9999-12-31").localeCompare(b.expiresOn ?? "9999-12-31") ||
      a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id));
  let remaining=quantity;
  const result=[];
  for (const lot of eligible) {
    if (!remaining) break;
    const amount=lot.quantityMilli < remaining ? lot.quantityMilli : remaining;
    result.push({lotId:lot.id,quantityMilli:amount,costCents:consumeCost(lot.quantityMilli,lot.remainingCostCents,amount)});
    remaining-=amount;
  }
  if (remaining) throw new Error("Stock apto insuficiente");
  return result;
}
