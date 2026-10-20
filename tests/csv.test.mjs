import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../lib/csv.ts";
const header = "sku,artist,title,price,cost,quantity,daysOnShelf,genre";
test("BOM, CRLF, quoted commas and escaped quotes preserve real inventory text", () => {
  const r = parseCsv(
    "\uFEFF" +
      header +
      '\r\na,"Tyler, the Creator","A ""quoted"" record",32,18,2,124,Hip-hop\r\n',
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].artist, "Tyler, the Creator");
  assert.equal(r[0].title, 'A "quoted" record');
  assert.equal(r[0].price, 32);
});
test("CSV rejects unclosed quotes and mismatched field counts", () => {
  assert.throws(() => parseCsv(header + '\na,"unfinished'), /unclosed quote/);
  assert.throws(() => parseCsv(header + "\na,b,c,1,2,3,4"), /wrong number/);
});
test("CSV rejects missing headers, nonfinite numbers, empty stock and oversized lists", () => {
  assert.throws(() => parseCsv("sku,artist\na,b"), /missing/);
  assert.throws(
    () => parseCsv(header + "\na,b,c,Infinity,1,1,1,Jazz"),
    /number/,
  );
  assert.throws(() => parseCsv(header), /between 1 and 50/);
  assert.throws(
    () =>
      parseCsv(
        header +
          "\n" +
          Array.from(
            { length: 51 },
            (_, i) => `${i},Artist,Title,20,10,1,50,Soul`,
          ).join("\n"),
      ),
    /between 1 and 50/,
  );
});
test("CSV export neutralizes formula text while preserving numeric fields", () => {
  const csv = toCsv([
    {
      sku: '=HYPERLINK("bad")',
      artist: " +SUM(1)",
      title: "@formula",
      genre: "\tformula",
      price: 20,
      cost: 10,
      quantity: 1,
      daysOnShelf: 50,
    },
  ]);
  const parsed = parseCsv(csv);
  assert.ok(parsed[0].sku.startsWith("'="));
  assert.ok(parsed[0].artist.startsWith("' +"));
  assert.equal(parsed[0].price, 20);
  assert.ok(parsed[0].title.startsWith("'@"));
});
test("ordinary inventory round-trips through export and import", () => {
  const stock = [
    {
      sku: "A1",
      artist: "Massive Attack",
      title: "Mezzanine",
      price: 36,
      cost: 22,
      quantity: 3,
      daysOnShelf: 160,
      genre: "Trip-hop",
    },
  ];
  assert.deepEqual(parseCsv(toCsv(stock)), stock);
});
test("duplicate required headers cannot silently overwrite a stock price", () => {
  assert.throws(
    () => parseCsv(header + ",price\na,Artist,Title,20,10,1,50,Soul,200"),
    /headers must be unique/,
  );
});
test("malformed quotes cannot silently alter artist or title text", () => {
  assert.throws(
    () => parseCsv(header + '\na,Ar"ti"st,Title,20,10,1,50,Soul'),
    /whole field/,
  );
  assert.throws(
    () => parseCsv(header + '\na,"Artist"suffix,Title,20,10,1,50,Soul'),
    /closing quote/,
  );
});
