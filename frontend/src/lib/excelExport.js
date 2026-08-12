import * as XLSX from 'xlsx';

// sheets: [{ name, rows }] — rows нь энгийн object-уудын массив (key бүр
// баганы толгой болно). Excel-ийн sheet нэрний дээд хязгаар 31 тэмдэгт.
export function downloadExcel(filename, sheets) {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
