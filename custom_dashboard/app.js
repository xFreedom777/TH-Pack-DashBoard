// TH-PACK Industrial SCADA Executive Operations Center Logic
let charts = {};
let currentPeriod = 'daily';
let liveTelemetry = null;

// ================= REAL-TIME MULTI-PEN RECORDER STATE =================
let recorderChart = null;
let recorderPaused = false;
let recorderWindowSec = 60; // default 60 seconds
const MAX_RECORDER_BUFFER = 300; // max 5 minutes history
let recorderHistory = {
  times: [],
  tt01: [],
  pt460: [],
  flow: [],
  power: [],
  cond: []
};
let penVisibility = [true, true, true, true, true]; // Pen 0..4
let activeDriveFilter = 'all';

// ================= PERIOD DATASET DICTIONARIES =================
const PERIOD_DATA = {
  daily: {
    labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00'],
    outputTarget: [8000, 16000, 24000, 32000, 40000, 48000, 56000, 64000, 72000, 80000, 88000, 96000],
    outputActual: [8200, 16800, 25500, 34200, 42800, 51000, 59800, 68000, 76500, 85000, null, null],
    oee: [89.2, 90.1, 88.4, 87.9, 89.5, 91.2, 88.0, 87.5, 88.8, 88.4, null, null],
    oeeTarget: 85.0,
    pareto: {
      labels: ['รอวัตถุดิบ (Raw Material)', 'CIP ล้างระบบข้ามกะ', 'เปลี่ยนฟิลเตอร์ (Filter Swap)', 'ปรับตั้งค่า Homogenizer', 'Micro-stoppages'],
      values: [0.85, 0.65, 0.40, 0.30, 0.20]
    },
    powerShare: [25, 18.3, 9.2, 12.5, 12.5, 9.2, 6.7, 6.7],
    table: [
      { period: 'กะเช้า (Shift A: 08:00-16:00)', target: 48000, actual: 51000, var: '+6.25%', oee: '89.4%', avail: '93.2%', perf: '96.8%', qual: '99.5%', scrap: '0.5%', down: '1.1 ชม.', status: 'EXCELLENT' },
      { period: 'กะดึก (Shift B: 16:00-24:00)', target: 48000, actual: 34000, var: '+4.12%', oee: '87.4%', avail: '91.0%', perf: '96.2%', qual: '99.3%', scrap: '0.7%', down: '1.3 ชม.', status: 'GOOD' }
    ]
  },
  weekly: {
    labels: ['จันทร์ (Mon)', 'อังคาร (Tue)', 'พุธ (Wed)', 'พฤหัส (Thu)', 'ศุกร์ (Fri)', 'เสาร์ (Sat)', 'อาทิตย์ (Sun)'],
    outputTarget: [96000, 96000, 96000, 96000, 96000, 96000, 48000],
    outputActual: [98200, 101400, 99500, 97800, 102100, 85000, 0],
    oee: [88.7, 90.5, 89.1, 87.8, 91.2, 88.4, null],
    oeeTarget: 85.0,
    pareto: {
      labels: ['CIP ประจำสัปดาห์ (Weekly CIP)', 'รอการส่งจ่ายน้ำนมดิบ', 'บำรุงรักษาเชิงป้องกัน (PM)', 'เปลี่ยนฟิลเตอร์', 'ปัญหาแรงดันไอน้ำ'],
      values: [4.2, 2.8, 2.0, 1.5, 0.9]
    },
    powerShare: [24, 19, 9, 13, 13, 9, 6.5, 6.5],
    table: [
      { period: 'สัปดาห์ที่ 41 (Week 41)', target: 624000, actual: 584000, var: '+5.80%', oee: '89.2%', avail: '92.8%', perf: '96.6%', qual: '99.4%', scrap: '0.6%', down: '11.4 ชม.', status: 'EXCELLENT' },
      { period: 'สัปดาห์ที่ 40 (Week 40)', target: 624000, actual: 615000, var: '-1.44%', oee: '87.1%', avail: '90.5%', perf: '95.8%', qual: '99.2%', scrap: '0.8%', down: '14.2 ชม.', status: 'GOOD' }
    ]
  },
  monthly: {
    labels: ['สัปดาห์ 1', 'สัปดาห์ 2', 'สัปดาห์ 3', 'สัปดาห์ 4'],
    outputTarget: [624000, 624000, 624000, 624000],
    outputActual: [645000, 638000, 651000, 584000],
    oee: [89.4, 88.8, 90.1, 88.4],
    oeeTarget: 85.0,
    pareto: {
      labels: ['Big CIP & Sanitization', 'รอถังพัก Aseptic ว่าง', 'เปลี่ยนไส้กรอง Duplex', 'การสอบเทียบเซนเซอร์', 'ดาวน์ไทม์ไฟฟ้าดับ'],
      values: [18.5, 12.0, 6.5, 4.0, 2.5]
    },
    powerShare: [25, 18, 9, 13, 13, 9, 6.5, 6.5],
    table: [
      { period: 'ตุลาคม 2026 (Month to Date)', target: 2496000, actual: 2518000, var: '+0.88%', oee: '89.2%', avail: '92.5%', perf: '96.7%', qual: '99.4%', scrap: '0.6%', down: '43.5 ชม.', status: 'EXCELLENT' },
      { period: 'กันยายน 2026 (Full Month)', target: 2496000, actual: 2480000, var: '-0.64%', oee: '88.1%', avail: '91.8%', perf: '96.1%', qual: '99.3%', scrap: '0.7%', down: '48.0 ชม.', status: 'GOOD' }
    ]
  },
  yearly: {
    labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    outputTarget: [2.5, 2.3, 2.6, 2.4, 2.6, 2.5, 2.6, 2.6, 2.5, 2.6, 2.5, 2.6], // ล้านลิตร
    outputActual: [2.55, 2.38, 2.65, 2.44, 2.68, 2.58, 2.70, 2.64, 2.52, 2.52, null, null],
    oee: [88.2, 88.5, 89.4, 87.9, 89.8, 89.2, 90.5, 89.6, 88.1, 89.2, null, null],
    oeeTarget: 85.0,
    pareto: {
      labels: ['งานบำรุงรักษาประจำปี (Yearly Overhaul)', 'CIP Cycle สะสม', 'รอวัตถุดิบขาดช่วง', 'การล้างแนวท่อโรงงาน', 'ปัญหาอื่นๆ'],
      values: [120, 95, 48, 32, 18]
    },
    powerShare: [25, 18, 9, 13, 13, 9, 6.5, 6.5],
    table: [
      { period: 'ปี 2026 (Year to Date)', target: 25.5, actual: 25.66, var: '+0.62%', oee: '89.0%', avail: '92.4%', perf: '96.5%', qual: '99.4%', scrap: '0.6%', down: '313 ชม.', status: 'EXCELLENT (ล้านลิตร)' },
      { period: 'ปี 2025 (Annual Total)', target: 30.0, actual: 29.85, var: '-0.50%', oee: '87.8%', avail: '91.2%', perf: '95.9%', qual: '99.2%', scrap: '0.8%', down: '420 ชม.', status: 'GOOD (ล้านลิตร)' }
    ]
  }
};

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupPeriodButtons();
  initCharts();
  initAllSectionRecorders();
  setupDriveBayFilters();
  renderDriveBayCards({});
  renderSummaryTable(currentPeriod);
  startClock();
  initZoomController();
  connectWebSocket();
});

// ================= INTERACTIVE ZOOM CONTROLLER =================
function initZoomController() {
  const zoomRange = document.getElementById('zoom-range');
  const zoomDisplay = document.getElementById('zoom-val-display');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const dropdownTrigger = document.getElementById('zoom-dropdown-trigger');
  const zoomMenu = document.getElementById('zoom-menu');
  const zoomArrow = document.getElementById('zoom-arrow');
  const zoomOptions = document.querySelectorAll('.zoom-opt');

  let currentZoom = parseInt(localStorage.getItem('scada_zoom_level')) || 100;

  function applyZoom(zoom) {
    zoom = Math.max(50, Math.min(200, Math.round(zoom)));
    currentZoom = zoom;

    // Apply zoom to document.body natively
    document.body.style.zoom = `${zoom}%`;

    // Update UI elements
    if (zoomRange) zoomRange.value = zoom;
    if (zoomDisplay) zoomDisplay.textContent = `${zoom}%`;

    // Update active class in dropdown options
    zoomOptions.forEach(opt => {
      const val = parseInt(opt.getAttribute('data-zoom'));
      opt.classList.toggle('active', val === zoom);
    });

    try {
      localStorage.setItem('scada_zoom_level', zoom);
    } catch (e) {}

    // Trigger window resize so Chart.js recalculates smoothly
    window.dispatchEvent(new Event('resize'));
    updateActiveTabRecorders();
  }

  // Apply saved or default zoom
  applyZoom(currentZoom);

  // Range slider input
  if (zoomRange) {
    zoomRange.addEventListener('input', (e) => {
      applyZoom(parseInt(e.target.value));
    });
  }

  // Zoom Out button (-10%)
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      applyZoom(currentZoom - 10);
    });
  }

  // Zoom In button (+10%)
  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      applyZoom(currentZoom + 10);
    });
  }

  // Dropdown toggle
  if (dropdownTrigger && zoomMenu) {
    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = zoomMenu.classList.toggle('show');
      if (zoomArrow) zoomArrow.textContent = isOpen ? '▲' : '▼';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.zoom-dropdown-wrapper')) {
        zoomMenu.classList.remove('show');
        if (zoomArrow) zoomArrow.textContent = '▼';
      }
    });
  }

  // Option selection
  zoomOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      const val = parseInt(opt.getAttribute('data-zoom'));
      if (!isNaN(val)) {
        applyZoom(val);
        if (zoomMenu) zoomMenu.classList.remove('show');
        if (zoomArrow) zoomArrow.textContent = '▼';
      }
    });
  });
}

// ================= CLOCK & SHIFT =================
function startClock() {
  const clockEl = document.getElementById('live-clock');
  const shiftEl = document.getElementById('current-shift');

  function update() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString('th-TH', { hour12: false });
    }
    const hour = now.getHours();
    const isShiftA = (hour >= 8 && hour < 20);
    if (shiftEl) {
      shiftEl.textContent = isShiftA ? 'กะ A (DAY 08-20)' : 'กะ B (NIGHT 20-08)';
    }
  }
  update();
  setInterval(update, 1000);
}

// ================= TABS =================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  function activateTab(targetId) {
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === targetId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    tabContents.forEach(c => {
      if (c.id === targetId) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    onTabActivated(targetId);
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      activateTab(targetId);
      try {
        history.replaceState(null, '', '#' + targetId);
      } catch (e) {}
    });
  });

  // Check URL parameter (?tab=tab-uht) or hash (#tab-uht)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || window.location.hash.replace('#', '');
  if (initialTab && document.getElementById(initialTab)) {
    activateTab(initialTab);
  }
}

// ================= PERIOD BUTTONS =================
function setupPeriodButtons() {
  const periodBtns = document.querySelectorAll('.period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.getAttribute('data-period');
      updateCharts(currentPeriod);
      renderSummaryTable(currentPeriod);
    });
  });
}

// ================= CHARTS =================
function initCharts() {
  const ctxOutput = document.getElementById('chartOutput').getContext('2d');
  const ctxOee = document.getElementById('chartOee').getContext('2d');
  const ctxPareto = document.getElementById('chartPareto').getContext('2d');
  const ctxPower = document.getElementById('chartPower').getContext('2d');

  const p = PERIOD_DATA.daily;

  // Chart 1: Output
  charts.output = new Chart(ctxOutput, {
    type: 'bar',
    data: {
      labels: p.labels,
      datasets: [
        {
          label: 'เป้าหมาย (Target)',
          data: p.outputTarget,
          type: 'line',
          borderColor: '#94a3b8',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'ยอดผลิตจริง (Actual)',
          data: p.outputActual,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // Chart 2: OEE Trend
  charts.oee = new Chart(ctxOee, {
    type: 'line',
    data: {
      labels: p.labels,
      datasets: [
        {
          label: 'OEE จริง (%)',
          data: p.oee,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          borderWidth: 3,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 4,
          fill: true,
          tension: 0.3
        },
        {
          label: 'เกณฑ์มาตรฐาน 85%',
          data: Array(p.labels.length).fill(p.oeeTarget),
          borderColor: '#ef4444',
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 70, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // Chart 3: Downtime Pareto
  charts.pareto = new Chart(ctxPareto, {
    type: 'bar',
    data: {
      labels: p.pareto.labels,
      datasets: [{
        label: 'ชั่วโมงหยุดชะงัก (Hours)',
        data: p.pareto.values,
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#cbd5e1' }, grid: { display: false } }
      }
    }
  });

  // Chart 4: Power Distribution
  charts.power = new Chart(ctxPower, {
    type: 'doughnut',
    data: {
      labels: ['VSD01 (Booster 15kW)', 'VSD02 (Feed 11kW)', 'VSD03 (PID Supply 5.5kW)', 'VSD04 (CIP L1 7.5kW)', 'VSD05 (CIP L2 7.5kW)', 'VSD06 (Return 5.5kW)', 'VSD08 (P101 4kW)', 'VSD09 (Agitator 4kW)'],
      datasets: [{
        data: p.powerShare,
        backgroundColor: [
          '#fbbf24', '#38bdf8', '#34d399', '#a78bfa', '#f43f5e', '#60a5fa', '#f97316', '#a3e635'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        }
      }
    }
  });
}

function updateCharts(period) {
  const p = PERIOD_DATA[period];
  if (!p) return;

  // Update Output
  charts.output.data.labels = p.labels;
  charts.output.data.datasets[0].data = p.outputTarget;
  charts.output.data.datasets[1].data = p.outputActual;
  charts.output.update();

  // Update OEE
  charts.oee.data.labels = p.labels;
  charts.oee.data.datasets[0].data = p.oee;
  charts.oee.data.datasets[1].data = Array(p.labels.length).fill(p.oeeTarget);
  charts.oee.update();

  // Update Pareto
  charts.pareto.data.labels = p.pareto.labels;
  charts.pareto.data.datasets[0].data = p.pareto.values;
  charts.pareto.update();
}

function renderSummaryTable(period) {
  const tbody = document.getElementById('summary-table-body');
  if (!tbody) return;
  const data = PERIOD_DATA[period].table;

  tbody.innerHTML = data.map(row => `
    <tr>
      <td><strong>${row.period}</strong></td>
      <td class="font-mono">${typeof row.target === 'number' ? row.target.toLocaleString() : row.target}</td>
      <td class="font-mono highlight-cyan">${typeof row.actual === 'number' ? row.actual.toLocaleString() : row.actual}</td>
      <td class="font-mono ${row.var.startsWith('+') ? 'highlight-green' : 'highlight-gold'}">${row.var}</td>
      <td class="font-mono"><strong>${row.oee}</strong></td>
      <td class="font-mono">${row.avail}</td>
      <td class="font-mono">${row.perf}</td>
      <td class="font-mono">${row.qual}</td>
      <td class="font-mono">${row.scrap}</td>
      <td class="font-mono">${row.down}</td>
      <td><span class="vsd-badge ${row.status.includes('EXCELLENT') ? 'run' : 'stop'}">${row.status}</span></td>
    </tr>
  `).join('');
}

// ================= SECTION DEDICATED REAL-TIME PROCESS RECORDERS =================
const sectionRecorders = {
  uht: {
    canvasId: 'chartRecorderUht',
    statusId: 'recorder-uht-status',
    chart: null,
    history: { times: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [], pen5: [] },
    windowSec: 60,
    paused: false,
    penVisibility: [true, true, true, true, true, true]
  },
  atank: {
    canvasId: 'chartRecorderAtank',
    statusId: 'recorder-atank-status',
    chart: null,
    history: { times: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    windowSec: 60,
    paused: false,
    penVisibility: [true, true, true, true, true]
  },
  cip: {
    canvasId: 'chartRecorderCip',
    statusId: 'recorder-cip-status',
    chart: null,
    history: { times: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [], pen5: [] },
    windowSec: 60,
    paused: false,
    penVisibility: [true, true, true, true, true, true]
  },
  prod: {
    canvasId: 'chartRecorderProd',
    statusId: 'recorder-prod-status',
    chart: null,
    history: { times: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    windowSec: 60,
    paused: false,
    penVisibility: [true, true, true, true, true]
  }
};

function initRecorderForSection(sec) {
  if (sec === 'uht' && !sectionRecorders.uht.chart) initUhtRecorder();
  else if (sec === 'atank' && !sectionRecorders.atank.chart) initAtankRecorder();
  else if (sec === 'cip' && !sectionRecorders.cip.chart) initCipRecorder();
  else if (sec === 'prod' && !sectionRecorders.prod.chart) initProdRecorder();
}

function initAllSectionRecorders() {
  setupSectionRecorderControls();

  // Attach ResizeObserver to all recorder wrappers so any layout or zoom change immediately resizes charts
  if (window.ResizeObserver) {
    document.querySelectorAll('.recorder-canvas-wrap').forEach(wrap => {
      const ro = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.contentRect.height > 100) {
            const canvas = wrap.querySelector('canvas');
            if (canvas) {
              const chart = Chart.getChart(canvas);
              if (chart) {
                chart.resize();
              }
            }
          }
        }
      });
      ro.observe(wrap);
    });
  }

  // If initial active tab is a recorder tab, initialize it
  const activeTab = document.querySelector('.tab-content.active');
  if (activeTab) {
    onTabActivated(activeTab.id);
  }
}

// 1. UHT RECORDER
function initUhtRecorder() {
  const canvas = document.getElementById('chartRecorderUht');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  sectionRecorders.uht.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'TT01 Holding Temp (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'TT02 Pre-Heat 1 (°C)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'TT04 Inlet Temp (°C)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'FT04FIQ Inlet Flow (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
        { label: 'LT Balance Level (m)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yLevel' },
        { label: 'UHT VSDs Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
      ]
    },
    options: getRecorderChartOptions({
      yTemp: { min: 0, max: 160, title: 'Temp (°C)', color: '#ef4444', position: 'left' },
      yFlow: { min: 0, max: 20000, title: 'Flow (L/h)', color: '#10b981', position: 'right' },
      yLevel: { min: 0, max: 15, title: 'Level (m)', color: '#8b5cf6', position: 'left', display: false },
      yPower: { min: 0, max: 45, title: 'Power (kW)', color: '#f59e0b', position: 'right' }
    })
  });
}

// 2. ATANK RECORDER
function initAtankRecorder() {
  const canvas = document.getElementById('chartRecorderAtank');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  sectionRecorders.atank.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'PT460 Aseptic Press (bar)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPress' },
        { label: 'TT460 Sterile Temp (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'TT477 Barrier Temp (°C)', data: [], borderColor: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'LC Product Level (%)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yLevel' },
        { label: 'VSD09 Agitator Speed (%)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'ySpeed' }
      ]
    },
    options: getRecorderChartOptions({
      yPress: { min: 0, max: 4.0, title: 'Press (bar)', color: '#06b6d4', position: 'left' },
      yTemp: { min: 0, max: 160, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yLevel: { min: 0, max: 100, title: 'Level (%)', color: '#10b981', position: 'left' },
      ySpeed: { min: 0, max: 100, title: 'Speed (%)', color: '#f59e0b', position: 'right', display: false }
    })
  });
}

// 3. CIP RECORDER
function initCipRecorder() {
  const canvas = document.getElementById('chartRecorderCip');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  sectionRecorders.cip.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'L1 CT_R Return Cond (mS/cm)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
        { label: 'L1 TT_R Return Temp (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'L1 FT_S Supply Flow (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
        { label: 'L2 CT_R Return Cond (mS/cm)', data: [], borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
        { label: 'L2 TT_R Return Temp (°C)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
        { label: 'CIP Pumps Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
      ]
    },
    options: getRecorderChartOptions({
      yCond: { min: 0, max: 80, title: 'Cond (mS/cm)', color: '#8b5cf6', position: 'left' },
      yTemp: { min: 0, max: 100, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yFlow: { min: 0, max: 25000, title: 'Flow (L/h)', color: '#10b981', position: 'right', display: false },
      yPower: { min: 0, max: 25, title: 'Power (kW)', color: '#f59e0b', position: 'left', display: false }
    })
  });
}

// 4. PROD SUPPLY RECORDER
function initProdRecorder() {
  const canvas = document.getElementById('chartRecorderProd');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  sectionRecorders.prod.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'PT_IN Filter Inlet (bar)', data: [], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPress' },
        { label: 'PT_OUT Filter Outlet (bar)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPress' },
        { label: 'ΔP Diff Press (bar)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yDiff' },
        { label: 'P101 Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' },
        { label: 'P101 Running Speed (%)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'ySpeed' }
      ]
    },
    options: getRecorderChartOptions({
      yPress: { min: 0, max: 6.0, title: 'Press (bar)', color: '#3b82f6', position: 'left' },
      yDiff: { min: 0, max: 2.0, title: 'ΔP Diff (bar)', color: '#ef4444', position: 'right' },
      yPower: { min: 0, max: 10, title: 'Power (kW)', color: '#f59e0b', position: 'right', display: false },
      ySpeed: { min: 0, max: 100, title: 'Speed (%)', color: '#10b981', position: 'left', display: false }
    })
  });
}

function getRecorderChartOptions(customYAxes) {
  const yScales = {};
  for (const [key, conf] of Object.entries(customYAxes)) {
    yScales[key] = {
      type: 'linear',
      position: conf.position || 'left',
      min: conf.min,
      max: conf.max,
      display: conf.display !== false,
      title: { display: true, text: conf.title, color: conf.color, font: { size: 10, weight: 'bold' } },
      ticks: { color: conf.color, font: { family: 'JetBrains Mono', size: 10 } },
      grid: {
        color: conf.position === 'left' ? 'rgba(255, 255, 255, 0.04)' : undefined,
        drawOnChartArea: conf.position === 'left'
      }
    };
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        displayColors: true
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b', maxTicksLimit: 10, font: { family: 'JetBrains Mono', size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.04)' }
      },
      ...yScales
    }
  };
}

// SETUP CONTROLS PER SECTION
function setupSectionRecorderControls() {
  // Window buttons
  document.querySelectorAll('.win-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const wrap = btn.closest('.recorder-window-selector');
      if (wrap) wrap.querySelectorAll('.win-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sectionRecorders[sec].windowSec = parseInt(btn.getAttribute('data-window')) || 60;
      updateSingleSectionRecorder(sec);
    });
  });

  // Pause buttons
  document.querySelectorAll('.btn-pause').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const rec = sectionRecorders[sec];
      rec.paused = !rec.paused;

      const icon = btn.querySelector('.pause-icon');
      const text = btn.querySelector('.pause-text');
      const statusTag = document.getElementById(rec.statusId);

      if (rec.paused) {
        if (icon) icon.textContent = '▶️';
        if (text) text.textContent = 'เล่นต่อ';
        if (statusTag) {
          statusTag.textContent = 'PAUSED';
          statusTag.style.background = 'rgba(251, 191, 36, 0.15)';
          statusTag.style.color = '#fbbf24';
          statusTag.style.borderColor = 'rgba(251, 191, 36, 0.4)';
        }
      } else {
        if (icon) icon.textContent = '⏸️';
        if (text) text.textContent = 'หยุดชั่วคราว';
        if (statusTag) {
          statusTag.textContent = 'LIVE STREAMING';
          statusTag.style.background = 'rgba(16, 185, 129, 0.15)';
          statusTag.style.color = 'var(--accent-emerald)';
          statusTag.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
      }
    });
  });

  // Clear buttons
  document.querySelectorAll('.btn-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const rec = sectionRecorders[sec];
      for (const k in rec.history) {
        rec.history[k] = [];
      }
      updateSingleSectionRecorder(sec);
    });
  });

  // Pen chip visibility toggle
  document.querySelectorAll('.pen-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sec = chip.getAttribute('data-section');
      const penIdx = parseInt(chip.getAttribute('data-pen'));
      if (!sec || !sectionRecorders[sec] || isNaN(penIdx)) return;
      const rec = sectionRecorders[sec];
      if (!rec.chart) return;

      rec.penVisibility[penIdx] = !rec.penVisibility[penIdx];
      chip.classList.toggle('disabled', !rec.penVisibility[penIdx]);
      rec.chart.setDatasetVisibility(penIdx, rec.penVisibility[penIdx]);
      rec.chart.update();
    });
  });
}

// PUSH LIVE TELEMETRY INTO ALL ACTIVE RECORDERS
function pushAllSectionRecordersData(d) {
  if (!d) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });

  // 1. UHT DATA
  const uhtRec = sectionRecorders.uht;
  const u = d.uht || {};
  const vf = d.vsd_fleet || {};
  const uhtPower = (vf.VSD01?.power_kw || 0) + (vf.VSD02?.power_kw || 0) + (vf.VSD03?.power_kw || 0) + (vf.VSD06?.power_kw || 0);

  setText('uht-pen-tt01', `${(u.tt01 || 0).toFixed(1)} °C`);
  setText('uht-pen-tt02', `${(u.tt02 || 0).toFixed(1)} °C`);
  setText('uht-pen-tt04', `${(u.tt04 || 0).toFixed(1)} °C`);
  setText('uht-pen-flow', `${(u.ft04fiq || 0).toFixed(0)} L/h`);
  setText('uht-pen-lt', `${(u.lt || 0).toFixed(2)} m`);
  setText('uht-pen-power', `${uhtPower.toFixed(1)} kW`);

  if (!uhtRec.paused) {
    uhtRec.history.times.push(timeStr);
    uhtRec.history.pen0.push(u.tt01 || 0);
    uhtRec.history.pen1.push(u.tt02 || 0);
    uhtRec.history.pen2.push(u.tt04 || 0);
    uhtRec.history.pen3.push(u.ft04fiq || 0);
    uhtRec.history.pen4.push(u.lt || 0);
    uhtRec.history.pen5.push(uhtPower);
    trimRecorderHistory(uhtRec);
  }

  // 2. ATANK DATA
  const atkRec = sectionRecorders.atank;
  const a = d.atank || {};
  const vsd09 = vf.VSD09 || {};

  setText('atank-pen-pt', `${(a.pt460 || 0).toFixed(2)} bar`);
  setText('atank-pen-tt460', `${(a.tt460 || 0).toFixed(1)} °C`);
  setText('atank-pen-tt477', `${(a.tt477 || 0).toFixed(1)} °C`);
  setText('atank-pen-lc', `${(a.lc || 0).toFixed(1)} %`);
  setText('atank-pen-vsd', `${(vsd09.curspeed_pct || 0).toFixed(0)} %`);

  if (!atkRec.paused) {
    atkRec.history.times.push(timeStr);
    atkRec.history.pen0.push(a.pt460 || 0);
    atkRec.history.pen1.push(a.tt460 || 0);
    atkRec.history.pen2.push(a.tt477 || 0);
    atkRec.history.pen3.push(a.lc || 0);
    atkRec.history.pen4.push(vsd09.curspeed_pct || 0);
    trimRecorderHistory(atkRec);
  }

  // 3. CIP DATA
  const cipRec = sectionRecorders.cip;
  const c1 = d.cip_line1 || {};
  const c2 = d.cip_line2 || {};
  const cipPower = (vf.VSD04?.power_kw || 0) + (vf.VSD05?.power_kw || 0);

  setText('cip-pen-ct1', `${(c1.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-pen-tt1', `${(c1.tt_r || 0).toFixed(1)} °C`);
  setText('cip-pen-ft1', `${(c1.ft_s || 0).toFixed(0)} L/h`);
  setText('cip-pen-ct2', `${(c2.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-pen-tt2', `${(c2.tt_r || 0).toFixed(1)} °C`);
  setText('cip-pen-power', `${cipPower.toFixed(1)} kW`);

  if (!cipRec.paused) {
    cipRec.history.times.push(timeStr);
    cipRec.history.pen0.push(c1.ct_r || 0);
    cipRec.history.pen1.push(c1.tt_r || 0);
    cipRec.history.pen2.push(c1.ft_s || 0);
    cipRec.history.pen3.push(c2.ct_r || 0);
    cipRec.history.pen4.push(c2.tt_r || 0);
    cipRec.history.pen5.push(cipPower);
    trimRecorderHistory(cipRec);
  }

  // 4. PROD DATA
  const prodRec = sectionRecorders.prod;
  const p = d.prod_supply || {};
  const vsd08 = vf.VSD08 || {};
  const dp = Math.max((p.pt_in || 0) - (p.pt_out || 0), 0);

  setText('prod-pen-ptin', `${(p.pt_in || 0).toFixed(2)} bar`);
  setText('prod-pen-ptout', `${(p.pt_out || 0).toFixed(2)} bar`);
  setText('prod-pen-dp', `${dp.toFixed(2)} bar`);
  setText('prod-pen-power', `${(vsd08.power_kw || 0).toFixed(2)} kW`);
  setText('prod-pen-speed', `${(vsd08.curspeed_pct || 0).toFixed(0)} %`);

  if (!prodRec.paused) {
    prodRec.history.times.push(timeStr);
    prodRec.history.pen0.push(p.pt_in || 0);
    prodRec.history.pen1.push(p.pt_out || 0);
    prodRec.history.pen2.push(dp);
    prodRec.history.pen3.push(vsd08.power_kw || 0);
    prodRec.history.pen4.push(vsd08.curspeed_pct || 0);
    trimRecorderHistory(prodRec);
  }

  // Update visible charts
  updateActiveTabRecorders();
}

function trimRecorderHistory(rec) {
  const maxPoints = 600; // keep up to 10 minutes max buffer
  if (rec.history.times.length > maxPoints) {
    for (const k in rec.history) {
      rec.history[k].shift();
    }
  }
}

function updateSingleSectionRecorder(sec) {
  const rec = sectionRecorders[sec];
  if (!rec || !rec.chart) return;

  const pointsToShow = rec.windowSec;
  const startIdx = Math.max(0, rec.history.times.length - pointsToShow);

  rec.chart.data.labels = rec.history.times.slice(startIdx);
  const numPens = rec.chart.data.datasets.length;
  for (let i = 0; i < numPens; i++) {
    const penKey = `pen${i}`;
    rec.chart.data.datasets[i].data = (rec.history[penKey] || []).slice(startIdx);
  }
  rec.chart.update('none');
}

function updateActiveTabRecorders() {
  const activeTab = document.querySelector('.tab-content.active');
  if (!activeTab) return;
  const tabId = activeTab.id; // e.g. 'tab-uht', 'tab-atank', 'tab-cip', 'tab-prod'
  const secMap = {
    'tab-uht': 'uht',
    'tab-atank': 'atank',
    'tab-cip': 'cip',
    'tab-prod': 'prod'
  };
  const sec = secMap[tabId];
  if (sec) {
    updateSingleSectionRecorder(sec);
  }
}

function onTabActivated(tabId) {
  const secMap = {
    'tab-uht': 'uht',
    'tab-atank': 'atank',
    'tab-cip': 'cip',
    'tab-prod': 'prod'
  };
  const sec = secMap[tabId];
  if (sec) {
    // Lazily initialize recorder if not initialized yet while container is now visible
    initRecorderForSection(sec);
    const rec = sectionRecorders[sec];
    if (rec && rec.chart) {
      rec.chart.resize();
      updateSingleSectionRecorder(sec);
    }
  }

  // Trigger resize events across multiple ticks to guarantee Chart.js adapts to visible geometry
  window.dispatchEvent(new Event('resize'));

  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'));
    if (sec && sectionRecorders[sec] && sectionRecorders[sec].chart) {
      sectionRecorders[sec].chart.resize();
      updateSingleSectionRecorder(sec);
    }
  });

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (sec && sectionRecorders[sec] && sectionRecorders[sec].chart) {
      sectionRecorders[sec].chart.resize();
      updateSingleSectionRecorder(sec);
    }
  }, 100);

  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (sec && sectionRecorders[sec] && sectionRecorders[sec].chart) {
      sectionRecorders[sec].chart.resize();
      updateSingleSectionRecorder(sec);
    }
  }, 260); // After CSS fadeIn finishes
}

// ================= LUXURY SINAMICS G120C DRIVE BAY COCKPIT =================

function setupDriveBayFilters() {
  const filterBtns = document.querySelectorAll('.bay-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDriveFilter = btn.getAttribute('data-filter') || 'all';
      if (liveTelemetry && liveTelemetry.vsd_fleet) {
        renderDriveBayCards(liveTelemetry.vsd_fleet);
      }
    });
  });
}

function renderDriveBayCards(vf) {
  const container = document.getElementById('vsd-bay-grid');
  if (!container || !vf) return;

  const allDrives = [
    { key: 'VSD01', tag: 'VSD01', name: 'UHT PUMP BOOST', section: 'UHT STERILIZER', rated: '15.0 kW', group: 'uht' },
    { key: 'VSD02', tag: 'VSD02', name: 'UHT PUMP FEED', section: 'UHT STERILIZER', rated: '11.0 kW', group: 'uht' },
    { key: 'VSD03', tag: 'VSD03', name: 'UHT PUMP SUPPLY (PID)', section: 'UHT STERILIZER', rated: '5.5 kW', group: 'uht' },
    { key: 'VSD06', tag: 'VSD06', name: 'UHT PUMP RETURN', section: 'UHT STERILIZER', rated: '5.5 kW', group: 'uht' },
    { key: 'VSD04', tag: 'VSD04', name: 'CIP L1 SUPPLY PUMP', section: 'CIP SYSTEMS', rated: '7.5 kW', group: 'cip' },
    { key: 'VSD05', tag: 'VSD05', name: 'CIP L2 SUPPLY PUMP', section: 'CIP SYSTEMS', rated: '7.5 kW', group: 'cip' },
    { key: 'VSD08', tag: 'VSD08', name: 'PROD P101 SUPPLY PUMP', section: 'PROD SUPPLY', rated: '4.0 kW', group: 'tank' },
    { key: 'VSD09', tag: 'VSD09', name: 'ATANK ASEPTIC AGITATOR', section: 'ASEPTIC TANK', rated: '4.0 kW', group: 'tank' }
  ];

  const filtered = (activeDriveFilter === 'all') 
    ? allDrives 
    : allDrives.filter(d => d.group === activeDriveFilter);

  container.innerHTML = filtered.map(meta => {
    const v = vf[meta.key] || {
      tag: meta.tag,
      name: meta.name,
      section: meta.section,
      rated_kw: parseFloat(meta.rated),
      running: false,
      fault: false,
      setspeed_pct: 0,
      curspeed_pct: 0,
      freq_hz: 0.0,
      voltage_v: 0,
      current_a: 0.0,
      power_kw: 0.0,
      pf: 0.85
    };

    const isRun = v.running;
    const isFault = v.fault;
    const statusText = isRun ? 'RUNNING' : (isFault ? 'FAULT' : 'STOPPED');
    const statusClass = isRun ? 'run' : (isFault ? 'fault' : 'stop');
    const cardClass = isRun ? 'vsd-bay-card is-running' : 'vsd-bay-card';

    const hz = Number(v.freq_hz || 0);
    const pct = Math.min(100, Math.max(0, Number(v.curspeed_pct || 0)));
    const needleDeg = ((hz / 50.0) * 180) - 90;
    const arcCircumference = 188.5;
    const arcOffset = arcCircumference - ((hz / 50.0) * arcCircumference);

    return `
      <div class="${cardClass}" id="bay-card-${meta.key}">
        <div class="vsd-card-head">
          <div class="vsd-id-badge">
            ⚡ ${v.tag}
            <span class="vsd-power-rating font-mono">${v.rated_kw} kW</span>
          </div>
          <span class="vsd-status-chip ${statusClass}">
            <span class="pulsing-dot" style="${isRun ? 'background: #34d399;' : 'background: #64748b;'}"></span>
            ${statusText}
          </span>
        </div>

        <div class="vsd-card-info">
          <div class="vsd-name">${v.name}</div>
          <div class="vsd-section-tag">${v.section} • 3-Phase 380V</div>
        </div>

        <!-- TACHOMETER SPEED DIAL -->
        <div class="vsd-tachometer-row">
          <svg class="tachometer-gauge-svg" viewBox="0 0 160 100">
            <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" stroke="#1e293b" stroke-width="12" stroke-linecap="round"/>
            <path d="M 20 85 A 60 60 0 0 1 140 85" fill="none" 
              stroke="${isRun ? 'url(#tachoGrad)' : '#334155'}" 
              stroke-width="12" 
              stroke-linecap="round"
              stroke-dasharray="188.5"
              stroke-dashoffset="${arcOffset}"
              style="transition: stroke-dashoffset 0.4s ease;"
            />
            <defs>
              <linearGradient id="tachoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="60%" stop-color="#06b6d4"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
            </defs>
            <circle cx="80" cy="85" r="7" fill="#f8fafc" stroke="#0f172a" stroke-width="2"/>
            <line x1="80" y1="85" x2="80" y2="35" 
              stroke="${isRun ? '#38bdf8' : '#64748b'}" 
              stroke-width="3" 
              stroke-linecap="round"
              transform="rotate(${needleDeg} 80 85)"
              style="transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);"
            />
            <text x="14" y="96" fill="#64748b" font-size="10" font-family="JetBrains Mono">0</text>
            <text x="75" y="20" fill="#64748b" font-size="10" font-family="JetBrains Mono">25</text>
            <text x="135" y="96" fill="#64748b" font-size="10" font-family="JetBrains Mono">50</text>
          </svg>

          <div class="tacho-center-val">
            <div class="tacho-hz font-mono">${hz.toFixed(1)}<span class="tacho-hz-unit"> Hz</span></div>
            <div class="tacho-act-pct font-mono">${pct.toFixed(1)}% ACT</div>
          </div>
        </div>

        <!-- SPEED SETPOINT VS ACTUAL BAR -->
        <div class="vsd-speed-bar-wrap">
          <div class="speed-bar-labels font-mono">
            <span>SET: <strong>${v.setspeed_pct}%</strong></span>
            <span>ACTUAL: <strong class="highlight-cyan">${v.curspeed_pct}%</strong></span>
          </div>
          <div class="speed-bar-track">
            <div class="speed-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>

        <!-- 3-PHASE ELECTRICAL HUD MATRIX -->
        <div class="vsd-elec-hud font-mono">
          <div class="hud-item">
            <span class="hud-lbl">VOLT</span>
            <span class="hud-val">${v.voltage_v || (isRun ? 380 : 0)} V</span>
          </div>
          <div class="hud-item">
            <span class="hud-lbl">CURR</span>
            <span class="hud-val">${(v.current_a || 0).toFixed(1)} A</span>
          </div>
          <div class="hud-item">
            <span class="hud-lbl">POWER</span>
            <span class="hud-val kw-val">${(v.power_kw || 0).toFixed(2)} kW</span>
          </div>
          <div class="hud-item">
            <span class="hud-lbl">PF</span>
            <span class="hud-val">${v.pf || '0.85'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================= WEBSOCKET & LIVE TELEMETRY =================
function connectWebSocket() {
  const host = window.location.hostname || '127.0.0.1';
  const wsUrl = `ws://${host}:8000/ws/telemetry`;
  let ws = null;

  try {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      console.log('Connected to SCADA WebSocket:', wsUrl);
      const pingEl = document.getElementById('plc-ping');
      if (pingEl) pingEl.textContent = 'ONLINE (WS 1.1ms)';
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) {
          applyLiveTelemetry(msg.data);
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onerror = (err) => {
      console.warn('WebSocket error, falling back to HTTP polling:', err);
    };

    ws.onclose = () => {
      console.log('WebSocket closed, attempting reconnect in 3s...');
      setTimeout(connectWebSocket, 3000);
    };
  } catch (e) {
    console.error('WS init failed:', e);
  }

  // Backup HTTP Polling every 2.0s
  setInterval(() => {
    fetch(`http://${host}:8000/api/v1/telemetry/live_full`)
      .then(res => res.json())
      .then(data => {
        applyLiveTelemetry(data);
      })
      .catch(err => console.warn('Poll fetch err:', err));
  }, 2000);
}

// ================= APPLY LIVE TELEMETRY TO UI =================
function applyLiveTelemetry(d) {
  liveTelemetry = d;
  if (!d) return;

  // PLC Connection Pill
  const pingEl = document.getElementById('plc-ping');
  if (pingEl) {
    pingEl.textContent = d.plc_connected ? 'ONLINE (1.2ms)' : 'PLC OFFLINE';
    pingEl.style.color = d.plc_connected ? 'var(--accent-emerald)' : 'var(--accent-red)';
  }

  // 1. UHT Data
  if (d.uht) {
    const u = d.uht;
    setText('uht-step-num', `STEP ${u.step_int}`);
    setText('uht-step-name', u.step_desc || 'OFF');
    setText('uht-timer-val', `${u.step_timer}s`);
    setText('uht-sp-val', `${u.step_setpoint}s`);

    setText('uht-lt', `${u.lt.toFixed(2)} m`);
    setText('uht-flow', `${u.ft04fiq.toFixed(1)} L/h`);
    setText('kpi-live-flow', `${u.ft04fiq.toFixed(1)} L/h`);
    setText('uht-ct', `${u.ct.toFixed(3)} mS/cm`);
    setText('uht-tt01', `${u.tt01.toFixed(1)} °C`);
    setText('kpi-uht-temp', `${u.tt01.toFixed(1)} °C`);

    setText('uht-tt01-chip', `${u.tt01.toFixed(1)}°C`);
    setText('uht-tt02-chip', `${u.tt02.toFixed(1)}°C`);
    setText('uht-tt03-chip', `${u.tt03.toFixed(1)}°C`);
    setText('uht-tt04-chip', `${u.tt04.toFixed(1)}°C`);
    setText('uht-tt05-chip', `${u.tt05.toFixed(1)}°C`);
    setText('uht-tt06-chip', `${u.tt06.toFixed(1)}°C`);
    setText('uht-tt07-chip', `${u.tt07.toFixed(1)}°C`);
  }

  // 2. ATANK Data
  if (d.atank) {
    const a = d.atank;
    setText('atank-step-num', `STEP ${a.step_int}`);
    setText('atank-step-name', a.step_desc || 'OFF');
    setText('atank-timer-val', `${a.step_timer}s`);
    setText('atank-sp-val', `${a.step_setpoint}s`);

    setText('atank-lc', `${a.lc.toFixed(2)} %`);
    setText('atank-pt', `${a.pt460.toFixed(2)} bar`);
    setText('kpi-atank-pt', `${a.pt460.toFixed(2)} bar`);
    setText('atank-tt460', `${a.tt460.toFixed(1)} °C`);
    setText('kpi-sterile-temp', `${a.tt460.toFixed(1)} °C`);
    setText('atank-tt477', `${a.tt477.toFixed(1)} °C`);

    const sterileBadge = document.getElementById('kpi-sterile-badge');
    if (sterileBadge) {
      if (a.step_int === 18) {
        sterileBadge.textContent = 'STERILIZING (18)';
        sterileBadge.className = 'kpi-badge success';
      } else {
        sterileBadge.textContent = 'SECURE';
        sterileBadge.className = 'kpi-badge primary';
      }
    }
  }

  // 3. CIP LINE 1 & 2
  if (d.cip_line1) {
    const c1 = d.cip_line1;
    setText('cip1-step-idx', `STEP ${c1.step_int}`);
    setText('cip1-step-title', c1.step_desc || 'System Standby');
    setText('cip1-timer', `${c1.step_timer}s`);
    setText('cip1-sp', `${c1.step_setpoint}s`);
    setText('cip1-ct', `${c1.ct_r.toFixed(2)} mS/cm`);
    setText('cip1-tts', `${c1.tt_s.toFixed(1)} °C`);
    setText('cip1-ttr', `${c1.tt_r.toFixed(1)} °C`);
    setText('cip1-fts', `${c1.ft_s.toFixed(1)} L/h`);
    setText('cip-hw-tank', `${c1.tt_hw_tnk.toFixed(1)} °C`);
    setText('cip-ac-tank', `${c1.tt_ac_tnk.toFixed(1)} °C`);
    setText('cip-cas-tank', `${c1.tt_cas_tnk.toFixed(1)} °C`);
  }

  if (d.cip_line2) {
    const c2 = d.cip_line2;
    setText('cip2-step-idx', `STEP ${c2.step_int}`);
    setText('cip2-step-title', c2.step_desc || 'System Standby');
    setText('cip2-timer', `${c2.step_timer}s`);
    setText('cip2-sp', `${c2.step_setpoint}s`);
    setText('cip2-ct', `${c2.ct_r.toFixed(2)} mS/cm`);
    setText('cip2-tts', `${c2.tt_s.toFixed(1)} °C`);
    setText('cip2-ttr', `${c2.tt_r.toFixed(1)} °C`);
    setText('cip2-fts', `${c2.ft_s.toFixed(1)} L/h`);
  }

  // 4. PRODUCTION SUPPLY
  if (d.prod_supply) {
    const p = d.prod_supply;
    setText('prod-code', `CODE ${p.status_code}`);
    setText('prod-text', p.status_name);
    setText('prod-pt-in', `${p.pt_in.toFixed(2)} bar`);
    setText('prod-pt-out', `${p.pt_out.toFixed(2)} bar`);
    setText('prod-filter', `BASKET #${p.select_filter}`);
    setText('prod-p101-status', p.p101_cmd ? 'RUNNING' : 'STOPPED');
  }

  // 5. VSD FLEET TABLE & POWER
  if (d.vsd_fleet) {
    renderVsdTables(d.vsd_fleet);
    renderDriveBayCards(d.vsd_fleet);
  }

  // 6. EXECUTIVE KPIS
  if (d.executive_kpis) {
    const k = d.executive_kpis;
    setText('kpi-total-kw', `${k.total_active_kw.toFixed(1)} kW`);
    setText('vsd-suite-total-kw', `${k.total_active_kw.toFixed(1)} kW`);
    const pBar = document.getElementById('kpi-power-bar');
    if (pBar) {
      const pct = Math.min((k.total_active_kw / 60.0) * 100, 100);
      pBar.style.width = `${Math.max(pct, 5)}%`;
    }
  }

  // 7. REAL-TIME MULTI-PEN PROCESS RECORDER
  pushAllSectionRecordersData(d);
}

function renderVsdTables(vf) {
  const uhtRows = document.getElementById('uht-vsd-rows');
  const atkRows = document.getElementById('atank-vsd-rows');
  const suiteRows = document.getElementById('vsd-suite-rows');

  const uhtKeys = ['VSD01', 'VSD02', 'VSD03', 'VSD06'];
  const atkKeys = ['VSD09'];
  const allKeys = ['VSD01', 'VSD02', 'VSD03', 'VSD04', 'VSD05', 'VSD06', 'VSD08', 'VSD09'];

  if (uhtRows) {
    uhtRows.innerHTML = uhtKeys.map(k => makeVsdRow(vf[k])).join('');
  }

  if (atkRows) {
    atkRows.innerHTML = atkKeys.map(k => {
      const v = vf[k];
      if (!v) return '';
      return `
        <tr>
          <td><strong class="highlight-cyan font-mono">${v.tag}</strong></td>
          <td>${v.name}</td>
          <td class="font-mono">${v.rated_kw} kW</td>
          <td><span class="vsd-badge ${v.running ? 'run' : (v.fault ? 'fault' : 'stop')}">${v.running ? 'RUN' : (v.fault ? 'FAULT' : 'STOP')}</span></td>
          <td class="font-mono">${v.setspeed_pct}%</td>
          <td class="font-mono highlight-gold">${v.curspeed_pct}%</td>
          <td class="font-mono">${v.freq_hz} Hz</td>
          <td class="font-mono">${v.voltage_v} V</td>
          <td class="font-mono">${v.current_a} A</td>
          <td class="font-mono highlight-green"><strong>${v.power_kw} kW</strong></td>
          <td><span class="tag-sub">LC &ge; 2000.0 & Proc=801</span></td>
        </tr>
      `;
    }).join('');
  }

  if (suiteRows) {
    suiteRows.innerHTML = allKeys.map(k => {
      const v = vf[k];
      if (!v) return '';
      return `
        <tr>
          <td><strong class="highlight-cyan font-mono">${v.tag}</strong></td>
          <td>${v.name}</td>
          <td><span class="tag-sub">${v.section}</span></td>
          <td class="font-mono">${v.rated_kw} kW</td>
          <td class="font-mono">${v.hw_id}</td>
          <td><span class="vsd-badge ${v.running ? 'run' : (v.fault ? 'fault' : 'stop')}">${v.running ? 'RUN' : (v.fault ? 'FAULT' : 'STOP')}</span></td>
          <td class="font-mono">${v.setspeed_pct}%</td>
          <td class="font-mono highlight-gold">${v.curspeed_pct}%</td>
          <td class="font-mono">${v.freq_hz} Hz</td>
          <td class="font-mono">${v.voltage_v} V</td>
          <td class="font-mono">${v.current_a} A</td>
          <td class="font-mono highlight-green"><strong>${v.power_kw} kW</strong></td>
          <td class="font-mono">${v.pf}</td>
        </tr>
      `;
    }).join('');
  }

  // Update Line 1 & Line 2 pump status
  const c1Status = document.getElementById('cip1-vsd-status');
  if (c1Status && vf['VSD04']) {
    const v = vf['VSD04'];
    c1Status.textContent = v.running ? `RUNNING (${v.power_kw} kW)` : `STOPPED (0.00 kW)`;
    c1Status.className = v.running ? 'status-run' : 'status-stop';
  }

  const c2Status = document.getElementById('cip2-vsd-status');
  if (c2Status && vf['VSD05']) {
    const v = vf['VSD05'];
    c2Status.textContent = v.running ? `RUNNING (${v.power_kw} kW)` : `STOPPED (0.00 kW)`;
    c2Status.className = v.running ? 'status-run' : 'status-stop';
  }
}

function makeVsdRow(v) {
  if (!v) return '';
  return `
    <tr>
      <td><strong class="highlight-cyan font-mono">${v.tag}</strong></td>
      <td>${v.name}</td>
      <td class="font-mono">${v.rated_kw} kW</td>
      <td><span class="vsd-badge ${v.running ? 'run' : (v.fault ? 'fault' : 'stop')}">${v.running ? 'RUN' : (v.fault ? 'FAULT' : 'STOP')}</span></td>
      <td class="font-mono">${v.setspeed_pct}%</td>
      <td class="font-mono highlight-gold">${v.curspeed_pct}%</td>
      <td class="font-mono">${v.freq_hz} Hz</td>
      <td class="font-mono">${v.voltage_v} V</td>
      <td class="font-mono">${v.current_a} A</td>
      <td class="font-mono highlight-green"><strong>${v.power_kw} kW</strong></td>
    </tr>
  `;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
