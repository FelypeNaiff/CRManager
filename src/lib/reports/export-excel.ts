import * as XLSX from "xlsx";

export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) {
    console.warn("Não data to export");
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");

  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];
  const timeStr = today.toTimeString().split(" ")[0].replace(/:/g, "");
  
  XLSX.writeFile(workbook, `${filename}_${dateStr}_${timeStr}.xlsx`);
}
