/**
 * SIMONSU - Chart Canvas Generator for PDF Export & Reports
 * Generates high-resolution rasterized charts (PNG) using HTML5 Canvas API.
 * Supports smooth monotone cubic curves (Garis Halus) & straight polylines (Garis Lurus).
 * UPT Laboratorium Kesehatan Kota Bontang
 */

import { TemperatureRecord, Room } from '../types/simonsu';

export interface ChartCanvasOptions {
  width?: number;
  height?: number;
  periodLabel?: string;
  selectedRoom?: Room;
  selectedRoomName?: string;
  metric?: 'temperature' | 'humidity' | 'both';
  curveType?: 'monotone' | 'linear';
}

interface PlotPoint {
  x: number;
  y: number;
}

/**
 * Draw a smooth curve passing through all points using Fritsch-Carlson
 * Monotone Cubic Hermite Interpolation (matches Recharts `type="monotone"`).
 * Guarantees zero overshoot beyond adjacent data values.
 */
function traceMonotoneCurve(ctx: CanvasRenderingContext2D, points: PlotPoint[]) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 1) return;
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  const n = points.length;
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const slopes: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    dy[i] = points[i + 1].y - points[i].y;
    slopes[i] = dx[i] !== 0 ? dy[i] / dx[i] : 0;
  }

  const tangents: number[] = new Array(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      const m0 = slopes[i - 1];
      const m1 = slopes[i];
      const common = dx[i - 1] + dx[i];
      tangents[i] =
        (3 * common) / ((common + dx[i]) / m0 + (common + dx[i - 1]) / m1);
    }
  }

  // Fritsch-Carlson monotonicity constraint clamping
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const alpha = tangents[i] / slopes[i];
      const beta = tangents[i + 1] / slopes[i];
      const norm = Math.hypot(alpha, beta);
      if (norm > 3) {
        const tau = 3 / norm;
        tangents[i] = tau * alpha * slopes[i];
        tangents[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = p1.x - p0.x;
    const cp1x = p0.x + h / 3;
    const cp1y = p0.y + (tangents[i] * h) / 3;
    const cp2x = p1.x - h / 3;
    const cp2y = p1.y - (tangents[i + 1] * h) / 3;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p1.x, p1.y);
  }
}

/**
 * Draw crisp straight polyline segments connecting all points (Garis Lurus).
 */
function traceLinearSegments(ctx: CanvasRenderingContext2D, points: PlotPoint[]) {
  if (points.length === 0) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
}

export function generateChartDataUrl(
  records: TemperatureRecord[],
  options: ChartCanvasOptions = {}
): string {
  const width = options.width || 1600;
  const height = options.height || 680;
  const metric = options.metric || 'both';
  const curveType = options.curveType || 'monotone';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  // 1. Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Border outline
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // 2. Header: Title & Subtitle
  const titleMetric =
    metric === 'humidity'
      ? 'KELEMBAPAN RUANGAN'
      : metric === 'temperature'
      ? 'SUHU RUANGAN'
      : 'SUHU & KELEMBAPAN RUANGAN';

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`GRAFIK FLUKTUASI & TREN ${titleMetric}`, 50, 48);

  const roomText = options.selectedRoom
    ? `${options.selectedRoom.name} (${options.selectedRoom.code})`
    : options.selectedRoomName || 'Semua Ruangan';
  const periodText = options.periodLabel || 'Periode Monitoring';
  const curveLabel = curveType === 'monotone' ? 'Garis Halus' : 'Garis Lurus';

  ctx.fillStyle = '#64748b';
  ctx.font = '15px Helvetica, Arial, sans-serif';
  ctx.fillText(
    `Ruangan: ${roomText}   |   Periode: ${periodText}   |   Model: ${curveLabel}`,
    50,
    75
  );

  // Limits note if room is selected
  if (options.selectedRoom && (metric === 'temperature' || metric === 'both')) {
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.fillText(
      `Batas Aman Suhu: ${options.selectedRoom.min_temperature.toFixed(1)}°C - ${options.selectedRoom.max_temperature.toFixed(1)}°C`,
      50,
      98
    );
  }

  // 3. Legend on the Top Right
  let curLegX = width - 480;

  if (metric === 'both' || metric === 'temperature') {
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(curLegX, 58);
    ctx.lineTo(curLegX + 26, 58);
    ctx.stroke();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(curLegX + 13, 58, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.fillText('Suhu (°C)', curLegX + 34, 63);
    curLegX += 125;
  }

  if (metric === 'both' || metric === 'humidity') {
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(curLegX, 58);
    ctx.lineTo(curLegX + 26, 58);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
    ctx.fillText('Kelembapan (%)', curLegX + 34, 63);
    curLegX += 160;
  }

  if (options.selectedRoom && (metric === 'temperature' || metric === 'both')) {
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(curLegX, 58);
    ctx.lineTo(curLegX + 26, 58);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
    ctx.fillText('Batas Ideal', curLegX + 34, 63);
  }

  // 4. Check if records exist
  if (!records || records.length === 0) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(50, 120, width - 100, height - 170);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 18px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Belum ada data pencatatan suhu untuk filter ruangan dan periode ini.',
      width / 2,
      height / 2 + 10
    );
    return canvas.toDataURL('image/png');
  }

  // Sort chronological
  const sorted = [...records].sort((a, b) => {
    const dtA = `${a.date} ${a.time}`;
    const dtB = `${b.date} ${b.time}`;
    return dtA.localeCompare(dtB);
  });

  // Chart plot boundaries
  const plotX = 85;
  const plotY = 120;
  const plotW = width - 170;
  const plotH = height - 210;

  // Chart area background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(plotX, plotY, plotW, plotH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(plotX, plotY, plotW, plotH);

  // Calculate Y-domain for Temperature
  const temps = sorted.map((r) => r.temperature);
  let minTemp = Math.min(...temps);
  let maxTemp = Math.max(...temps);

  if (options.selectedRoom) {
    minTemp = Math.min(minTemp, options.selectedRoom.min_temperature - 1.5);
    maxTemp = Math.max(maxTemp, options.selectedRoom.max_temperature + 1.5);
  } else {
    minTemp = minTemp - 2;
    maxTemp = maxTemp + 2;
  }

  minTemp = Math.floor(minTemp);
  maxTemp = Math.ceil(maxTemp);
  if (maxTemp - minTemp < 4) {
    minTemp -= 2;
    maxTemp += 2;
  }

  const tempRange = maxTemp - minTemp || 1;
  const getYForTemp = (temp: number) => {
    const ratio = (temp - minTemp) / tempRange;
    return plotY + plotH - ratio * plotH;
  };

  // Calculate Y-domain for Humidity (padded around data so fluctuations are visible)
  const humVals = sorted
    .map((r) => r.humidity)
    .filter((h): h is number => typeof h === 'number' && Number.isFinite(h));
  let minHum = humVals.length > 0 ? Math.max(0, Math.floor(Math.min(...humVals) - 5)) : 0;
  let maxHum = humVals.length > 0 ? Math.min(100, Math.ceil(Math.max(...humVals) + 5)) : 100;
  if (maxHum - minHum < 10) {
    minHum = Math.max(0, minHum - 5);
    maxHum = Math.min(100, maxHum + 5);
  }
  const humRange = maxHum - minHum || 1;
  const getYForHum = (hum: number) => {
    const ratio = (hum - minHum) / humRange;
    return plotY + plotH - ratio * plotH;
  };

  // 5. Draw Safe Limit Area (Green zone) for temperature
  if (options.selectedRoom && (metric === 'temperature' || metric === 'both')) {
    const yMaxLimit = getYForTemp(options.selectedRoom.max_temperature);
    const yMinLimit = getYForTemp(options.selectedRoom.min_temperature);

    const safeTop = Math.min(yMaxLimit, yMinLimit);
    const safeHeight = Math.abs(yMaxLimit - yMinLimit);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.fillRect(plotX, safeTop, plotW, safeHeight);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);

    ctx.beginPath();
    ctx.moveTo(plotX, yMaxLimit);
    ctx.lineTo(plotX + plotW, yMaxLimit);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(plotX, yMinLimit);
    ctx.lineTo(plotX + plotW, yMinLimit);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `Maks ${options.selectedRoom.max_temperature.toFixed(1)}°C`,
      plotX + plotW - 10,
      yMaxLimit - 6
    );
    ctx.fillText(
      `Min ${options.selectedRoom.min_temperature.toFixed(1)}°C`,
      plotX + plotW - 10,
      yMinLimit + 16
    );
  }

  // 6. Draw Horizontal Grid lines & Y Labels
  const gridSteps = 5;
  ctx.font = '12px Helvetica, Arial, sans-serif';

  for (let i = 0; i <= gridSteps; i++) {
    const ratio = i / gridSteps;
    const y = plotY + plotH - ratio * plotH;

    // Grid line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();

    if (metric === 'humidity') {
      const humVal = minHum + humRange * ratio;
      ctx.fillStyle = '#4f46e5';
      ctx.textAlign = 'right';
      ctx.fillText(`${humVal.toFixed(0)}%`, plotX - 10, y + 4);
    } else {
      const tempVal = minTemp + tempRange * ratio;
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'right';
      ctx.fillText(`${tempVal.toFixed(1)}°C`, plotX - 10, y + 4);

      if (metric === 'both') {
        const humVal = minHum + humRange * ratio;
        ctx.fillStyle = '#6366f1';
        ctx.textAlign = 'left';
        ctx.fillText(`${humVal.toFixed(0)}%`, plotX + plotW + 10, y + 4);
      }
    }
  }

  // 7. Calculate X coordinates for points (with subtle side inset so dots never clip border)
  const pointsCount = sorted.length;
  const xPad = pointsCount > 1 ? 20 : 0;
  const usableW = plotW - xPad * 2;
  const getXForIndex = (idx: number) => {
    if (pointsCount <= 1) return plotX + plotW / 2;
    return plotX + xPad + (idx / (pointsCount - 1)) * usableW;
  };

  // 8. Draw Humidity Line if applicable
  const humRecords = sorted.filter(
    (r): r is TemperatureRecord & { humidity: number } =>
      typeof r.humidity === 'number' && Number.isFinite(r.humidity)
  );
  if ((metric === 'both' || metric === 'humidity') && humRecords.length > 0) {
    const humPoints: PlotPoint[] = [];
    sorted.forEach((r, idx) => {
      if (typeof r.humidity === 'number' && Number.isFinite(r.humidity)) {
        humPoints.push({
          x: getXForIndex(idx),
          y: getYForHum(r.humidity),
        });
      }
    });

    if (humPoints.length === 1) {
      // Subtle horizontal reference marker for a single reading
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(plotX, humPoints[0].y);
      ctx.lineTo(plotX + plotW, humPoints[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (humPoints.length > 1) {
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = metric === 'humidity' ? 3.5 : 2.8;
      ctx.lineJoin = curveType === 'monotone' ? 'round' : 'miter';
      ctx.lineCap = 'round';
      if (metric === 'both') {
        ctx.setLineDash([6, 4]);
      }
      ctx.beginPath();
      if (curveType === 'monotone') {
        traceMonotoneCurve(ctx, humPoints);
      } else {
        traceLinearSegments(ctx, humPoints);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Humidity Dots
    humPoints.forEach((pt, idx) => {
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, metric === 'humidity' ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();

      if (metric === 'humidity' && sorted.length <= 25) {
        const recWithHum = humRecords[idx];
        if (recWithHum) {
          ctx.fillStyle = '#312e81';
          ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${recWithHum.humidity.toFixed(1)}%`, pt.x, pt.y - 10);
        }
      }
    });
  }

  // 9. Draw Temperature Line (Garis Halus or Garis Lurus)
  if (metric === 'both' || metric === 'temperature') {
    const tempPoints: PlotPoint[] = sorted.map((r, idx) => ({
      x: getXForIndex(idx),
      y: getYForTemp(r.temperature),
    }));

    if (tempPoints.length === 1) {
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(plotX, tempPoints[0].y);
      ctx.lineTo(plotX + plotW, tempPoints[0].y);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tempPoints.length > 1) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = curveType === 'monotone' ? 'round' : 'miter';
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (curveType === 'monotone') {
        traceMonotoneCurve(ctx, tempPoints);
      } else {
        traceLinearSegments(ctx, tempPoints);
      }
      ctx.stroke();
    }

    // Data Point Dots
    sorted.forEach((r, idx) => {
      const x = tempPoints[idx].x;
      const y = tempPoints[idx].y;

      let dotColor = '#10b981';
      if (r.status === 'PERHATIAN') dotColor = '#f59e0b';
      else if (r.status === 'KRITIS') dotColor = '#ef4444';

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      if (sorted.length <= 25) {
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${r.temperature.toFixed(1)}°`, x, y - 10);
      }
    });
  }

  // 10. X-Axis Labels (Date / Time)
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';

  const maxLabels = Math.min(8, pointsCount);
  const step = Math.max(1, Math.ceil(pointsCount / maxLabels));

  for (let i = 0; i < pointsCount; i += step) {
    const r = sorted[i];
    const x = getXForIndex(i);
    const dateParts = r.date.split('-');
    const labelDate = `${dateParts[2] || ''}/${dateParts[1] || ''}`;
    const labelTime = r.time;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, plotY + plotH);
    ctx.lineTo(x, plotY + plotH + 5);
    ctx.stroke();

    ctx.fillText(`${labelDate} ${labelTime}`, x, plotY + plotH + 20);
  }

  // 11. Bottom Summary Statistics Bar
  const sumTemps = temps.reduce((a, b) => a + b, 0);
  const avgTemp = sumTemps / (temps.length || 1);
  const normalCount = sorted.filter((r) => r.status === 'NORMAL').length;
  const warningCount = sorted.filter((r) => r.status === 'PERHATIAN').length;
  const criticalCount = sorted.filter((r) => r.status === 'KRITIS').length;

  const barY = height - 42;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(50, barY, width - 100, 32);
  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(50, barY, width - 100, 32);

  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';

  let statX = 70;
  ctx.fillStyle = '#334155';
  ctx.fillText(`TOTAL DATA: ${sorted.length}`, statX, barY + 20);

  statX += 170;
  ctx.fillStyle = '#0284c7';
  ctx.fillText(`MIN: ${Math.min(...temps).toFixed(1)}°C`, statX, barY + 20);

  statX += 130;
  ctx.fillStyle = '#e11d48';
  ctx.fillText(`MAX: ${Math.max(...temps).toFixed(1)}°C`, statX, barY + 20);

  statX += 130;
  ctx.fillStyle = '#0d9488';
  ctx.fillText(`RATA-RATA: ${avgTemp.toFixed(1)}°C`, statX, barY + 20);

  statX += 160;
  ctx.fillStyle = '#16a34a';
  ctx.fillText(`NORMAL: ${normalCount}`, statX, barY + 20);

  statX += 130;
  ctx.fillStyle = '#d97706';
  ctx.fillText(`PERHATIAN: ${warningCount}`, statX, barY + 20);

  statX += 140;
  ctx.fillStyle = '#dc2626';
  ctx.fillText(`KRITIS: ${criticalCount}`, statX, barY + 20);

  return canvas.toDataURL('image/png');
}
