/** Чертежи потолков ЗИПС (AG.Z201–AG.Z205), как на странице Info. */
const ZIPS_CEILING_CAD_BY_ITEM_ID: Record<string, string> = {
  "201": "cad_ceiling_zips_vector.png",
  "202": "cad_ceiling_zips_module.png",
  "203": "cad_ceiling_zips_IIIultra.png",
  "204": "cad_ceiling_zips_Z4.png",
  "205": "cad_ceiling_zips_cinema.png",
};

/** Имя файла чертежа для потолка ЗИПС по шифру AG.Z20x или null. */
export const zipsCeilingCadFilename = (cipher: string): string | null => {
  const m = /^AG\.Z(\d{3})$/i.exec(String(cipher ?? "").trim());
  if (!m) return null;
  return ZIPS_CEILING_CAD_BY_ITEM_ID[m[1]] ?? null;
};
