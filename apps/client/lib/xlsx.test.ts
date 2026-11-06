import { describe, expect, it } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { lineasDeTabla } from "./factura";
import { leerCsv, leerXlsx } from "./xlsx";

/** Un .xlsx chico armado a mano, como lo guarda Excel (textos compartidos + números). */
function xlsxDePrueba(): Uint8Array {
  const libro = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Recibo" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/hoja.xml"/></Relationships>`;
  const compartidos = `<sst><si><t>Recibo digital #42</t></si><si><t>Descripción</t></si><si><t>Cantidad</t></si><si><t>Precio</t></si><si><r><t>Harina </t></r><r><t>PAN &amp; Co</t></r></si><si><t>Arroz Mary</t></si><si><t>TOTAL</t></si></sst>`;
  const hoja = `<worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c></row>
    <row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4"><v>2</v></c><c r="C4"><v>3.5</v></c></row>
    <row r="5"><c r="A5" t="s"><v>5</v></c><c r="C5"><v>2</v></c><c r="B5"><f>1+2</f><v>3</v></c></row>
    <row r="6"><c r="A6" t="inlineStr"><is><t>Café molido</t></is></c><c r="B6" t="str"><v>1</v></c></row>
    <row r="7"><c r="A7" t="s"><v>6</v></c><c r="B7"><v>6</v></c></row>
  </sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(libro),
    "xl/_rels/workbook.xml.rels": strToU8(rels),
    "xl/sharedStrings.xml": strToU8(compartidos),
    "xl/worksheets/hoja.xml": strToU8(hoja),
  });
}

describe("leerXlsx", () => {
  it("lee la primera hoja con textos compartidos, números y fórmulas", () => {
    const filas = leerXlsx(xlsxDePrueba());
    expect(filas[0]).toEqual(["Recibo digital #42"]);
    expect(filas[1]).toEqual(["Descripción", "Cantidad", "Precio"]);
    expect(filas[2]).toEqual(["Harina PAN & Co", 2, 3.5]);
    expect(filas[3]).toEqual(["Arroz Mary", 3, 2]);
  });

  it("avisa si no es un Excel", () => {
    expect(() => leerXlsx(strToU8("hola"))).toThrow("no es un Excel");
  });
});

describe("leerCsv", () => {
  it("detecta el separador y respeta las comillas", () => {
    expect(leerCsv('Producto;Cantidad\n"Harina; PAN";2\r\nArroz;1\n')).toEqual([
      ["Producto", "Cantidad"],
      ["Harina; PAN", "2"],
      ["Arroz", "1"],
    ]);
  });
});

describe("lineasDeTabla", () => {
  it("usa las columnas del encabezado y saltea totales", () => {
    expect(lineasDeTabla(leerXlsx(xlsxDePrueba()))).toEqual([
      { nombre: "Harina PAN & Co", cantidad: 2 },
      { nombre: "Arroz Mary", cantidad: 3 },
      { nombre: "Café molido", cantidad: 1 },
    ]);
  });

  it("sin encabezado lee cada fila como una factura", () => {
    expect(
      lineasDeTabla([
        ["Harina PAN", 2, "3,50"],
        ["Arroz", "x1"],
      ]),
    ).toEqual([
      { nombre: "Harina PAN", cantidad: 2 },
      { nombre: "Arroz", cantidad: 1 },
    ]);
  });

  it("descarta cantidades que no son enteras positivas", () => {
    expect(
      lineasDeTabla([
        ["Producto", "Cant."],
        ["Queso", 0.5],
        ["Pan", -1],
        ["Leche", 2],
      ]),
    ).toEqual([{ nombre: "Leche", cantidad: 2 }]);
  });
});
