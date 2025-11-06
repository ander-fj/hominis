import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { formatDate, formatNumber } from './format';

export interface ExportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

export function exportToXLSX(data: ExportData) {
  const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);

  const colWidths = data.headers.map((_, colIndex) => {
    const maxLength = Math.max(
      data.headers[colIndex].length,
      ...data.rows.map(row => String(row[colIndex] || '').length)
    );
    return { wch: Math.min(maxLength + 2, 50) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.title);

  const fileName = `${data.filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(0, 43, 85);
  doc.text(data.title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${formatDate(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);

  const startY = 40;
  let currentY = startY;

  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.setFont(undefined, 'bold');

  const colWidths = calculateColumnWidths(data.headers, data.rows);
  let currentX = 14;

  data.headers.forEach((header, index) => {
    doc.text(header, currentX, currentY);
    currentX += colWidths[index];
  });

  currentY += 7;
  doc.setFont(undefined, 'normal');

  data.rows.forEach((row, rowIndex) => {
    if (currentY > 270) {
      doc.addPage();
      currentY = 20;
    }

    currentX = 14;
    row.forEach((cell, colIndex) => {
      const cellText = String(cell || '');
      doc.text(cellText, currentX, currentY);
      currentX += colWidths[colIndex];
    });
    currentY += 7;
  });

  doc.setFontSize(8);
  doc.setTextColor(150);
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Página ${i} de ${pageCount}`, 14, 287);
    doc.text('MRS RH & SST - Sistema Integrado de Gestão', 105, 287, { align: 'center' });
  }

  const fileName = `${data.filename}_${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
}

function calculateColumnWidths(headers: string[], rows: (string | number)[][]): number[] {
  const pageWidth = 180;
  const numCols = headers.length;
  const baseWidth = pageWidth / numCols;

  return headers.map(() => baseWidth);
}

export function exportRankingToPDF(rankings: any[]) {
  const data: ExportData = {
    title: 'Ranking Inteligente de Colaboradores',
    headers: ['Posição', 'Nome', 'Setor', 'Pontuação', 'Variação'],
    rows: rankings.map(r => [
      r.rank_position,
      r.employee_name,
      r.department,
      formatNumber(r.total_score, 2),
      r.variation ? `${r.variation > 0 ? '+' : ''}${formatNumber(r.variation, 1)}%` : '-'
    ]),
    filename: 'ranking_colaboradores'
  };

  exportToPDF(data);
}

export function exportRankingToXLSX(rankings: any[]) {
  const data: ExportData = {
    title: 'Ranking',
    headers: ['Posição', 'Nome', 'Setor', 'Pontuação', 'Variação %'],
    rows: rankings.map(r => [
      r.rank_position,
      r.employee_name,
      r.department,
      r.total_score,
      r.variation || 0
    ]),
    filename: 'ranking_colaboradores'
  };

  exportToXLSX(data);
}

export function exportDashboardToPDF(title: string, stats: any) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setTextColor(0, 43, 85);
  doc.text(title, 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Relatório gerado em: ${formatDate(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 32);

  let currentY = 45;
  doc.setFontSize(12);
  doc.setTextColor(0);

  Object.entries(stats).forEach(([key, value]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    doc.text(`${label}: ${value}`, 14, currentY);
    currentY += 8;
  });

  const fileName = `${title.toLowerCase().replace(/\s+/g, '_')}_${formatDate(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
