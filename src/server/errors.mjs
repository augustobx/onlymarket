export function actionError(error, fallback = "No se pudo completar la operación", uniqueMessage = "Ya existe un registro con esos datos") {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "P2002") return uniqueMessage;
    if (error.code === "P2025") return "El registro indicado no existe o no pertenece a este comercio.";
    if (error.code === "P2034") return "Conflicto de concurrencia. Reintentá la operación.";
    return fallback;
  }
  if (error instanceof Error && !error.message.includes("\n") && error.message.length <= 180) {
    return error.message;
  }
  return fallback;
}
