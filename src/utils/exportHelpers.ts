/**
 * SIMONSU - Export Helpers (Excel & PDF)
 * UPT Laboratorium Kesehatan Kota Bontang
 */

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TemperatureRecord, RoomStatsSummary, PdfExportOptions, Room } from '../types/simonsu';
import { formatDateIndonesia, getLocalDateString } from './storage';
import { generateChartDataUrl } from './chartCanvas';

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  institutionName: 'PEMERINTAH KOTA BONTANG',
  departmentName: 'DINAS KESEHATAN',
  subDepartmentName: 'UPT LABORATORIUM KESEHATAN KOTA BONTANG',
  addressText: 'Jl. Ahmad Yani No. 1, Kota Bontang, Kalimantan Timur',
  contactText: 'Email: labkes@bontangkota.go.id | Telepon: (0548) 21102',
  reportTitle: 'LAPORAN MONITORING SUHU RUANGAN (SIMONSU)',
  cityName: 'Bontang',
  showDualSignatory: false,
  includeChart: true,
  chartMetric: 'both',
  chartCurve: 'monotone',
  primarySignatory: {
    roleTitle: 'Kepala UPT Laboratorium Kesehatan',
    subTitle: 'Kota Bontang',
    name: 'Fajar, S.Tr.AK',
    nip: 'NIP. 19880412 201201 1 002',
  },
  secondarySignatory: {
    roleTitle: 'Petugas Laboratorium',
    subTitle: 'UPT Laboratorium Kesehatan',
    name: 'Ninda, A.Md.AK',
    nip: 'NIP. 19930725 201503 2 004',
  },
};

export function exportToExcel(
  records: TemperatureRecord[],
  summaries: RoomStatsSummary[],
  periodLabel: string,
  selectedRoomName: string
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Rekapitulasi Summary
  const summaryHeader = [
    ['UPT LABORATORIUM KESEHATAN KOTA BONTANG'],
    ['SISTEM MONITORING SUHU RUANGAN (SIMONSU)'],
    [`LAPORAN REKAPITULASI MONITORING SUHU`],
    [`Periode: ${periodLabel}`],
    [`Filter Ruangan: ${selectedRoomName}`],
    [],
    ['No', 'Kode Ruangan', 'Nama Ruangan', 'Jumlah Pencatatan', 'Suhu Min (°C)', 'Suhu Max (°C)', 'Suhu Rata-Rata (°C)', 'Normal', 'Perhatian', 'Kritis']
  ];

  const summaryRows = summaries.map((s, idx) => [
    idx + 1,
    s.room.code,
    s.room.name,
    s.totalRecords,
    s.minTemp !== null ? s.minTemp.toFixed(1) : '-',
    s.maxTemp !== null ? s.maxTemp.toFixed(1) : '-',
    s.avgTemp !== null ? s.avgTemp.toFixed(1) : '-',
    s.normalCount,
    s.perhatianCount,
    s.kritisCount
  ]);

  const wsSummaryData = [...summaryHeader, ...summaryRows];
  const wsSummary = XLSX.utils.aoa_to_sheet(wsSummaryData);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Kode
    { wch: 28 }, // Nama
    { wch: 18 }, // Jumlah
    { wch: 14 }, // Min
    { wch: 14 }, // Max
    { wch: 18 }, // Avg
    { wch: 10 }, // Normal
    { wch: 10 }, // Perhatian
    { wch: 10 }, // Kritis
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekapitulasi Suhu');

  // Sheet 2: Detail Transaksi
  const detailHeader = [
    ['UPT LABORATORIUM KESEHATAN KOTA BONTANG'],
    ['DETAIL PENCATATAN SUHU & KELEMBAPAN RUANGAN'],
    [`Periode: ${periodLabel}`],
    [],
    ['No', 'Tanggal', 'Waktu', 'Kode Ruangan', 'Nama Ruangan', 'Suhu (°C)', 'Kelembapan (% RH)', 'Status', 'Petugas', 'Catatan']
  ];

  const detailRows = records.map((rec, idx) => [
    idx + 1,
    rec.date,
    rec.time,
    rec.room_code || '-',
    rec.room_name || '-',
    rec.temperature.toFixed(1),
    rec.humidity !== undefined ? rec.humidity.toFixed(1) : '-',
    rec.status,
    rec.recorded_by,
    rec.notes || '-'
  ]);

  const wsDetailData = [...detailHeader, ...detailRows];
  const wsDetail = XLSX.utils.aoa_to_sheet(wsDetailData);

  wsDetail['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 8 },  // Waktu
    { wch: 12 }, // Kode
    { wch: 26 }, // Nama
    { wch: 11 }, // Suhu
    { wch: 16 }, // Kelembapan (% RH)
    { wch: 12 }, // Status
    { wch: 20 }, // Petugas
    { wch: 35 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Pencatatan');

  const fileName = `SIMONSU_Laporan_Suhu_${getLocalDateString()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export function exportToPDF(
  records: TemperatureRecord[],
  summaries: RoomStatsSummary[],
  periodLabel: string,
  selectedRoomName: string,
  options: PdfExportOptions = DEFAULT_PDF_OPTIONS,
  selectedRoomObj?: Room
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header / Kop Surat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (options.institutionName) doc.text(options.institutionName.toUpperCase(), pageWidth / 2, 14, { align: 'center' });
  if (options.departmentName) doc.text(options.departmentName.toUpperCase(), pageWidth / 2, 19, { align: 'center' });
  doc.setFontSize(13);
  if (options.subDepartmentName) doc.text(options.subDepartmentName.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (options.addressText) doc.text(options.addressText, pageWidth / 2, 29, { align: 'center' });
  if (options.contactText) doc.text(options.contactText, pageWidth / 2, 33, { align: 'center' });

  // Divider Line
  doc.setLineWidth(0.8);
  doc.line(14, 36, pageWidth - 14, 36);
  doc.setLineWidth(0.2);
  doc.line(14, 37, pageWidth - 14, 37);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(options.reportTitle || 'LAPORAN MONITORING SUHU RUANGAN (SIMONSU)', pageWidth / 2, 44, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const localToday = getLocalDateString();
  doc.text(`Periode: ${periodLabel}`, 14, 51);
  doc.text(`Ruangan: ${selectedRoomName}`, 14, 56);
  doc.text(`Tanggal Cetak: ${formatDateIndonesia(localToday)}`, pageWidth - 14, 51, { align: 'right' });

  // Table 1: Summary Table
  const summaryBody = summaries.map((s, idx) => [
    idx + 1,
    s.room.name,
    s.totalRecords,
    s.minTemp !== null ? `${s.minTemp.toFixed(1)}°C` : '-',
    s.maxTemp !== null ? `${s.maxTemp.toFixed(1)}°C` : '-',
    s.avgTemp !== null ? `${s.avgTemp.toFixed(1)}°C` : '-',
    s.normalCount,
    s.perhatianCount,
    s.kritisCount
  ]);

  autoTable(doc, {
    startY: 61,
    head: [['No', 'Nama Ruangan', 'Pencatatan', 'Min', 'Max', 'Rata-rata', 'Normal', 'Perhatian', 'Kritis']],
    body: summaryBody,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate 900 / Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 45 },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
    }
  });

  const finalY1 = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 70;
  let nextSectionY = finalY1 + 8;

  // Insert Chart Section if enabled (default true)
  if (options.includeChart !== false) {
    try {
      const chartImg = generateChartDataUrl(records, {
        selectedRoom: selectedRoomObj,
        selectedRoomName,
        periodLabel,
        metric: options.chartMetric || 'both',
        curveType: options.chartCurve || 'monotone',
        width: 1600,
        height: 660,
      });

      if (chartImg) {
        const chartWidth = pageWidth - 28; // 182 mm
        const chartHeight = 74; // 74 mm

        // If not enough vertical room on current page, advance to next page
        if (nextSectionY + chartHeight + 10 > pageHeight - 18) {
          doc.addPage();
          nextSectionY = 16;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('Grafik Tren & Fluktuasi Suhu Ruangan:', 14, nextSectionY);

        doc.addImage(chartImg, 'PNG', 14, nextSectionY + 3, chartWidth, chartHeight);
        nextSectionY = nextSectionY + chartHeight + 10;
      }
    } catch (e) {
      console.warn('Gagal merender grafik ke PDF:', e);
    }
  }

  // Table 2: Detail Table Header Title
  if (nextSectionY + 28 > pageHeight - 18) {
    doc.addPage();
    nextSectionY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Rincian Log Pencatatan Suhu & Kelembapan:', 14, nextSectionY);

  const detailBody = records.slice(0, 150).map((rec, idx) => [
    idx + 1,
    rec.date,
    rec.time,
    rec.room_name || '-',
    `${rec.temperature.toFixed(1)}°C`,
    rec.humidity !== undefined ? `${rec.humidity.toFixed(1)}%` : '-',
    rec.status,
    rec.recorded_by,
    rec.notes || '-'
  ]);

  autoTable(doc, {
    startY: nextSectionY + 3,
    head: [['No', 'Tanggal', 'Waktu', 'Ruangan', 'Suhu', 'RH (%)', 'Status', 'Petugas', 'Catatan']],
    body: detailBody,
    theme: 'striped',
    headStyles: {
      fillColor: [2, 132, 199], // Cyan 600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 14 },
      3: { cellWidth: 30 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'center', cellWidth: 22 },
      7: { cellWidth: 26 },
      8: { cellWidth: 'auto' }
    }
  });

  const finalY2 = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? nextSectionY + 14) + 12;

  // Check if signature fits on page or needs new page
  let sigY = finalY2;
  if (sigY + 42 > pageHeight - 15) {
    doc.addPage();
    sigY = 20;
  }

  const todayFormatted = formatDateIndonesia(localToday);
  const cityDateText = `${options.cityName || 'Bontang'}, ${todayFormatted}`;

  if (options.showDualSignatory && options.secondarySignatory) {
    // Dual Signatories
    // Left: Secondary (Petugas / Creator)
    const leftX = 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Dibuat / Diverifikasi Oleh,', leftX, sigY);
    doc.text(options.secondarySignatory.roleTitle || '', leftX, sigY + 5);
    if (options.secondarySignatory.subTitle) {
      doc.text(options.secondarySignatory.subTitle, leftX, sigY + 9);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(options.secondarySignatory.name || '', leftX, sigY + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(options.secondarySignatory.nip || '', leftX, sigY + 34);

    // Right: Primary (Kepala Lab / Approver)
    const rightX = pageWidth - 70;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(cityDateText, rightX, sigY);
    doc.text(options.primarySignatory.roleTitle || '', rightX, sigY + 5);
    if (options.primarySignatory.subTitle) {
      doc.text(options.primarySignatory.subTitle, rightX, sigY + 9);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(options.primarySignatory.name || '', rightX, sigY + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(options.primarySignatory.nip || '', rightX, sigY + 34);
  } else {
    // Single Signatory (Right side)
    const rightX = pageWidth - 70;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(cityDateText, rightX, sigY);
    doc.text(options.primarySignatory.roleTitle || '', rightX, sigY + 5);
    if (options.primarySignatory.subTitle) {
      doc.text(options.primarySignatory.subTitle, rightX, sigY + 9);
    }

    doc.setFont('helvetica', 'bold');
    doc.text(options.primarySignatory.name || '', rightX, sigY + 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(options.primarySignatory.nip || '', rightX, sigY + 34);
  }

  // Add Page Numbers Footer to All Pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SIMONSU - UPT Laboratorium Kesehatan Kota Bontang  |  Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  doc.save(`SIMONSU_Laporan_${localToday}.pdf`);
}
