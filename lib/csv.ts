import type { InventoryItem } from "./types";
export const csvFields = [
  "sku",
  "artist",
  "title",
  "price",
  "cost",
  "quantity",
  "daysOnShelf",
  "genre",
];
export function toCsv(items: InventoryItem[]) {
  return [
    csvFields.join(","),
    ...items.map((item) =>
      csvFields
        .map((k) => {
          const value = item[k as keyof InventoryItem] ?? "";
          const text = String(value);
          // Prevent merchant-entered text from becoming a spreadsheet formula.
          const safe =
            typeof value === "string" && /^(?:\s*[=+\-@]|[\t\r\n])/.test(text)
              ? "'" + text
              : text;
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(","),
    ),
  ].join("\n");
}
export function parseCsv(source: string): InventoryItem[] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closedQuote = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        closedQuote = true;
      } else {
        if (closedQuote || value.trim())
          throw new Error("CSV quotes must enclose a whole field.");
        quoted = true;
      }
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
      closedQuote = false;
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
      closedQuote = false;
    } else {
      if (closedQuote && c.trim())
        throw new Error("CSV contains text after a closing quote.");
      value += c;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quote.");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers =
    rows.shift()?.map((h) => h.trim().replace(/^\uFEFF/, "")) || [];
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV column headers must be unique.");
  for (const field of csvFields)
    if (!headers.includes(field))
      throw new Error(`CSV is missing the ${field} column.`);
  if (!rows.length || rows.length > 50)
    throw new Error("Upload between 1 and 50 inventory records.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`Row ${i + 2} has the wrong number of columns.`);
    const x = Object.fromEntries(headers.map((h, j) => [h, r[j]?.trim()]));
    for (const field of ["price", "cost", "quantity", "daysOnShelf"]) {
      if (x[field] === "" || !Number.isFinite(Number(x[field])))
        throw new Error(`Row ${i + 2}: ${field} must be a number.`);
    }
    return {
      sku: x.sku,
      artist: x.artist,
      title: x.title,
      genre: x.genre,
      price: Number(x.price),
      cost: Number(x.cost),
      quantity: Number(x.quantity),
      daysOnShelf: Number(x.daysOnShelf),
    };
  });
}
