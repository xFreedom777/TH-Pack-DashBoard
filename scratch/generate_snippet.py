import os

with open('/home/xroot/Desktop/Git hub/custom_dashboard/marine_logo_b64.txt') as f:
    b64 = f.read().strip()

with open('/tmp/trend_export_snippet.js', 'w', encoding='utf-8') as out:
    out.write(r'''
// =========================================================================
// OFFICIAL SCADA TREND EXPORT: DIRECT CSV & AUDIT PDF REPORT (BY xDev.CO.LTD)
// =========================================================================
const MARINE_LOGO_B64 = "''' + b64 + r'''";

window.exportDirectTrendCsv = async function(section, btnEl) {
  let effectiveSec = section;
  if (section === 'cip') {
    const cur = sectionRecorders.cip?.currentCircuit;
    if (cur === 'cip_line1' || cur === 'cip_line2') effectiveSec = cur;
  }
  
  const rec = (effectiveSec === 'cip_line1' || effectiveSec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[effectiveSec];
  if (!rec || !rec.chart) {
    alert('ไม่พบกราฟสำหรับกระบวนการนี้');
    return;
  }

  const btn = btnEl || document.getElementById('btn-export-' + section);
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '⏳ กำลังส่งออก...';
    btn.style.opacity = '0.7';
  }

  try {
    let timestamps = [];
    let datasetsData = [];
    let labelsList = [];

    const secTitles = {
      uht: 'UHT_Sterilizer_Process',
      atank: 'Aseptic_Tank_ATANK',
      cip: 'CIP_Systems',
      cip_line1: 'CIP_Circuit1_DB1801',
      cip_line2: 'CIP_Circuit2_DB1802',
      prod: 'Production_Duplex_Filter'
    };

    const secFullTitles = {
      uht: 'UHT STERILIZER PROCESS [DB1200]',
      atank: 'ASEPTIC TANK ATANK [DB1301]',
      cip: 'CIP SYSTEMS LINE 1 & 2 [DB1801 / DB1802]',
      cip_line1: 'CIP CIRCUIT 1 [DB1801] (LINE 1)',
      cip_line2: 'CIP CIRCUIT 2 [DB1802] (LINE 2)',
      prod: 'PRODUCTION SUPPLY & FILTRATION'
    };

    let rangeLabel = 'Current_Display';

    if (rec.mode === 'live') {
      rangeLabel = 'Live_' + (rec.windowSec || 60) + 's';
      const rawTimes = rec.history.fullTimes && rec.history.fullTimes.length > 0 
        ? rec.history.fullTimes 
        : (rec.history.times || []);
      const numPens = rec.chart.data.datasets.length;

      for (let p = 0; p < numPens; p++) {
        datasetsData.push([]);
        labelsList.push(rec.chart.data.datasets[p].label || ('Pen ' + (p + 1)));
      }

      for (let i = 0; i < rawTimes.length; i++) {
        timestamps.push(rawTimes[i]);
        for (let p = 0; p < numPens; p++) {
          const penArr = rec.history['pen' + p] || [];
          datasetsData[p].push(penArr[i] !== undefined && penArr[i] !== null ? penArr[i] : '');
        }
      }
    } else {
      const chartTs = rec.chart.data.$fullTimestamps || rec.chart.$fullTimestamps || rec.chart.data.labels;
      if (chartTs && chartTs.length > 0 && rec.chart.data.datasets.length > 0 && rec.chart.data.datasets[0].data.length > 0) {
        timestamps = chartTs;
        rangeLabel = rec.historyRange === 'custom' 
          ? 'Custom_' + (rec.customFrom || '').replace(/[:T]/g, '') + '_to_' + (rec.customTo || '').replace(/[:T]/g, '')
          : (rec.historyRange || 'History');
        
        rec.chart.data.datasets.forEach((ds, idx) => {
          labelsList.push(ds.label || ('Pen ' + (idx + 1)));
          datasetsData.push(ds.data || []);
        });
      } else {
        const host = window.location.hostname || '127.0.0.1';
        let url = 'http://' + host + ':8000/api/v1/telemetry/history?section=' + encodeURIComponent(effectiveSec) + '&range=' + encodeURIComponent(rec.historyRange || '1d');
        if (rec.historyRange === 'custom' && rec.customFrom && rec.customTo) {
          url = 'http://' + host + ':8000/api/v1/telemetry/history?section=' + encodeURIComponent(effectiveSec) + '&from_time=' + encodeURIComponent(rec.customFrom) + '&to_time=' + encodeURIComponent(rec.customTo);
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.status === 'success' && data.timestamps && data.timestamps.length > 0) {
          timestamps = data.full_timestamps || data.timestamps;
          datasetsData = data.pens || [];
          labelsList = data.pen_labels || (rec.chart.data.datasets.map(d => d.label) || []);
          rangeLabel = rec.historyRange || '1d';
        }
      }
    }

    if (!timestamps || timestamps.length === 0) {
      alert('ยังไม่มีข้อมูลกราฟ Trend สำหรับส่งออกในช่วงเวลานี้');
      return;
    }

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = '' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
    const timeStr = '' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
    const filename = 'TREND_' + (secTitles[effectiveSec] || effectiveSec) + '_' + rangeLabel + '_' + dateStr + '_' + timeStr + '.csv';

    const fromTime = timestamps[0] || '—';
    const toTime = timestamps[timestamps.length - 1] || '—';

    let csv = '\uFEFF';
    csv += '# =========================================================================\n';
    csv += '# RUNGSAPPATTANA (THAILAND) CO., LTD. - SCADA PROCESS RECORDER REPORT\n';
    csv += '# UHT SCADA OPERATIONS & INVENTORY COMMAND CENTER • By xDev.CO.LTD\n';
    csv += '# =========================================================================\n';
    csv += '# PROCESS UNIT        : ' + (secFullTitles[effectiveSec] || effectiveSec.toUpperCase()) + '\n';
    csv += '# SELECTED HORIZON    : ' + rangeLabel.replace(/_/g, ' ') + '\n';
    csv += '# START TIMESTAMP     : ' + fromTime + ' (Asia/Bangkok +07:00)\n';
    csv += '# END TIMESTAMP       : ' + toTime + ' (Asia/Bangkok +07:00)\n';
    csv += '# TOTAL DATA POINTS   : ' + timestamps.length + '\n';
    csv += '# EXPORT DATE & TIME  : ' + now.toLocaleDateString('th-TH') + ' ' + now.toLocaleTimeString('th-TH') + '\n';
    csv += '# =========================================================================\n#\n';

    const headerCols = ['ลำดับ (Index)', 'วัน-เวลา (Timestamp Asia/Bangkok +07:00)'];
    labelsList.forEach(l => headerCols.push('"' + (l || '').replace(/"/g, '""') + '"'));
    csv += headerCols.join(',') + '\n';

    for (let i = 0; i < timestamps.length; i++) {
      const row = [i + 1, '"' + timestamps[i] + '"'];
      for (let p = 0; p < datasetsData.length; p++) {
        const val = datasetsData[p][i];
        row.push(val !== undefined && val !== null ? val : '');
      }
      csv += row.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    if (btn) {
      btn.innerHTML = '✅ ส่งออกสำเร็จ!';
      btn.style.background = 'rgba(16, 185, 129, 0.35)';
      btn.style.borderColor = '#10b981';
      btn.style.color = '#fff';
      setTimeout(() => {
        btn.innerHTML = origText || '📥 ส่งออก Trend CSV';
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.opacity = '1';
      }, 2500);
    }
  } catch (err) {
    console.error('Failed to export trend CSV:', err);
    alert('เกิดข้อผิดพลาดในการส่งออกไฟล์ CSV: ' + err.message);
    if (btn) {
      btn.innerHTML = origText || '📥 ส่งออก Trend CSV';
      btn.style.opacity = '1';
    }
  }
};

window.exportTrendPdfReport = function(section) {
  let effectiveSec = section;
  if (section === 'cip') {
    const cur = sectionRecorders.cip?.currentCircuit;
    if (cur === 'cip_line1' || cur === 'cip_line2') effectiveSec = cur;
  }
  
  const rec = (effectiveSec === 'cip_line1' || effectiveSec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[effectiveSec];
  if (!rec || !rec.chart) {
    alert('ไม่พบข้อมูลกราฟสำหรับกระบวนการนี้');
    return;
  }

  const timestamps = rec.chart.data.$fullTimestamps || rec.chart.$fullTimestamps || rec.chart.data.labels || [];
  if (timestamps.length === 0) {
    alert('ยังไม่มีข้อมูลกราฟ Trend สำหรับออกรายงาน PDF');
    return;
  }

  const chartImgUri = rec.chart.toBase64Image('image/png', 1.0);
  const fromTime = timestamps[0] || '—';
  const toTime = timestamps[timestamps.length - 1] || '—';
  const totalPoints = timestamps.length;
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = '' + pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + now.getFullYear();
  const timeStr = '' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

  const secMeta = {
    uht: {
      name: 'UHT STERILIZATION UNIT [DB1200]',
      desc: 'Continuous High-Temperature Short-Time Sterilization Process Trend Report',
      batch: 'UHT-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    },
    atank: {
      name: 'ASEPTIC TANK STORAGE SYSTEM [DB1301]',
      desc: 'Aseptic Air Barrier & Sterile Storage Integrity Process Trend Report',
      batch: 'ATK-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    },
    cip: {
      name: 'CIP DUAL-LINE CHEMICAL & THERMAL RECORDER',
      desc: 'Clean-In-Place Dual Circuit Conductivity & Thermal Trend Report',
      batch: 'CIP-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    },
    cip_line1: {
      name: 'CIP CIRCUIT 1 [DB1801] (FILLER MACHINE)',
      desc: 'Clean-In-Place Circuit 1 Conductivity & Thermal Trend Report',
      batch: 'CIP1-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    },
    cip_line2: {
      name: 'CIP CIRCUIT 2 [DB1802] (ASEPTIC TANK)',
      desc: 'Clean-In-Place Circuit 2 Conductivity & Thermal Trend Report',
      batch: 'CIP2-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    },
    prod: {
      name: 'SUPPLY & DUPLEX FILTRATION SYSTEM',
      desc: 'Pressure & Filtration Differential Integrity Trend Report',
      batch: 'PRD-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
    }
  };

  const meta = secMeta[effectiveSec] || {
    name: effectiveSec.toUpperCase(),
    desc: 'SCADA Telemetry Process Trend Report',
    batch: 'BAT-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01'
  };

  const confList = PEN_ALARM_LIMITS[effectiveSec] || [];
  const datasets = rec.chart.data.datasets || [];
  const statRows = [];

  for (let i = 0; i < datasets.length; i++) {
    const ds = datasets[i];
    const conf = confList[i] || { tag: ds.label, unit: '', target: '—', ll: null, l: null, h: null, hh: null, ccp: false };
    const rawVals = ds.data || [];
    const validVals = rawVals.filter(v => v !== null && v !== undefined && !isNaN(v));

    let minStr = '—', maxStr = '—', avgStr = '—', lastStr = '—', statusStr = 'NORMAL', statusColor = '#059669';
    if (validVals.length > 0) {
      const min = Math.min(...validVals);
      const max = Math.max(...validVals);
      const avg = validVals.reduce((a, b) => a + b, 0) / validVals.length;
      const last = validVals[validVals.length - 1];

      const fmt = v => conf.unit === 'kg'
        ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : Number(v).toFixed(2);

      minStr = fmt(min);
      maxStr = fmt(max);
      avgStr = fmt(avg);
      lastStr = fmt(last);

      const ev = evaluatePenAlarm(conf, last);
      statusStr = ev.status;
      if (statusStr === 'CRITICAL') statusColor = '#dc2626';
      else if (statusStr === 'WARNING') statusColor = '#d97706';
      else statusColor = '#059669';
    }

    statRows.push(`
      <tr>
        <td style="font-weight:700; color:#0f172a;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${ds.borderColor || '#38bdf8'}; margin-right:6px; vertical-align:middle;"></span>
          ${conf.tag || ds.label}
          ${conf.ccp ? '<span style="color:#dc2626; font-size:7pt; font-weight:800; margin-left:4px;">[CCP]</span>' : ''}
        </td>
        <td style="text-align:center; font-family:monospace; color:#475569;">${conf.unit || '—'}</td>
        <td style="text-align:center; font-size:7.5pt; color:#334155;">${conf.target || '—'}</td>
        <td style="text-align:center; font-family:monospace; font-weight:700; color:#0284c7;">${minStr}</td>
        <td style="text-align:center; font-family:monospace; font-weight:700; color:#b91c1c;">${maxStr}</td>
        <td style="text-align:center; font-family:monospace; font-weight:700; color:#0d9488;">${avgStr}</td>
        <td style="text-align:center; font-family:monospace; font-weight:800; color:#1e293b; background:#f1f5f9;">${lastStr}</td>
        <td style="text-align:center; font-family:monospace; font-size:7pt; color:#64748b;">${conf.ll !== null ? conf.ll : '-'} / ${conf.hh !== null ? conf.hh : '-'}</td>
        <td style="text-align:center; font-weight:800; color:${statusColor}; font-size:8pt;">${statusStr}</td>
      </tr>
    `);
  }

  const sampleIndices = [];
  const maxSampleRows = 24;
  if (timestamps.length <= maxSampleRows) {
    for (let i = 0; i < timestamps.length; i++) sampleIndices.push(i);
  } else {
    const step = (timestamps.length - 1) / (maxSampleRows - 1);
    for (let i = 0; i < maxSampleRows; i++) {
      sampleIndices.push(Math.round(i * step));
    }
  }

  const sampleHeaders = ['#', 'วัน-เวลา (Date-Time +07:00)'];
  datasets.forEach((ds, idx) => {
    const conf = confList[idx];
    sampleHeaders.push(conf?.tag ? (conf.tag + ' (' + conf.unit + ')') : ds.label);
  });

  const sampleRowsHtml = sampleIndices.map((rowIdx, num) => {
    const bg = num % 2 === 0 ? '#ffffff' : '#f8fafc';
    const ts = timestamps[rowIdx] || '';
    const cols = ['<td style="text-align:center; font-family:monospace; color:#64748b;">' + (rowIdx + 1) + '</td>', '<td style="text-align:center; font-family:monospace; font-weight:600; color:#0f172a;">' + ts + '</td>'];
    for (let p = 0; p < datasets.length; p++) {
      const conf = confList[p];
      const val = datasets[p].data ? datasets[p].data[rowIdx] : null;
      let valDisp = '—';
      if (val !== null && val !== undefined && !isNaN(val)) {
        valDisp = conf?.unit === 'kg' 
          ? Number(val).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
          : Number(val).toFixed(2);
      }
      cols.push('<td style="text-align:center; font-family:monospace; color:#1e293b;">' + valDisp + '</td>');
    }
    return '<tr style="background:' + bg + ';">' + cols.join('') + '</tr>';
  }).join('');

  const rangeHorizon = rec.mode === 'live' 
    ? ('Live Streaming (' + (rec.windowSec || 60) + ' วินาที)')
    : (rec.historyRange === 'custom' ? 'ช่วงกำหนดเอง (From-To)' : ('ย้อนหลัง ' + (rec.historyRange || '1 วัน')));

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>RUNGSAPPATTANA (THAILAND) — ${meta.name} TREND REPORT</title>
<style>
@page { size: A4 landscape; margin: 6mm 8mm; }
* { box-sizing: border-box; font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
body { font-size: 8pt; color: #0f172a; background: #fff; padding: 10px 14px; margin: 0; line-height: 1.25; }
table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
tr { page-break-inside: avoid; page-break-after: auto; }
thead { display: table-header-group; }
th, td { font-size: 7.5pt; border: 1px solid #cbd5e1; padding: 3px 5px; }
th { background: #1e293b; color: #ffffff; font-weight: 700; text-align: center; }
.header-box { border: 2px solid #0f172a; margin-bottom: 6px; }
.header-table td { border: none; padding: 3px 6px; }
.field-lbl { color: #64748b; font-size: 7pt; }
.field-val { font-weight: 700; color: #0f172a; font-size: 8pt; }
.chart-box { border: 1.5px solid #0f172a; border-radius: 6px; padding: 4px; background: #070d17; text-align: center; margin: 6px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.chart-img { width: 100%; max-height: 250px; object-fit: contain; display: block; margin: 0 auto; }
.section-title-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; margin-bottom: 3px; font-weight: 800; font-size: 8.5pt; color: #0f172a; }
.print-btn-bar { text-align: right; margin-bottom: 8px; }
.btn-print { background: #ea580c; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
.sign-box { border: 1px solid #94a3b8; height: 46px; text-align: center; vertical-align: bottom; padding: 3px; font-size: 7pt; color: #64748b; }
@media print {
  .print-btn-bar { display: none; }
  body { padding: 0; }
  .chart-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>

  <div class="print-btn-bar">
    <button onclick="window.print()" class="btn-print">
      🖨️ สั่งพิมพ์เอกสาร A4 แนวนอน (PRINT / SAVE AS PDF)
    </button>
  </div>

  <!-- HEADER BOX -->
  <div class="header-box">
    <table class="header-table" style="width:100%;">
      <tr>
        <td style="width:145px; text-align:center; vertical-align:middle; border-right:2px solid #0f172a; padding:4px;">
          <div style="background:#253b1b; border-radius:6px; padding:4px 6px; display:inline-block; border:1px solid #3d6029; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
            <img src="data:image/png;base64,${MARINE_LOGO_B64}" style="max-height:40px; width:auto; display:block; margin:0 auto;" alt="Marine Logo">
          </div>
          <div style="font-size:7pt; font-weight:800; color:#0f172a; letter-spacing:0.5px; margin-top:3px; line-height:1.1;">RUNGSAPPATTANA<br><span style="font-size:6pt; color:#334155; font-weight:700;">(THAILAND)</span></div>
        </td>
        <td style="text-align:center; vertical-align:middle; border-right:2px solid #0f172a; padding:4px 10px;">
          <div style="font-size:12pt; font-weight:900; color:#1e3a8a; letter-spacing:0.5px; line-height:1.2;">RUNGSAPPATTANA (THAILAND) CO., LTD.</div>
          <div style="font-size:8pt; font-weight:700; color:#059669; letter-spacing:0.3px; margin-top:1px;">บริษัท รุ่งทรัพย์พัฒนา (ประเทศไทย) จำกัด • SCADA PROCESS HISTORIAN TREND REPORT</div>
          <div style="font-size:9.5pt; font-weight:800; color:#0f172a; margin-top:2px;">${meta.name}</div>
          <div style="font-size:6.5pt; color:#64748b; margin-top:1px;">${meta.desc} • SCADA Automation System By xDev.CO.LTD</div>
        </td>
        <td style="width:310px; vertical-align:top; padding:4px 6px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td class="field-lbl">Date (วันที่) :</td>
              <td class="field-val">${dateStr}</td>
              <td class="field-lbl">Print Time :</td>
              <td class="field-val" style="color:#0284c7;">${timeStr}</td>
            </tr>
            <tr>
              <td class="field-lbl">Batch Ref. :</td>
              <td class="field-val" style="color:#2563eb;">${meta.batch}</td>
              <td class="field-lbl">Mode / Range :</td>
              <td class="field-val" style="color:#9333ea;">${rangeHorizon}</td>
            </tr>
            <tr>
              <td class="field-lbl">Time Horizon :</td>
              <td colspan="3" class="field-val" style="color:#b91c1c; font-size:7.5pt; font-family:monospace;">${fromTime} → ${toTime}</td>
            </tr>
            <tr>
              <td class="field-lbl">Total Samples :</td>
              <td class="field-val">${totalPoints} จุด</td>
              <td class="field-lbl">Plant Node :</td>
              <td class="field-val" style="color:#059669;">Siemens S7-1500 (ONLINE)</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>

  <!-- CHART IMAGE BOX -->
  <div class="chart-box">
    <img src="${chartImgUri}" class="chart-img" alt="Process Historian Trend Curve">
  </div>

  <!-- STATISTICAL SUMMARY TABLE -->
  <div class="section-title-bar">
    <div>📊 STATISTICAL SUMMARY & PROCESS TOLERANCE ENVELOPE (สรุปค่าทางสถิติและเกณฑ์ควบคุม)</div>
    <div style="font-size:7pt; color:#64748b; font-weight:600;">ENVELOPE TARGET & CCP CRITERIA COMPLIANCE</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:28%; text-align:left; padding-left:8px;">ปากกาวัด (Pen Sensor Tag)</th>
        <th style="width:6%;">หน่วย</th>
        <th style="width:14%;">เป้าหมาย (Target Envelope)</th>
        <th style="width:8%;">ต่ำสุด (Min)</th>
        <th style="width:8%;">สูงสุด (Max)</th>
        <th style="width:8%;">เฉลี่ย (Mean)</th>
        <th style="width:8%;">ค่าท้ายสุด</th>
        <th style="width:10%;">เกณฑ์ (LL / HH)</th>
        <th style="width:10%;">สถานะเกณฑ์</th>
      </tr>
    </thead>
    <tbody>
      ${statRows.join('')}
    </tbody>
  </table>

  <!-- KEY SAMPLE DATA POINTS TABLE -->
  <div class="section-title-bar" style="margin-top:6px;">
    <div>⏱️ KEY AUDIT SAMPLES TIMELINE (ตัวอย่างข้อมูลบันทึกประวัติกระบวนการ)</div>
    <div style="font-size:7pt; color:#64748b; font-weight:600;">SAMPLED ${sampleIndices.length} OF ${totalPoints} LOGGED POINTS</div>
  </div>
  <table>
    <thead>
      <tr>
        ${sampleHeaders.map(h => '<th>' + h + '</th>').join('')}
      </tr>
    </thead>
    <tbody>
      ${sampleRowsHtml}
    </tbody>
  </table>

  <!-- SIGN-OFF FOOTER -->
  <table class="sign-table" style="margin-top:8px;">
    <tr>
      <td class="sign-box" style="width:33.3%;">
        <div>________________________________________</div>
        <div style="font-weight:700; color:#1e293b; margin-top:2px;">ผู้บันทึกข้อมูล (SCADA Operator)</div>
        <div>วันที่: ......./......./............ เวลา: ....................</div>
      </td>
      <td class="sign-box" style="width:33.3%;">
        <div>________________________________________</div>
        <div style="font-weight:700; color:#1e293b; margin-top:2px;">หัวหน้างานผลิต (Production Supervisor)</div>
        <div>วันที่: ......./......./............ เวลา: ....................</div>
      </td>
      <td class="sign-box" style="width:33.3%;">
        <div>________________________________________</div>
        <div style="font-weight:700; color:#1e293b; margin-top:2px;">ผู้ตรวจสอบคุณภาพ (QA/QC Manager)</div>
        <div>วันที่: ......./......./............ เวลา: ....................</div>
      </td>
    </tr>
  </table>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
</body>
</html>`;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  } else {
    alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ กรุณากดยอมรับ Pop-up เพื่อเปิดรายงาน PDF');
  }
};

window.exportHistorianPdfCustomRange = async function() {
  const sec = document.getElementById('hist-section-select')?.value || 'uht';
  const fromVal = document.getElementById('hist-from-input')?.value;
  const toVal = document.getElementById('hist-to-input')?.value;
  const winVal = document.getElementById('hist-window-select')?.value || '';

  if (!fromVal || !toVal) {
    alert('กรุณาระบุทั้งวัน-เวลาเริ่มต้น (From) และสิ้นสุด (To)');
    return;
  }
  if (new Date(fromVal) > new Date(toVal)) {
    alert('วัน-เวลาเริ่มต้น (From) ต้องมาก่อนวัน-เวลาสิ้นสุด (To)');
    return;
  }

  closeHistorianRangeModal();
  await loadHistoricalCustomRange(sec, fromVal, toVal, winVal);
  setTimeout(() => {
    exportTrendPdfReport(sec);
  }, 600);
};
''')

print('Successfully written /tmp/trend_export_snippet.js')
