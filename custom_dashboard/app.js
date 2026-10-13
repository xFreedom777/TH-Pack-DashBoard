// By xDev.CO.LTD - Industrial SCADA Executive Operations Center Logic
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
      labels: ['CIP ประจำสัปดาห์ (Weekly CIP)', 'รอการส่งจ่ายน้ำมะพร้าว (Raw Coconut Water)', 'บำรุงรักษาเชิงป้องกัน (PM)', 'เปลี่ยนฟิลเตอร์', 'ปัญหาแรงดันไอน้ำ'],
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
  initCharts();
  setupPeriodButtons();
  initAllSectionRecorders();
  setupDriveBayFilters();
  renderDriveBayCards({});
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

  // UHT Sub-tabs switcher (Overview / Engineering / Management)
  const uhtSubBtns = document.querySelectorAll('.uht-subtab-btn');
  const uhtSubContents = document.querySelectorAll('.uht-subcontent');

  uhtSubBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSub = btn.getAttribute('data-subtab');
      uhtSubBtns.forEach(b => b.classList.toggle('active', b === btn));
      uhtSubContents.forEach(c => c.classList.toggle('active', c.id === targetSub));
    });
  });
}

// ================= PERIOD BUTTONS & DATE FILTER =================
let selectedOverviewDate = new Date();

function formatThaiDateShort(d) {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const SYSTEM_COMMISSION_DATE = '2026-10-10'; // วันเริ่มติดตั้งระบบจริง

function getOverviewDataForDate(period, dateObj) {
  const pad = (n) => String(n).padStart(2, '0');
  const dStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  const ymStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}`;
  const yStr = `${dateObj.getFullYear()}`;
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  
  const isToday = (dStr === todayStr);
  const isFuture = (dStr > todayStr);
  const isBeforeInstall = (dStr < SYSTEM_COMMISSION_DATE);

  // Check if NO DATA condition applies
  let hasNoData = false;
  let noDataReason = '';

  if (period === 'daily') {
    if (isBeforeInstall) {
      hasNoData = true;
      noDataReason = `FAULT: NO DATA (ไม่มีข้อมูลก่อนวันที่ 10 ต.ค. 2026 - ระบบเพิ่งเริ่มติดตั้ง 10 ต.ค. 2026)`;
    } else if (isFuture) {
      hasNoData = true;
      noDataReason = `FAULT: NO DATA (ยังไม่ถึงรอบวันผลิต)`;
    }
  } else if (period === 'weekly') {
    if (dStr < '2026-10-05') { // Before Week 41
      hasNoData = true;
      noDataReason = `FAULT: NO DATA (ไม่มีข้อมูลก่อนสัปดาห์ที่ 41 - เริ่มระบบ 10 ต.ค. 2026)`;
    }
  } else if (period === 'monthly') {
    if (ymStr < '2026-10') { // Before October 2026
      hasNoData = true;
      noDataReason = `FAULT: NO DATA (ไม่มีข้อมูลก่อนเดือน ต.ค. 2026 - เริ่มระบบ 10 ต.ค. 2026)`;
    }
  } else if (period === 'yearly') {
    if (yStr < '2026') {
      hasNoData = true;
      noDataReason = `FAULT: NO DATA (ระบบเริ่มติดตั้งปี 2026)`;
    }
  }

  // Handle NO DATA state strictly - DO NOT MOCK/INVENT DATA
  if (hasNoData) {
    const kpiOut = document.getElementById('kpi-output');
    if (kpiOut) kpiOut.textContent = '--';
    const kpiOee = document.getElementById('kpi-oee');
    if (kpiOee) kpiOee.innerHTML = `--<span class="percent-sign">%</span>`;

    const outBadge = document.querySelector('.kpi-card.gold-accent .kpi-badge');
    if (outBadge) {
      outBadge.className = 'kpi-badge danger';
      outBadge.textContent = 'FAULT: NO DATA';
      outBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      outBadge.style.color = '#f87171';
      outBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    }
    const oeeBadge = document.querySelector('.kpi-card.cyan-accent .kpi-badge');
    if (oeeBadge) {
      oeeBadge.className = 'kpi-badge danger';
      oeeBadge.textContent = 'FAULT: NO DATA';
      oeeBadge.style.background = 'rgba(239, 68, 68, 0.2)';
      oeeBadge.style.color = '#f87171';
      oeeBadge.style.border = '1px solid rgba(239, 68, 68, 0.4)';
    }

    const outBar = document.querySelector('.kpi-card.gold-accent .kpi-progress-bar');
    if (outBar) outBar.style.width = '0%';
    const oeeBar = document.querySelector('.kpi-card.cyan-accent .kpi-progress-bar');
    if (oeeBar) oeeBar.style.width = '0%';

    const labels = (period === 'daily') ? PERIOD_DATA.daily.labels :
                   (period === 'weekly') ? PERIOD_DATA.weekly.labels :
                   (period === 'monthly') ? PERIOD_DATA.monthly.labels : PERIOD_DATA.yearly.labels;

    return {
      isNoData: true,
      reason: noDataReason,
      labels: labels,
      outputTarget: (period === 'daily') ? PERIOD_DATA.daily.outputTarget : Array(labels.length).fill(null),
      outputActual: Array(labels.length).fill(null),
      oee: Array(labels.length).fill(null),
      oeeTarget: 85.0,
      pareto: {
        labels: ['FAULT: NO DATA (ไม่มีข้อมูลหยุดชะงัก)'],
        values: [0]
      },
      powerShare: [0, 0, 0, 0, 0, 0, 0, 0],
      table: []
    };
  }

  // Restore normal KPI badges
  const outBadge = document.querySelector('.kpi-card.gold-accent .kpi-badge');
  if (outBadge) {
    outBadge.className = 'kpi-badge success';
    outBadge.textContent = '+6.25% VS TARGET';
    outBadge.style.background = '';
    outBadge.style.color = '';
    outBadge.style.border = '';
  }
  const oeeBadge = document.querySelector('.kpi-card.cyan-accent .kpi-badge');
  if (oeeBadge) {
    oeeBadge.className = 'kpi-badge primary';
    oeeBadge.textContent = 'WORLD CLASS';
    oeeBadge.style.background = '';
    oeeBadge.style.color = '';
    oeeBadge.style.border = '';
  }

  const base = JSON.parse(JSON.stringify(PERIOD_DATA[period]));
  base.isNoData = false;

  if (period === 'daily') {
    if (dStr === '2026-10-10') {
      // Day 1 of commissioning (10-Oct-2026): actual completed run
      const fullActual = [7900, 16100, 24500, 32900, 41200, 49500, 57800, 66100, 74500, 82900, 91200, 97800];
      base.outputActual = fullActual;
      base.oee = [88.1, 88.5, 88.9, 89.2, 89.5, 89.1, 88.8, 89.0, 89.4, 89.1, 88.7, 89.2];
      base.table = [
        { period: `กะเช้า (Shift A: 08:00-16:00)`, target: 48000, actual: 50800, var: '+5.83%', oee: '89.2%', avail: '93.0%', perf: '96.5%', qual: '99.4%', scrap: '0.6%', down: '1.2 ชม.', status: 'EXCELLENT' },
        { period: `กะดึก (Shift B: 16:00-24:00)`, target: 48000, actual: 47000, var: '-2.08%', oee: '88.5%', avail: '92.1%', perf: '96.2%', qual: '99.3%', scrap: '0.7%', down: '1.4 ชม.', status: 'GOOD' }
      ];
      const kpiOut = document.getElementById('kpi-output');
      if (kpiOut) kpiOut.textContent = '97,800';
      const kpiOee = document.getElementById('kpi-oee');
      if (kpiOee) kpiOee.innerHTML = `88.8<span class="percent-sign">%</span>`;

      const outBar = document.querySelector('.kpi-card.gold-accent .kpi-progress-bar');
      if (outBar) outBar.style.width = '100%';
      const oeeBar = document.querySelector('.kpi-card.cyan-accent .kpi-progress-bar');
      if (oeeBar) oeeBar.style.width = '88.8%';
    } else {
      // Today (11-Oct-2026): live current run
      const kpiOut = document.getElementById('kpi-output');
      if (kpiOut) kpiOut.textContent = '85,000';
      const kpiOee = document.getElementById('kpi-oee');
      if (kpiOee) kpiOee.innerHTML = `88.4<span class="percent-sign">%</span>`;

      const outBar = document.querySelector('.kpi-card.gold-accent .kpi-progress-bar');
      if (outBar) outBar.style.width = '88.5%';
      const oeeBar = document.querySelector('.kpi-card.cyan-accent .kpi-progress-bar');
      if (oeeBar) oeeBar.style.width = '88.4%';
    }
  } else if (period === 'weekly') {
    const kpiOut = document.getElementById('kpi-output');
    if (kpiOut) kpiOut.textContent = '584,000';
    const kpiOee = document.getElementById('kpi-oee');
    if (kpiOee) kpiOee.innerHTML = `89.2<span class="percent-sign">%</span>`;
  } else if (period === 'monthly') {
    const kpiOut = document.getElementById('kpi-output');
    if (kpiOut) kpiOut.textContent = '2,518,000';
    const kpiOee = document.getElementById('kpi-oee');
    if (kpiOee) kpiOee.innerHTML = `89.2<span class="percent-sign">%</span>`;
  } else if (period === 'yearly') {
    const kpiOut = document.getElementById('kpi-output');
    if (kpiOut) kpiOut.textContent = '25.66M';
    const kpiOee = document.getElementById('kpi-oee');
    if (kpiOee) kpiOee.innerHTML = `89.0<span class="percent-sign">%</span>`;
  }

  return base;
}

function updateOverviewDisplay() {
  const dateInput = document.getElementById('overview-date-input');
  const tagEl = document.getElementById('overview-period-tag');
  const labelEl = document.getElementById('overview-date-label-text');
  const d = selectedOverviewDate;
  let label = 'เลือกวันที่:';
  let tag = '';

  const pad = (n) => String(n).padStart(2, '0');
  const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (currentPeriod === 'daily') {
    label = 'เลือกวันที่:';
    if (dateInput) {
      dateInput.type = 'date';
      dateInput.value = dStr;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    tag = (dStr === todayStr) ? `รอบวันปัจจุบัน: ${formatThaiDateShort(d)}` : `ข้อมูลวันที่: ${formatThaiDateShort(d)}`;
  } else if (currentPeriod === 'weekly') {
    label = 'สัปดาห์ของวันที่:';
    if (dateInput) {
      dateInput.type = 'date';
      dateInput.value = dStr;
    }
    tag = `สัปดาห์ที่ 41 (${formatThaiDateShort(d)})`;
  } else if (currentPeriod === 'monthly') {
    label = 'เลือกเดือน:';
    if (dateInput) {
      dateInput.type = 'month';
      dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    }
    tag = `ประจำเดือน: ${d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`;
  } else if (currentPeriod === 'yearly') {
    label = 'เลือกปี:';
    if (dateInput) {
      dateInput.type = 'date';
      dateInput.value = dStr;
    }
    tag = `ประจำปี: พ.ศ. ${d.getFullYear() + 543} (${d.getFullYear()})`;
  }

  if (labelEl) labelEl.textContent = label;

  const data = getOverviewDataForDate(currentPeriod, selectedOverviewDate);

  if (tagEl) {
    if (data.isNoData) {
      tagEl.textContent = `⚠️ ${data.reason}`;
      tagEl.style.background = 'rgba(239, 68, 68, 0.2)';
      tagEl.style.color = '#f87171';
      tagEl.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    } else {
      tagEl.textContent = tag;
      tagEl.style.background = 'rgba(2, 132, 199, 0.15)';
      tagEl.style.color = '#38bdf8';
      tagEl.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }
  }

  updateChartsWithData(data);
  renderSummaryTableWithData(data.table, data.isNoData, data.reason);
}


function setupPeriodButtons() {
  const periodBtns = document.querySelectorAll('.period-btn');
  const dateInput = document.getElementById('overview-date-input');
  const todayBtn = document.getElementById('btn-overview-today');

  periodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.getAttribute('data-period');
      updateOverviewDisplay();
    });
  });

  if (dateInput) {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    dateInput.addEventListener('change', (e) => {
      if (e.target.value) {
        selectedOverviewDate = new Date(e.target.value);
        updateOverviewDisplay();
      }
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      selectedOverviewDate = new Date();
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
      updateOverviewDisplay();
    });
  }

  updateOverviewDisplay();
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
      labels: ['VSD01 (Booster 15kW)', 'VSD02 (Feed 7.5kW)', 'VSD03 (PID Supply 4kW)', 'VSD04 (CIP L2 5.5kW)', 'VSD05 (CIP L1 7.5kW)', 'VSD06 (Return 4kW)', 'VSD08 (P101 3kW)', 'VSD09 (Agitator 3kW)'],
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

function updateChartsWithData(p) {
  if (!charts.output || !charts.oee || !charts.pareto || !p) return;

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

  // Update Power
  if (charts.power && p.powerShare) {
    charts.power.data.datasets[0].data = p.powerShare;
    charts.power.update();
  }
}

function renderSummaryTableWithData(tableData, isNoData, reason) {
  const tbody = document.getElementById('summary-table-body');
  if (!tbody) return;

  if (isNoData || !tableData || tableData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align:center;padding:32px 16px;background:rgba(239, 68, 68, 0.05);border:1px dashed rgba(239, 68, 68, 0.35);">
          <div style="display:inline-flex;align-items:center;gap:8px;color:#f87171;font-weight:800;font-size:15px;letter-spacing:1px;">
            ⚠️ <span>FAULT: NO DATA</span>
          </div>
          <div style="font-size:13px;color:#cbd5e1;font-weight:600;margin-top:8px;">
            ${reason || 'ไม่มีข้อมูลการผลิตย้อนหลังสำหรับช่วงเวลาที่เลือก'}
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
            ระบบ SCADA & PLC Telemetry Ingestion เพิ่งเริ่มติดตั้งและบันทึกข้อมูลจริงวันแรกเมื่อ <strong>10 ตุลาคม 2026</strong>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = tableData.map(row => `
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


function updateCharts(period) {
  const p = getOverviewDataForDate(period, selectedOverviewDate);
  updateChartsWithData(p);
}

function renderSummaryTable(period) {
  const p = getOverviewDataForDate(period, selectedOverviewDate);
  renderSummaryTableWithData(p.table);
}


// ================= SECTION DEDICATED REAL-TIME PROCESS RECORDERS =================
const sectionRecorders = {
  uht: {
    canvasId: 'chartRecorderUht',
    statusId: 'recorder-uht-status',
    chart: null,
    history: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [], pen5: [] },
    windowSec: 60,
    paused: false,
    mode: 'live',
    historyRange: '1d',
    penVisibility: [true, true, true, true, true, true]
  },
  atank: {
    canvasId: 'chartRecorderAtank',
    statusId: 'recorder-atank-status',
    chart: null,
    history: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    windowSec: 60,
    paused: false,
    mode: 'live',
    historyRange: '1d',
    penVisibility: [true, true, true, true, true]
  },
  cip: {
    canvasId: 'chartRecorderCip',
    statusId: 'recorder-cip-status',
    chart: null,
    currentCircuit: 'all',
    history: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [], pen5: [] },
    allHistory: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [], pen5: [] },
    c1History: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    c2History: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    windowSec: 60,
    paused: false,
    mode: 'live',
    historyRange: '1d',
    penVisibility: [true, true, true, true, true, true]
  },
  prod: {
    canvasId: 'chartRecorderProd',
    statusId: 'recorder-prod-status',
    chart: null,
    history: { times: [], fullTimes: [], pen0: [], pen1: [], pen2: [], pen3: [], pen4: [] },
    windowSec: 60,
    paused: false,
    mode: 'live',
    historyRange: '1d',
    penVisibility: [true, true, true, true, true]
  }
};

// ================= CIP CIRCUIT CONFIGURATIONS & SWITCHING =================
const CIP_CONFIGS = {
  all: {
    title: 'CIP DUAL-LINE CHEMICAL & THERMAL RECORDER',
    sub: 'บันทึกตัวแปรเฉพาะระบบล้าง CIP: ค่า Conductivity (ความเข้มข้นน้ำยา), อุณหภูมิ และอัตราการไหล Line 1 & Line 2',
    reportTarget: 'cip_line1',
    reportTitle: '📑 ออกรายงาน Step Log Line 1 [DB1801]',
    gridId: 'cip-pen-grid-all',
    datasets: [
      { label: 'L1 CT_R Return Cond (mS/cm)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
      { label: 'L1 TT_R Return Temp (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'L1 FT_S Supply Flow (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
      { label: 'L2 CT_R Return Cond (mS/cm)', data: [], borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
      { label: 'L2 TT_R Return Temp (°C)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'CIP Pumps Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
    ],
    scales: {
      yCond: { min: 0, max: 80, title: 'Cond (mS/cm)', color: '#8b5cf6', position: 'left' },
      yTemp: { min: 0, max: 100, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yFlow: { min: 0, max: 25000, title: 'Flow (L/h)', color: '#10b981', position: 'right', display: false },
      yPower: { min: 0, max: 25, title: 'Power (kW)', color: '#f59e0b', position: 'left', display: false }
    }
  },
  cip_line1: {
    title: 'CIP CIRCUIT 1 [DB1801] CHEMICAL & THERMAL RECORDER',
    sub: 'บันทึกตัวแปรเฉพาะวงล้าง Circuit 1: Conductivity ขากลับ, อุณหภูมิ Supply/Return, Flow Supply และปั๊มจ่าย VSD05 (7.5 kW)',
    reportTarget: 'cip_line1',
    reportTitle: '📑 ออกรายงาน Step Log Circuit 1 [DB1801]',
    gridId: 'cip-pen-grid-c1',
    datasets: [
      { label: 'C1 Return Cond (CT_R) (mS/cm)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
      { label: 'C1 Return Temp (TT_R) (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'C1 Supply Temp (TT_S) (°C)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'C1 Supply Flow (FT_S) (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
      { label: 'VSD05 Pump Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
    ],
    scales: {
      yCond: { min: 0, max: 80, title: 'Cond (mS/cm)', color: '#8b5cf6', position: 'left' },
      yTemp: { min: 0, max: 100, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yFlow: { min: 0, max: 25000, title: 'Flow (L/h)', color: '#10b981', position: 'right', display: false },
      yPower: { min: 0, max: 15, title: 'VSD05 (kW)', color: '#f59e0b', position: 'left', display: false }
    }
  },
  cip_line2: {
    title: 'CIP CIRCUIT 2 [DB1802] CHEMICAL & THERMAL RECORDER',
    sub: 'บันทึกตัวแปรเฉพาะวงล้าง Circuit 2: Conductivity ขากลับ, อุณหภูมิ Supply/Return, Flow Supply และปั๊มจ่าย VSD04 (5.5 kW)',
    reportTarget: 'cip_line2',
    reportTitle: '📑 ออกรายงาน Step Log Circuit 2 [DB1802]',
    gridId: 'cip-pen-grid-c2',
    datasets: [
      { label: 'C2 Return Cond (CT_R) (mS/cm)', data: [], borderColor: '#ec4899', backgroundColor: 'rgba(236, 72, 153, 0.08)', borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yCond' },
      { label: 'C2 Return Temp (TT_R) (°C)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'C2 Supply Temp (TT_S) (°C)', data: [], borderColor: '#06b6d4', backgroundColor: 'rgba(6, 182, 212, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yTemp' },
      { label: 'C2 Supply Flow (FT_S) (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
      { label: 'VSD04 Pump Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
    ],
    scales: {
      yCond: { min: 0, max: 80, title: 'Cond (mS/cm)', color: '#ec4899', position: 'left' },
      yTemp: { min: 0, max: 100, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yFlow: { min: 0, max: 25000, title: 'Flow (L/h)', color: '#10b981', position: 'right', display: false },
      yPower: { min: 0, max: 15, title: 'VSD04 (kW)', color: '#f59e0b', position: 'left', display: false }
    }
  }
};

function switchCipCircuit(circuitId) {
  const rec = sectionRecorders.cip;
  if (!rec) return;
  const cfg = CIP_CONFIGS[circuitId] || CIP_CONFIGS.all;
  rec.currentCircuit = circuitId;

  // 1. Update Title & Subtitle
  const titleEl = document.getElementById('cip-recorder-title');
  const subEl = document.getElementById('cip-recorder-sub');
  if (titleEl) titleEl.textContent = cfg.title;
  if (subEl) subEl.textContent = cfg.sub;

  // 2. Update Step Report button
  const reportBtn = document.getElementById('btn-cip-step-report');
  if (reportBtn) {
    reportBtn.setAttribute('onclick', `openStepReportModal('${cfg.reportTarget}')`);
    reportBtn.setAttribute('title', cfg.reportTitle);
  }

  // 3. Switch Pen Chips Grid
  ['cip-pen-grid-all', 'cip-pen-grid-c1', 'cip-pen-grid-c2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === cfg.gridId) ? 'grid' : 'none';
  });

  // 4. Update Chart Datasets & Scales
  if (rec.chart) {
    rec.chart.data.datasets = cfg.datasets.map(d => ({ ...d, data: [] }));
    rec.penVisibility = cfg.datasets.map(() => true);

    const newOptions = getRecorderChartOptions(cfg.scales);
    rec.chart.options.scales = newOptions.scales;

    if (rec.mode === 'live') {
      let activeHist = rec.allHistory;
      if (circuitId === 'cip_line1') activeHist = rec.c1History;
      else if (circuitId === 'cip_line2') activeHist = rec.c2History;
      rec.history = activeHist;

      const pointsToShow = rec.windowSec;
      const startIdx = Math.max(0, rec.history.times.length - pointsToShow);
      rec.chart.data.labels = rec.history.times.slice(startIdx);
      rec.chart.data.$fullTimestamps = (rec.history.fullTimes || []).slice(startIdx);
      for (let i = 0; i < rec.chart.data.datasets.length; i++) {
        const penKey = `pen${i}`;
        rec.chart.data.datasets[i].data = (rec.history[penKey] || []).slice(startIdx);
      }
      rec.chart.update();
    } else {
      if (rec.historyRange === 'custom' && rec.customFrom && rec.customTo) {
        loadHistoricalCustomRange('cip', rec.customFrom, rec.customTo);
      } else {
        loadHistoricalData('cip', rec.historyRange || '1d');
      }
    }
  }
}

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
        { label: 'FIQ04 Inlet Flow (M4) (L/h)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yFlow' },
        { label: 'FIQCV08 Add Water (Liter)', data: [], borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yLevel' },
        { label: 'UHT VSDs Power (kW)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yPower' }
      ]
    },
    options: getRecorderChartOptions({
      yTemp: { min: 0, max: 160, title: 'Temp (°C)', color: '#ef4444', position: 'left' },
      yFlow: { min: 0, max: 20000, title: 'Flow (L/h)', color: '#10b981', position: 'right' },
      yLevel: { min: 0, max: 200, title: 'Level (Liter)', color: '#8b5cf6', position: 'left', display: false },
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
        { label: 'LC Product Weight (kg)', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'yWeight' },
        { label: 'VSD09 Agitator Speed (%)', data: [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderWidth: 1.8, pointRadius: 0, pointHoverRadius: 4, tension: 0.35, yAxisID: 'ySpeed' }
      ]
    },
    options: getRecorderChartOptions({
      yPress: { min: 0, max: 4.0, title: 'Press (bar)', color: '#06b6d4', position: 'left' },
      yTemp: { min: 0, max: 160, title: 'Temp (°C)', color: '#ef4444', position: 'right' },
      yWeight: { min: 0, max: 28000, title: 'Weight (kg)', color: '#10b981', position: 'left', drawGrid: false },
      ySpeed: { min: 0, max: 100, title: 'Speed (%)', color: '#f59e0b', position: 'right', display: false }
    })
  });
}

// 3. CIP RECORDER
function initCipRecorder() {
  const canvas = document.getElementById('chartRecorderCip');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const curMode = sectionRecorders.cip.currentCircuit || 'all';
  const cfg = CIP_CONFIGS[curMode] || CIP_CONFIGS.all;

  sectionRecorders.cip.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: cfg.datasets.map(d => ({ ...d, data: [] }))
    },
    options: getRecorderChartOptions(cfg.scales)
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
        color: conf.drawGrid !== false && conf.position === 'left' ? 'rgba(255, 255, 255, 0.04)' : undefined,
        drawOnChartArea: conf.drawGrid !== false && conf.position === 'left'
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
        displayColors: true,
        callbacks: {
          title: function(tooltipItems) {
            if (!tooltipItems || tooltipItems.length === 0) return '';
            const item = tooltipItems[0];
            const chart = item.chart;
            const idx = item.dataIndex;
            if (chart.data.$fullTimestamps && chart.data.$fullTimestamps[idx]) {
              return chart.data.$fullTimestamps[idx];
            }
            return item.label || '';
          }
        }
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

// ================= HISTORICAL DATA & SECTION RECORDER CONTROLS =================
async function loadHistoricalData(sec, range) {
  const rec = (sec === 'cip_line1' || sec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[sec];
  if (!rec) return;
  if (!rec.chart) initRecorderForSection(sec === 'cip_line1' || sec === 'cip_line2' ? 'cip' : sec);
  if (!rec.chart) return;

  let querySec = sec;
  if (sec === 'cip') {
    if (rec.currentCircuit === 'cip_line1' || rec.currentCircuit === 'cip_line2') {
      querySec = rec.currentCircuit;
    }
  }

  const statusTag = document.getElementById(rec.statusId);
  if (statusTag) {
    statusTag.textContent = 'QUERYING INFLUXDB...';
    statusTag.style.background = 'rgba(2, 132, 199, 0.25)';
    statusTag.style.color = '#38bdf8';
    statusTag.style.borderColor = 'rgba(56, 189, 248, 0.5)';
  }

  try {
    const host = window.location.hostname || '127.0.0.1';
    const res = await fetch(`http://${host}:8000/api/v1/telemetry/history?section=${querySec}&range=${range}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    if (data.status === 'success' && data.timestamps && data.timestamps.length > 0) {
      rec.chart.data.labels = data.timestamps;
      rec.chart.$fullTimestamps = data.full_timestamps || [];
      rec.chart.data.$fullTimestamps = data.full_timestamps || [];
      data.pens.forEach((penData, idx) => {
        if (rec.chart.data.datasets[idx]) {
          rec.chart.data.datasets[idx].data = penData;
        }
      });
      rec.chart.update();
      if (statusTag) {
        const rangeNames = { '1d': '1 วัน', '7d': '7 วัน', '30d': '1 เดือน', '1y': '1 ปี (Historian)' };
        statusTag.textContent = `HISTORIAN (${rangeNames[range] || range.toUpperCase()}): ${data.count} จุด`;
        statusTag.style.background = 'rgba(2, 132, 199, 0.2)';
        statusTag.style.color = '#38bdf8';
        statusTag.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      }
    } else {
      if (statusTag) {
        statusTag.textContent = `HISTORIAN: ไม่มีข้อมูลย้อนหลัง (${range})`;
        statusTag.style.background = 'rgba(239, 68, 68, 0.15)';
        statusTag.style.color = '#f87171';
        statusTag.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
    }
  } catch (err) {
    console.error('Failed to load historical data:', err);
    if (statusTag) {
      statusTag.textContent = 'QUERY FAILED';
      statusTag.style.background = 'rgba(239, 68, 68, 0.2)';
      statusTag.style.color = '#ef4444';
      statusTag.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    }
  }
}

// SETUP CONTROLS PER SECTION
function setupSectionRecorderControls() {
  // Window & Historical range buttons
  document.querySelectorAll('.win-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const rec = sectionRecorders[sec];
      const wrap = btn.closest('.recorder-window-selector');
      if (wrap) wrap.querySelectorAll('.win-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.getAttribute('data-mode') || 'live';
      rec.mode = mode;

      const statusTag = document.getElementById(rec.statusId);

      if (mode === 'history') {
        const range = btn.getAttribute('data-range') || '1d';
        rec.historyRange = range;
        await loadHistoricalData(sec, range);
      } else {
        rec.windowSec = parseInt(btn.getAttribute('data-window')) || 60;
        if (statusTag) {
          statusTag.textContent = rec.paused ? 'PAUSED' : 'LIVE STREAMING';
          statusTag.style.background = rec.paused ? 'rgba(251, 191, 36, 0.15)' : 'rgba(16, 185, 129, 0.15)';
          statusTag.style.color = rec.paused ? '#fbbf24' : 'var(--accent-emerald)';
          statusTag.style.borderColor = rec.paused ? 'rgba(251, 191, 36, 0.4)' : 'rgba(16, 185, 129, 0.3)';
        }
        updateSingleSectionRecorder(sec);
      }
    });
  });

  // Pause buttons
  document.querySelectorAll('.btn-pause').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const rec = sectionRecorders[sec];

      if (rec.mode === 'history') {
        // Switch back to live paused
        rec.mode = 'live';
        rec.paused = true;
        const wrap = btn.closest('.recorder-card')?.querySelector('.recorder-window-selector');
        if (wrap) {
          wrap.querySelectorAll('.win-btn').forEach(b => b.classList.remove('active'));
          wrap.querySelector('[data-mode="live"]')?.classList.add('active');
        }
      } else {
        rec.paused = !rec.paused;
      }

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
        updateSingleSectionRecorder(sec);
      }
    });
  });

  // Clear / Refresh buttons
  document.querySelectorAll('.btn-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (!sec || !sectionRecorders[sec]) return;
      const rec = sectionRecorders[sec];
      if (rec.mode === 'history') {
        loadHistoricalData(sec, rec.historyRange || '1d');
      } else {
        if (sec === 'cip') {
          for (const k in rec.allHistory) rec.allHistory[k] = [];
          for (const k in rec.c1History) rec.c1History[k] = [];
          for (const k in rec.c2History) rec.c2History[k] = [];
        }
        for (const k in rec.history) {
          rec.history[k] = [];
        }
        updateSingleSectionRecorder(sec);
      }
    });
  });

  // CIP Circuit dropdown selector
  const cipCircuitSelect = document.getElementById('cip-circuit-select');
  if (cipCircuitSelect) {
    cipCircuitSelect.addEventListener('change', (e) => {
      switchCipCircuit(e.target.value);
    });
  }

  // Export CSV buttons - direct Trend CSV export
  document.querySelectorAll('.recorder-card .btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sec = btn.getAttribute('data-section');
      if (sec) exportDirectTrendCsv(sec, btn);
    });
  });

  // Export Modal event handlers
  document.getElementById('export-modal-close')?.addEventListener('click', closeExportModal);
  document.getElementById('export-modal-btn-cancel')?.addEventListener('click', closeExportModal);
  document.getElementById('export-modal-btn-confirm')?.addEventListener('click', executeExportWithResolution);
  document.getElementById('export-range-select')?.addEventListener('change', updateExportEstimate);
  document.getElementById('export-freq-select')?.addEventListener('change', updateExportEstimate);
  document.getElementById('export-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'export-modal-overlay') closeExportModal();
  });

  // Alarm Limits modal buttons
  document.querySelectorAll('.btn-limits').forEach(btn => {
    btn.addEventListener('click', () => {
      const sec = btn.getAttribute('data-section');
      if (sec) openLimitsModal(sec);
    });
  });

  // Modal close handlers
  document.getElementById('limits-modal-close')?.addEventListener('click', closeLimitsModal);
  document.getElementById('limits-modal-btn-close')?.addEventListener('click', closeLimitsModal);
  document.getElementById('limits-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'limits-modal-overlay') closeLimitsModal();
  });

  // Pen chip visibility toggle
  document.querySelectorAll('.pen-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sec = chip.getAttribute('data-section');
      const penIdx = parseInt(chip.getAttribute('data-pen'));
      if (!sec || isNaN(penIdx)) return;
      const targetSec = (sec === 'cip_line1' || sec === 'cip_line2') ? 'cip' : sec;
      const rec = sectionRecorders[targetSec];
      if (!rec || !rec.chart) return;

      rec.penVisibility[penIdx] = !rec.penVisibility[penIdx];
      chip.classList.toggle('disabled', !rec.penVisibility[penIdx]);
      rec.chart.setDatasetVisibility(penIdx, rec.penVisibility[penIdx]);
      rec.chart.update();
    });
  });
}

// ================= CONFIGURE SAMPLING & EXPORT CSV / EXCEL =================
let currentExportSection = 'uht';
let currentExportBtn = null;

function openExportModal(sec, btn) {
  let effectiveSec = sec;
  if (sec === 'cip') {
    const cur = sectionRecorders.cip?.currentCircuit;
    if (cur === 'cip_line1' || cur === 'cip_line2') effectiveSec = cur;
  }
  currentExportSection = effectiveSec;
  currentExportBtn = btn;

  const overlay = document.getElementById('export-modal-overlay');
  const badgeEl = document.getElementById('export-modal-section-badge');
  const rangeSelect = document.getElementById('export-range-select');
  const freqSelect = document.getElementById('export-freq-select');
  if (!overlay) return;

  const secTitles = {
    uht: 'UHT STERILIZER PROCESS (DB1200)',
    atank: 'ASEPTIC TANK ATANK (DB1301)',
    cip: 'CIP SYSTEMS LINE 1 & 2 (COMBINED)',
    cip_line1: 'CIP CIRCUIT 1 [DB1801] (LINE 1)',
    cip_line2: 'CIP CIRCUIT 2 [DB1802] (LINE 2)',
    prod: 'PRODUCTION SUPPLY & FILTRATION'
  };
  if (badgeEl) badgeEl.textContent = secTitles[effectiveSec] || effectiveSec.toUpperCase();

  const rec = (effectiveSec === 'cip_line1' || effectiveSec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[effectiveSec];
  if (rec && rec.mode === 'history' && rec.historyRange) {
    if (rangeSelect) rangeSelect.value = rec.historyRange;
    if (rec.historyRange === '1y') freqSelect.value = '1h';
    else if (rec.historyRange === '30d') freqSelect.value = '1h';
    else if (rec.historyRange === '7d') freqSelect.value = '15m';
    else if (rec.historyRange === '1d') freqSelect.value = '1m';
  } else {
    if (rangeSelect) rangeSelect.value = 'current';
    if (freqSelect) freqSelect.value = '1m';
  }

  updateExportEstimate();
  overlay.classList.add('active');
}

function closeExportModal() {
  const overlay = document.getElementById('export-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function updateExportEstimate() {
  const range = document.getElementById('export-range-select')?.value || 'current';
  const freq = document.getElementById('export-freq-select')?.value || '1m';
  const estRowsEl = document.getElementById('export-est-rows');
  const estHintEl = document.getElementById('export-est-hint');
  if (!estRowsEl) return;

  let rangeSec = 60;
  if (range === 'current') {
    const rec = (currentExportSection === 'cip_line1' || currentExportSection === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[currentExportSection];
    if (rec && rec.mode === 'history') {
      const map = { '1d': 86400, '7d': 604800, '30d': 2592000, '1y': 31536000 };
      rangeSec = map[rec.historyRange] || 86400;
    } else {
      rangeSec = (rec ? rec.windowSec : 60);
    }
  } else {
    const map = { '1h': 3600, '1d': 86400, '7d': 604800, '30d': 2592000, '1y': 31536000 };
    rangeSec = map[range] || 86400;
  }

  const freqMap = { '1s': 1, '5s': 5, '10s': 10, '30s': 30, '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
  const stepSec = freqMap[freq] || 60;

  const estimatedCount = Math.max(1, Math.round(rangeSec / stepSec));
  estRowsEl.textContent = `~${estimatedCount.toLocaleString()} แถว`;

  if (estimatedCount > 20000) {
    estHintEl.textContent = '⚠️ ข้อมูลค่อนข้างละเอียดมาก อาจใช้เวลาเปิดไฟล์ใน Excel นานขึ้นเล็กน้อย';
    estHintEl.style.color = '#fbbf24';
  } else if (estimatedCount > 2000) {
    estHintEl.textContent = '📊 ขนาดกำลังเหมาะสม ละเอียด ครบถ้วน สำหรับการวิเคราะห์สถิติโรงงาน';
    estHintEl.style.color = '#38bdf8';
  } else {
    estHintEl.textContent = '⚡ ไฟล์ขนาดกะทัดรัด เปิดใน Microsoft Excel ได้รวดเร็ว ไม่หน่วงเครื่อง';
    estHintEl.style.color = '#10b981';
  }
}

async function executeExportWithResolution() {
  const sec = currentExportSection;
  const range = document.getElementById('export-range-select')?.value || 'current';
  const freq = document.getElementById('export-freq-select')?.value || '1m';
  const confirmBtn = document.getElementById('export-modal-btn-confirm');

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '⏳ กำลังสกัดข้อมูลตามความถี่...';
  }

  try {
    const rec = (sec === 'cip_line1' || sec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[sec];
    let timestamps = [];
    let datasetsData = [];
    let labelsList = [];

    const secTitles = {
      uht: 'UHT_Thermal_Flow_Recorder',
      atank: 'ATANK_Aseptic_Recorder',
      cip: 'CIP_Systems_Recorder',
      cip_line1: 'CIP_Circuit1_DB1801_Recorder',
      cip_line2: 'CIP_Circuit2_DB1802_Recorder',
      prod: 'Prod_Supply_Recorder'
    };

    if (range === 'current' && rec && rec.mode === 'live') {
      // Live buffer downsampling based on selected frequency
      const freqMap = { '1s': 1, '5s': 5, '10s': 10, '30s': 30, '1m': 60, '5m': 300, '15m': 900, '1h': 3600 };
      const step = freqMap[freq] || 1;
      const rawTimes = rec.history.times || [];
      const numPens = rec.chart?.data.datasets.length || 0;

      for (let p = 0; p < numPens; p++) {
        datasetsData.push([]);
        labelsList.push(rec.chart.data.datasets[p].label || `Pen ${p+1}`);
      }

      for (let i = 0; i < rawTimes.length; i += step) {
        timestamps.push(rawTimes[i]);
        for (let p = 0; p < numPens; p++) {
          const penArr = rec.history[`pen${p}`] || [];
          datasetsData[p].push(penArr[i] !== undefined ? penArr[i] : '');
        }
      }
    } else {
      // Historical or Specific range via Backend InfluxDB aggregateWindow
      const effectiveRange = (range === 'current' ? (rec?.historyRange || '1d') : range);
      const host = window.location.hostname || '127.0.0.1';
      const url = `http://${host}:8000/api/v1/telemetry/history?section=${sec}&range=${effectiveRange}&window=${freq}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.status === 'success' && data.timestamps && data.timestamps.length > 0) {
        timestamps = data.full_timestamps || data.timestamps;
        datasetsData = data.pens || [];
        labelsList = data.pen_labels || (rec?.chart?.data.datasets.map(d => d.label) || []);
      } else {
        alert('ไม่พบข้อมูลประวัติในช่วงเวลาและความถี่ที่เลือก กรุณาลองปรับช่วงเวลา');
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = '📥 ดาวน์โหลดไฟล์ CSV / Excel';
        }
        return;
      }
    }

    if (timestamps.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '📥 ดาวน์โหลดไฟล์ CSV / Excel';
      }
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = `${secTitles[sec] || sec}_${range}_step${freq}_${dateStr}_${timeStr}.csv`;

    // Build CSV with UTF-8 BOM (\uFEFF)
    let csv = '\uFEFF';
    csv += `# RUNGSAPPATTANA (THAILAND) CO., LTD. - INDUSTRIAL PROCESS RECORDER REPORT\n`;
    csv += `# UHT SCADA OPERATIONS & INVENTORY COMMAND CENTER • By xDev.CO.LTD\n`;
    csv += `# SECTION: ${sec.toUpperCase()}\n`;
    csv += `# EXPORT DATE: ${now.toLocaleString('th-TH')}\n`;
    csv += `# TIME RANGE: ${range.toUpperCase()}\n`;
    csv += `# SAMPLING RESOLUTION / FREQUENCY: ${freq}\n`;
    csv += `# TOTAL ROWS: ${timestamps.length}\n`;
    csv += '\n';

    // Header
    const header = ['ลำดับ (Index)', 'วัน-เวลา (Date-Time)'];
    labelsList.forEach(l => header.push(`"${(l || '').replace(/"/g, '""')}"`));
    csv += header.join(',') + '\n';

    // Rows
    for (let i = 0; i < timestamps.length; i++) {
      const row = [i + 1, `"${timestamps[i]}"`];
      for (let p = 0; p < datasetsData.length; p++) {
        const val = datasetsData[p][i];
        row.push(val !== null && val !== undefined ? val : '');
      }
      csv += row.join(',') + '\n';
    }

    // Trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    closeExportModal();

    if (currentExportBtn) {
      const origHtml = currentExportBtn.innerHTML;
      currentExportBtn.innerHTML = '✅ ส่งออกสำเร็จ!';
      currentExportBtn.style.background = 'rgba(16, 185, 129, 0.35)';
      currentExportBtn.style.borderColor = '#10b981';
      currentExportBtn.style.color = '#fff';
      setTimeout(() => {
        currentExportBtn.innerHTML = origHtml;
        currentExportBtn.style.background = '';
        currentExportBtn.style.borderColor = '';
        currentExportBtn.style.color = '';
      }, 2000);
    }
  } catch (err) {
    console.error('Export error:', err);
    alert('เกิดข้อผิดพลาดในการดึงข้อมูลส่งออก: ' + err.message);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '📥 ดาวน์โหลดไฟล์ CSV / Excel';
    }
  }
}

// ================= PROCESS ALARM LIMITS & TOLERANCE MATRIX =================
const PEN_ALARM_LIMITS = {
  uht: [
    { pen: 0, tag: 'TT01 Holding Temp', unit: '°C', target: '137.0 - 142.0', ll: 135.0, l: 137.0, h: 143.0, hh: 145.0, ccp: true },
    { pen: 1, tag: 'TT02 Pre-Heat 1', unit: '°C', target: '80.0 - 90.0', ll: 70.0, l: 75.0, h: 92.0, hh: 96.0, ccp: false },
    { pen: 2, tag: 'TT04 Inlet Temp', unit: '°C', target: '60.0 - 70.0', ll: 50.0, l: 55.0, h: 75.0, hh: 80.0, ccp: false },
    { pen: 3, tag: 'FIQ04 Inlet Flow (M4)', unit: 'L/h', target: 'SV: 7000 L/h', ll: null, l: null, h: null, hh: null, ccp: true },
    { pen: 4, tag: 'FIQCV08 Add Water', unit: 'Liter', target: 'SV: 50.0 L', ll: null, l: null, h: null, hh: null, ccp: false },
    { pen: 5, tag: 'UHT VSDs Power', unit: 'kW', target: '< 38.0', ll: null, l: null, h: 36.0, hh: 40.0, ccp: false }
  ],
  atank: [
    { pen: 0, tag: 'PT460 Aseptic Pressure', unit: 'bar', target: '2.0 - 2.5', ll: 1.8, l: 1.95, h: 2.65, hh: 2.9, ccp: true },
    { pen: 1, tag: 'TT460 Sterile Temp', unit: '°C', target: 'Sterile: >135 / Stor: <28', ll: null, l: 20.0, h: 32.0, hh: 145.0, ccp: true },
    { pen: 2, tag: 'TT477 Barrier Temp', unit: '°C', target: '> 121.0', ll: 115.0, l: 120.0, h: 145.0, hh: 150.0, ccp: false },
    { pen: 3, tag: 'LC Product Weight', unit: 'kg', target: '2,000 - 26,000', ll: 1000, l: 2000, h: 26500, hh: 27500, ccp: false },
    { pen: 4, tag: 'VSD09 Agitator Speed', unit: '%', target: '50.0 - 90.0', ll: 30.0, l: 45.0, h: 95.0, hh: 100.0, ccp: false }
  ],
  cip: [
    { pen: 0, tag: 'L1 CT_R Return Cond', unit: 'mS/cm', target: 'Caustic: 35-55 / Rinse: <2', ll: 0.5, l: 1.0, h: 60.0, hh: 70.0, ccp: true },
    { pen: 1, tag: 'L1 TT_R Return Temp', unit: '°C', target: '> 75.0', ll: 65.0, l: 72.0, h: 92.0, hh: 98.0, ccp: true },
    { pen: 2, tag: 'L1 FT_S Supply Flow', unit: 'L/h', target: '> 15000', ll: 10000, l: 12000, h: 22000, hh: 25000, ccp: false },
    { pen: 3, tag: 'L2 CT_R Return Cond', unit: 'mS/cm', target: 'Caustic: 35-55 / Rinse: <2', ll: 0.5, l: 1.0, h: 60.0, hh: 70.0, ccp: true },
    { pen: 4, tag: 'L2 TT_R Return Temp', unit: '°C', target: '> 75.0', ll: 65.0, l: 72.0, h: 92.0, hh: 98.0, ccp: true },
    { pen: 5, tag: 'CIP Pumps Power', unit: 'kW', target: '< 24.0', ll: null, l: null, h: 22.0, hh: 25.0, ccp: false }
  ],
  cip_line1: [
    { pen: 0, tag: 'C1 Return Cond (CT_R)', unit: 'mS/cm', target: 'Caustic: 35-55 / Rinse: <2', ll: 0.5, l: 1.0, h: 60.0, hh: 70.0, ccp: true },
    { pen: 1, tag: 'C1 Return Temp (TT_R)', unit: '°C', target: '> 75.0', ll: 65.0, l: 72.0, h: 92.0, hh: 98.0, ccp: true },
    { pen: 2, tag: 'C1 Supply Temp (TT_S)', unit: '°C', target: '75.0 - 85.0', ll: 65.0, l: 72.0, h: 90.0, hh: 95.0, ccp: false },
    { pen: 3, tag: 'C1 Supply Flow (FT_S)', unit: 'L/h', target: '> 15000', ll: 10000, l: 12000, h: 22000, hh: 25000, ccp: false },
    { pen: 4, tag: 'VSD05 Pump Power', unit: 'kW', target: '< 7.5', ll: null, l: null, h: 7.0, hh: 8.0, ccp: false }
  ],
  cip_line2: [
    { pen: 0, tag: 'C2 Return Cond (CT_R)', unit: 'mS/cm', target: 'Caustic: 35-55 / Rinse: <2', ll: 0.5, l: 1.0, h: 60.0, hh: 70.0, ccp: true },
    { pen: 1, tag: 'C2 Return Temp (TT_R)', unit: '°C', target: '> 75.0', ll: 65.0, l: 72.0, h: 92.0, hh: 98.0, ccp: true },
    { pen: 2, tag: 'C2 Supply Temp (TT_S)', unit: '°C', target: '75.0 - 85.0', ll: 65.0, l: 72.0, h: 90.0, hh: 95.0, ccp: false },
    { pen: 3, tag: 'C2 Supply Flow (FT_S)', unit: 'L/h', target: '> 15000', ll: 10000, l: 12000, h: 22000, hh: 25000, ccp: false },
    { pen: 4, tag: 'VSD04 Pump Power', unit: 'kW', target: '< 5.5', ll: null, l: null, h: 5.0, hh: 5.8, ccp: false }
  ],
  prod: [
    { pen: 0, tag: 'PT_IN Filter Inlet', unit: 'bar', target: '3.0 - 4.5', ll: 2.0, l: 2.5, h: 4.8, hh: 5.5, ccp: false },
    { pen: 1, tag: 'PT_OUT Filter Outlet', unit: 'bar', target: '2.5 - 4.0', ll: 1.8, l: 2.2, h: 4.5, hh: 5.2, ccp: false },
    { pen: 2, tag: 'ΔP Diff Press', unit: 'bar', target: '< 0.5', ll: null, l: null, h: 0.8, hh: 1.2, ccp: true },
    { pen: 3, tag: 'P101 Power', unit: 'kW', target: '< 3.0', ll: null, l: null, h: 2.8, hh: 3.2, ccp: false },
    { pen: 4, tag: 'P101 Running Speed', unit: '%', target: '70.0 - 95.0', ll: 40.0, l: 60.0, h: 98.0, hh: 100.0, ccp: false }
  ]
};

function evaluatePenAlarm(conf, val) {
  if (val === null || val === undefined || isNaN(val)) {
    return { status: 'NORMAL', text: `Target: ${conf.target} ${conf.unit}`, badgeClass: 'badge-ok', chipClass: '' };
  }
  const formattedVal = conf.unit === 'kg' ? val.toLocaleString('en-US', { maximumFractionDigits: 1 }) : val.toFixed(1);
  const fmtLim = lim => lim !== null ? (conf.unit === 'kg' ? Number(lim).toLocaleString('en-US') : lim) : '';
  if (conf.hh !== null && val >= conf.hh) {
    return { status: 'CRITICAL', text: `🚨 CRITICAL (HH): ${formattedVal} ≥ ${fmtLim(conf.hh)}`, badgeClass: 'badge-crit', chipClass: 'alarm-critical' };
  }
  if (conf.ll !== null && val <= conf.ll) {
    return { status: 'CRITICAL', text: `🚨 CRITICAL (LL): ${formattedVal} ≤ ${fmtLim(conf.ll)}`, badgeClass: 'badge-crit', chipClass: 'alarm-critical' };
  }
  if (conf.h !== null && val >= conf.h) {
    return { status: 'WARNING', text: `⚠️ HIGH (H): ${formattedVal} ≥ ${fmtLim(conf.h)}`, badgeClass: 'badge-warn', chipClass: 'alarm-warning' };
  }
  if (conf.l !== null && val <= conf.l) {
    return { status: 'WARNING', text: `⚠️ LOW (L): ${formattedVal} ≤ ${fmtLim(conf.l)}`, badgeClass: 'badge-warn', chipClass: 'alarm-warning' };
  }
  return { status: 'NORMAL', text: `Target: ${conf.target} ${conf.unit}`, badgeClass: 'badge-ok', chipClass: '' };
}

function updatePenChipAlert(sec, penIdx, val) {
  const confList = PEN_ALARM_LIMITS[sec];
  if (!confList || !confList[penIdx]) return;
  const conf = confList[penIdx];
  const alertInfo = evaluatePenAlarm(conf, val);

  const chip = document.querySelector(`.pen-chip[data-section="${sec}"][data-pen="${penIdx}"]`);
  if (!chip) return;

  chip.classList.remove('alarm-warning', 'alarm-critical');
  if (alertInfo.chipClass) {
    chip.classList.add(alertInfo.chipClass);
  }

  const limitEl = chip.querySelector('.pen-limit');
  if (limitEl) {
    limitEl.className = `pen-limit ${alertInfo.badgeClass}`;
    limitEl.textContent = alertInfo.text;
  }
}

function openLimitsModal(sec) {
  let effectiveSec = sec;
  if (sec === 'cip') {
    const cur = sectionRecorders.cip?.currentCircuit;
    if (cur === 'cip_line1' || cur === 'cip_line2') effectiveSec = cur;
  }

  const overlay = document.getElementById('limits-modal-overlay');
  const titleEl = document.getElementById('limits-modal-title');
  const tbody = document.getElementById('limits-table-body');
  if (!overlay || !tbody) return;

  const secNames = {
    uht: 'UHT STERILIZER PROCESS (DB1200)',
    atank: 'ASEPTIC TANK ATANK (DB1301)',
    cip: 'CIP SYSTEMS LINE 1 & 2 (COMBINED)',
    cip_line1: 'CIP CIRCUIT 1 [DB1801] (LINE 1)',
    cip_line2: 'CIP CIRCUIT 2 [DB1802] (LINE 2)',
    prod: 'PRODUCTION SUPPLY & FILTRATION'
  };
  if (titleEl) {
    titleEl.textContent = `ALARM LIMIT CONFIGURATION: ${secNames[effectiveSec] || effectiveSec.toUpperCase()}`;
  }

  const confList = PEN_ALARM_LIMITS[effectiveSec] || PEN_ALARM_LIMITS[sec] || [];
  const rec = (effectiveSec === 'cip_line1' || effectiveSec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[effectiveSec];

  tbody.innerHTML = confList.map(conf => {
    let curVal = '--';
    if (rec && rec.chart && rec.chart.data.datasets[conf.pen]) {
      const dataArr = rec.chart.data.datasets[conf.pen].data;
      if (dataArr && dataArr.length > 0) {
        const last = dataArr[dataArr.length - 1];
        if (last !== null && last !== undefined) {
          curVal = conf.unit === 'kg'
            ? Number(last).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
            : Number(last).toFixed(1);
        }
      }
    }
    const evalResult = evaluatePenAlarm(conf, curVal !== '--' ? parseFloat(String(curVal).replace(/,/g, '')) : null);
    const badgeClass = evalResult.status === 'CRITICAL' ? 'crit' : (evalResult.status === 'WARNING' ? 'warn' : 'ok');

    const fmtLimit = lim => lim !== null ? (conf.unit === 'kg' ? Number(lim).toLocaleString('en-US') : lim) : '-';

    return `
      <tr>
        <td><strong>${conf.tag}</strong> ${conf.ccp ? '<span style="color:#ef4444; font-size:10px; font-weight:700;">[CCP]</span>' : ''}</td>
        <td class="font-mono">${conf.unit}</td>
        <td class="font-mono" style="font-weight:700; color:#38bdf8;">${curVal}</td>
        <td class="font-mono" style="color:#ef4444;">${fmtLimit(conf.ll)}</td>
        <td class="font-mono" style="color:#fbbf24;">${fmtLimit(conf.l)}</td>
        <td class="font-mono" style="color:#fbbf24;">${fmtLimit(conf.h)}</td>
        <td class="font-mono" style="color:#ef4444;">${fmtLimit(conf.hh)}</td>
        <td><span class="limits-status-badge ${badgeClass}">${evalResult.status}</span></td>
      </tr>
    `;
  }).join('');

  overlay.classList.add('active');
}

function closeLimitsModal() {
  const overlay = document.getElementById('limits-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

// PUSH LIVE TELEMETRY INTO ALL ACTIVE RECORDERS
function pushAllSectionRecordersData(d) {
  if (!d) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
  const pad = n => String(n).padStart(2, '0');
  const fullTimeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  // 1. UHT DATA
  const uhtRec = sectionRecorders.uht;
  const u = d.uht || {};
  const vf = d.vsd_fleet || {};
  const uhtPower = (vf.VSD01?.power_kw || 0) + (vf.VSD02?.power_kw || 0) + (vf.VSD03?.power_kw || 0) + (vf.VSD06?.power_kw || 0);

  setText('uht-pen-tt01', `${(u.tt01 || 0).toFixed(1)} °C`);
  setText('uht-pen-tt02', `${(u.tt02 || 0).toFixed(1)} °C`);
  setText('uht-pen-tt04', `${(u.tt04 || 0).toFixed(1)} °C`);
  setText('uht-pen-flow', `${(u.ft04fiq || 0).toFixed(0)} L/h`);
  const fiqPv = (u.fiqcv08_pv !== undefined) ? u.fiqcv08_pv : (u.lt || 0);
  setText('uht-pen-lt', `${fiqPv.toFixed(2)} Liter`);
  setText('uht-pen-power', `${uhtPower.toFixed(1)} kW`);

  // Update UHT Alarm Alerts on Chips
  updatePenChipAlert('uht', 0, u.tt01);
  updatePenChipAlert('uht', 1, u.tt02);
  updatePenChipAlert('uht', 2, u.tt04);
  updatePenChipAlert('uht', 3, u.ft04fiq);
  updatePenChipAlert('uht', 4, u.lt);
  updatePenChipAlert('uht', 5, uhtPower);

  if (!uhtRec.paused && uhtRec.mode === 'live') {
    uhtRec.history.times.push(timeStr);
    if (!uhtRec.history.fullTimes) uhtRec.history.fullTimes = [];
    uhtRec.history.fullTimes.push(fullTimeStr);
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
  setText('atank-pen-lc', `${(a.lc || 0).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`);
  setText('atank-pen-vsd', `${(vsd09.curspeed_pct || 0).toFixed(0)} %`);

  // Update ATANK Alarm Alerts on Chips
  updatePenChipAlert('atank', 0, a.pt460);
  updatePenChipAlert('atank', 1, a.tt460);
  updatePenChipAlert('atank', 2, a.tt477);
  updatePenChipAlert('atank', 3, a.lc);
  updatePenChipAlert('atank', 4, vsd09.curspeed_pct);

  if (!atkRec.paused && atkRec.mode === 'live') {
    atkRec.history.times.push(timeStr);
    if (!atkRec.history.fullTimes) atkRec.history.fullTimes = [];
    atkRec.history.fullTimes.push(fullTimeStr);
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
  const c1Power = vf.VSD05?.power_kw || 0;
  const c2Power = vf.VSD04?.power_kw || 0;
  const cipPower = c1Power + c2Power;

  // 3a. Update ALL Pen Chips
  setText('cip-pen-ct1', `${(c1.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-pen-tt1', `${(c1.tt_r || 0).toFixed(1)} °C`);
  setText('cip-pen-ft1', `${(c1.ft_s || 0).toFixed(0)} L/h`);
  setText('cip-pen-ct2', `${(c2.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-pen-tt2', `${(c2.tt_r || 0).toFixed(1)} °C`);
  setText('cip-pen-power', `${cipPower.toFixed(1)} kW`);

  updatePenChipAlert('cip', 0, c1.ct_r);
  updatePenChipAlert('cip', 1, c1.tt_r);
  updatePenChipAlert('cip', 2, c1.ft_s);
  updatePenChipAlert('cip', 3, c2.ct_r);
  updatePenChipAlert('cip', 4, c2.tt_r);
  updatePenChipAlert('cip', 5, cipPower);

  // 3b. Update Circuit 1 Dedicated Chips
  setText('cip-c1-pen-ctr', `${(c1.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-c1-pen-ttr', `${(c1.tt_r || 0).toFixed(1)} °C`);
  setText('cip-c1-pen-tts', `${(c1.tt_s || 0).toFixed(1)} °C`);
  setText('cip-c1-pen-fts', `${(c1.ft_s || 0).toFixed(0)} L/h`);
  setText('cip-c1-pen-power', `${c1Power.toFixed(2)} kW`);

  updatePenChipAlert('cip_line1', 0, c1.ct_r);
  updatePenChipAlert('cip_line1', 1, c1.tt_r);
  updatePenChipAlert('cip_line1', 2, c1.tt_s);
  updatePenChipAlert('cip_line1', 3, c1.ft_s);
  updatePenChipAlert('cip_line1', 4, c1Power);

  // 3c. Update Circuit 2 Dedicated Chips
  setText('cip-c2-pen-ctr', `${(c2.ct_r || 0).toFixed(2)} mS/cm`);
  setText('cip-c2-pen-ttr', `${(c2.tt_r || 0).toFixed(1)} °C`);
  setText('cip-c2-pen-tts', `${(c2.tt_s || 0).toFixed(1)} °C`);
  setText('cip-c2-pen-fts', `${(c2.ft_s || 0).toFixed(0)} L/h`);
  setText('cip-c2-pen-power', `${c2Power.toFixed(2)} kW`);

  updatePenChipAlert('cip_line2', 0, c2.ct_r);
  updatePenChipAlert('cip_line2', 1, c2.tt_r);
  updatePenChipAlert('cip_line2', 2, c2.tt_s);
  updatePenChipAlert('cip_line2', 3, c2.ft_s);
  updatePenChipAlert('cip_line2', 4, c2Power);

  if (!cipRec.paused && cipRec.mode === 'live') {
    // 1) All History
    cipRec.allHistory.times.push(timeStr);
    if (!cipRec.allHistory.fullTimes) cipRec.allHistory.fullTimes = [];
    cipRec.allHistory.fullTimes.push(fullTimeStr);
    cipRec.allHistory.pen0.push(c1.ct_r || 0);
    cipRec.allHistory.pen1.push(c1.tt_r || 0);
    cipRec.allHistory.pen2.push(c1.ft_s || 0);
    cipRec.allHistory.pen3.push(c2.ct_r || 0);
    cipRec.allHistory.pen4.push(c2.tt_r || 0);
    cipRec.allHistory.pen5.push(cipPower);
    trimRecorderHistory({ history: cipRec.allHistory });

    // 2) Circuit 1 History
    cipRec.c1History.times.push(timeStr);
    if (!cipRec.c1History.fullTimes) cipRec.c1History.fullTimes = [];
    cipRec.c1History.fullTimes.push(fullTimeStr);
    cipRec.c1History.pen0.push(c1.ct_r || 0);
    cipRec.c1History.pen1.push(c1.tt_r || 0);
    cipRec.c1History.pen2.push(c1.tt_s || 0);
    cipRec.c1History.pen3.push(c1.ft_s || 0);
    cipRec.c1History.pen4.push(c1Power);
    trimRecorderHistory({ history: cipRec.c1History });

    // 3) Circuit 2 History
    cipRec.c2History.times.push(timeStr);
    if (!cipRec.c2History.fullTimes) cipRec.c2History.fullTimes = [];
    cipRec.c2History.fullTimes.push(fullTimeStr);
    cipRec.c2History.pen0.push(c2.ct_r || 0);
    cipRec.c2History.pen1.push(c2.tt_r || 0);
    cipRec.c2History.pen2.push(c2.tt_s || 0);
    cipRec.c2History.pen3.push(c2.ft_s || 0);
    cipRec.c2History.pen4.push(c2Power);
    trimRecorderHistory({ history: cipRec.c2History });

    if (cipRec.currentCircuit === 'cip_line1') {
      cipRec.history = cipRec.c1History;
    } else if (cipRec.currentCircuit === 'cip_line2') {
      cipRec.history = cipRec.c2History;
    } else {
      cipRec.history = cipRec.allHistory;
    }
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

  // Update PROD Alarm Alerts on Chips
  updatePenChipAlert('prod', 0, p.pt_in);
  updatePenChipAlert('prod', 1, p.pt_out);
  updatePenChipAlert('prod', 2, dp);
  updatePenChipAlert('prod', 3, vsd08.power_kw);
  updatePenChipAlert('prod', 4, vsd08.curspeed_pct);

  if (!prodRec.paused && prodRec.mode === 'live') {
    prodRec.history.times.push(timeStr);
    if (!prodRec.history.fullTimes) prodRec.history.fullTimes = [];
    prodRec.history.fullTimes.push(fullTimeStr);
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
      if (Array.isArray(rec.history[k])) {
        rec.history[k].shift();
      }
    }
  }
}

function updateSingleSectionRecorder(sec) {
  const rec = sectionRecorders[sec];
  if (!rec || !rec.chart) return;

  const pointsToShow = rec.windowSec;
  const startIdx = Math.max(0, rec.history.times.length - pointsToShow);

  rec.chart.data.labels = rec.history.times.slice(startIdx);
  rec.chart.data.$fullTimestamps = (rec.history.fullTimes || []).slice(startIdx);
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
    const rec = sectionRecorders[sec];
    if (rec && rec.mode === 'live') {
      updateSingleSectionRecorder(sec);
    }
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
    { key: 'VSD02', tag: 'VSD02', name: 'UHT PUMP FEED', section: 'UHT STERILIZER', rated: '7.5 kW', group: 'uht' },
    { key: 'VSD03', tag: 'VSD03', name: 'UHT PUMP SUPPLY (PID)', section: 'UHT STERILIZER', rated: '4.0 kW', group: 'uht' },
    { key: 'VSD06', tag: 'VSD06', name: 'UHT PUMP RETURN', section: 'UHT STERILIZER', rated: '4.0 kW', group: 'uht' },
    { key: 'VSD04', tag: 'VSD04', name: 'CIP L2 SUPPLY PUMP', section: 'CIP SYSTEMS', rated: '5.5 kW', group: 'cip' },
    { key: 'VSD05', tag: 'VSD05', name: 'CIP L1 SUPPLY PUMP', section: 'CIP SYSTEMS', rated: '7.5 kW', group: 'cip' },
    { key: 'VSD08', tag: 'VSD08', name: 'PROD P101 SUPPLY PUMP', section: 'PROD SUPPLY', rated: '3.0 kW', group: 'tank' },
    { key: 'VSD09', tag: 'VSD09', name: 'ATANK ASEPTIC AGITATOR', section: 'ASEPTIC TANK', rated: '3.0 kW', group: 'tank' }
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

    const fiqSv = (u.fiqcv08_sv !== undefined) ? u.fiqcv08_sv : 50.0;
    const fiqPv = (u.fiqcv08_pv !== undefined) ? u.fiqcv08_pv : (u.lt || 0);
    const fiqOv = (u.fiqcv08_ov !== undefined) ? u.fiqcv08_ov : 20.0;

    setText('uht-fiq-sv', fiqSv.toFixed(2));
    setText('uht-lt', `${fiqPv.toFixed(2)} Liter`);
    setText('uht-fiq-ov', fiqOv.toFixed(2));

    const pct = fiqSv > 0 ? Math.min(100, Math.max(0, (fiqPv / fiqSv) * 100)) : 0;
    setText('uht-fiq-pct', `${pct.toFixed(1)}%`);
    setText('uht-fiq-ov-pct', `${fiqOv.toFixed(1)}%`);

    const fiqBar = document.getElementById('uht-lt-bar');
    if (fiqBar) fiqBar.style.width = `${pct}%`;
    const fiq04Sv = (u.fiq04_sv !== undefined) ? u.fiq04_sv : 7000.0;
    const fiq04Pv = (u.fiq04_pv !== undefined) ? u.fiq04_pv : (u.ft04fiq || 0.0);
    const fiq04Ov = (u.fiq04_ov !== undefined) ? u.fiq04_ov : 60.0;

    setText('uht-fiq04-sv', fiq04Sv.toFixed(1));
    setText('uht-flow', `${fiq04Pv.toFixed(1)} L/h`);
    setText('kpi-live-flow', `${fiq04Pv.toFixed(1)} L/h`);
    setText('uht-fiq04-ov', fiq04Ov.toFixed(1));

    const flowBar = document.getElementById('uht-flow-bar');
    if (flowBar) flowBar.style.width = `${Math.min(100, Math.max(5, fiq04Ov))}%`;
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

    // UHT Subtab 2 & 3 Analytics Live Binding (Zero PLC Load)
    const an = u.analytics || {};
    const loops = u.loops || {};

    // 1. Plate Fouling Index (HE01 Bank)
    const foulingIdx = an.fouling_index !== undefined ? an.fouling_index : 12.5;
    setText('uht-fouling-val', foulingIdx.toFixed(1));
    const foulingBar = document.getElementById('uht-fouling-bar');
    if (foulingBar) {
      foulingBar.style.width = `${Math.min(100, Math.max(5, foulingIdx))}%`;
      foulingBar.style.background = an.fouling_color || '#10b981';
    }
    const foulingBadge = document.getElementById('uht-fouling-badge');
    if (foulingBadge) {
      foulingBadge.textContent = an.fouling_status || 'OPTIMAL / CLEAN';
      foulingBadge.style.color = an.fouling_color || '#10b981';
    }
    setText('uht-steam-demand', `${(an.steam_demand_avg || 10.0).toFixed(1)}%`);

    // 2. M4 & VSD01 Load Analytics
    setText('uht-m4-flow-disp', `${fiq04Pv.toFixed(1)} L/h`);
    if (d.vsds && d.vsds.vsd01) {
      const v1 = d.vsds.vsd01;
      setText('uht-eng-vsd01-act', `${(v1.act_speed || 0).toFixed(1)}%`);
      setText('uht-eng-vsd01-hz', `${(v1.freq || 0).toFixed(1)} Hz`);
      setText('uht-eng-vsd01-curr', `${(v1.curr || 0).toFixed(1)} A`);
      setText('uht-eng-vsd01-kw', `${(v1.pwr || 0).toFixed(2)} kW`);
    }

    // 3. Thermal Gradient & Heat Recovery
    const deltaT = Math.max(0, u.tt07 - u.tt04);
    setText('uht-delta-t-regen', deltaT.toFixed(1));
    setText('uht-eng-tt04', `${u.tt04.toFixed(1)} °C`);
    setText('uht-eng-tt07', `${u.tt07.toFixed(1)} °C`);
    setText('uht-eng-tt02', `${u.tt02.toFixed(1)} °C`);
    setText('uht-eng-tt01', `${u.tt01.toFixed(1)} °C`);

    // 4. PID Loops Matrix
    if (loops.fiq04) {
      const l = loops.fiq04;
      setText('loop-fiq04-sv', `${l.sv.toFixed(1)} L/h`);
      setText('loop-fiq04-pv', `${l.pv.toFixed(1)} L/h`);
      setText('loop-fiq04-ov', `${l.ov.toFixed(1)}%`);
      setText('loop-fiq04-err', `${Math.abs(l.pv - l.sv).toFixed(1)}`);
    }
    if (loops.fiqcv08) {
      const l = loops.fiqcv08;
      setText('loop-fiqcv08-sv', `${l.sv.toFixed(2)} L`);
      setText('loop-fiqcv08-pv', `${l.pv.toFixed(2)} L`);
      setText('loop-fiqcv08-ov', `${l.ov.toFixed(2)}%`);
      setText('loop-fiqcv08-err', `${Math.abs(l.pv - l.sv).toFixed(2)}`);
    }
    if (loops.cv49) {
      const l = loops.cv49;
      setText('loop-cv49-sv', `${l.sv.toFixed(1)} °C`);
      setText('loop-cv49-pv', `${l.pv.toFixed(1)} °C`);
      setText('loop-cv49-ov', `${l.ov.toFixed(1)}%`);
      setText('loop-cv49-err', `${Math.abs(l.pv - l.sv).toFixed(1)}`);
    }
    if (loops.cv50) {
      const l = loops.cv50;
      setText('loop-cv50-sv', `${l.sv.toFixed(1)} °C`);
      setText('loop-cv50-pv', `${l.pv.toFixed(1)} °C`);
      setText('loop-cv50-ov', `${l.ov.toFixed(1)}%`);
      setText('loop-cv50-err', `${Math.abs(l.pv - l.sv).toFixed(1)}`);
    }
    if (loops.cv64) {
      const l = loops.cv64;
      setText('loop-cv64-sv', `${l.sv.toFixed(1)} °C`);
      setText('loop-cv64-pv', `${l.pv.toFixed(1)} °C`);
      setText('loop-cv64-ov', `${l.ov.toFixed(1)}%`);
      setText('loop-cv64-err', `${Math.abs(l.pv - l.sv).toFixed(1)}`);
    }

    // 5. Management & CCP
    const f0Val = (an.f0_rate_per_min || 0) > 0 ? (an.f0_rate_per_min * (16.0 / 60.0)).toFixed(1) : '38.4';
    setText('uht-f0-val', f0Val);

    let totalUhtKw = 0.0;
    if (d.vsds) {
      ['vsd01', 'vsd02', 'vsd03', 'vsd06'].forEach(tag => {
        if (d.vsds[tag] && d.vsds[tag].pwr) totalUhtKw += d.vsds[tag].pwr;
      });
    }
    setText('uht-total-vsd-kw', `${totalUhtKw.toFixed(2)} kW`);
    const secVal = fiq04Pv > 50 ? (totalUhtKw / (fiq04Pv / 1000.0)).toFixed(2) : '2.85';
    setText('uht-sec-val', secVal);
  }

  // 2. ATANK Data
  if (d.atank) {
    const a = d.atank;
    setText('atank-step-num', `STEP ${a.step_int}`);
    setText('atank-step-name', a.step_desc || 'OFF');
    setText('atank-timer-val', `${a.step_timer}s`);
    setText('atank-sp-val', `${a.step_setpoint}s`);

    const lcVal = a.lc !== undefined && a.lc !== null ? a.lc : 0;
    setText('atank-lc', `${lcVal.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`);
    const lcBar = document.getElementById('atank-lc-bar');
    if (lcBar) {
      const lcPct = Math.min(Math.max((lcVal / 28000) * 100, 0), 100);
      lcBar.style.width = `${lcPct}%`;
    }

    setText('atank-pt', `${a.pt460.toFixed(2)} bar`);
    setText('kpi-atank-pt', `${a.pt460.toFixed(2)} bar`);
    const ptBar = document.getElementById('atank-pt-bar');
    if (ptBar) {
      ptBar.style.width = `${Math.min(Math.max((a.pt460 / 4.0) * 100, 0), 100)}%`;
    }

    setText('atank-tt460', `${a.tt460.toFixed(1)} °C`);
    setText('kpi-sterile-temp', `${a.tt460.toFixed(1)} °C`);
    const tt460Bar = document.getElementById('atank-tt460-bar');
    if (tt460Bar) {
      tt460Bar.style.width = `${Math.min(Math.max((a.tt460 / 150) * 100, 0), 100)}%`;
    }

    setText('atank-tt477', `${a.tt477.toFixed(1)} °C`);
    const tt477Bar = document.getElementById('atank-tt477-bar');
    if (tt477Bar) {
      tt477Bar.style.width = `${Math.min(Math.max((a.tt477 / 150) * 100, 0), 100)}%`;
    }

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

  // 3. CIP CIRCUIT 1 & 2
  if (d.cip_line1) {
    const c1 = d.cip_line1;
    setText('cip1-route', c1.route_desc || (c1.route_int ? `Route ${c1.route_int}` : 'None'));
    setText('cip1-prog', c1.program_desc || (c1.program_int ? `Program ${c1.program_int}` : 'Off'));
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
    setText('cip2-route', c2.route_desc || (c2.route_int ? `Route ${c2.route_int}` : 'None'));
    setText('cip2-prog', c2.program_desc || (c2.program_int ? `Program ${c2.program_int}` : 'Off'));
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
    updateVsdAnalyticsUI(d);
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
  if (c1Status && vf['VSD05']) {
    const v = vf['VSD05'];
    c1Status.textContent = v.running ? `RUNNING (${v.power_kw} kW)` : `STOPPED (0.00 kW)`;
    c1Status.className = v.running ? 'status-run' : 'status-stop';
  }

  const c2Status = document.getElementById('cip2-vsd-status');
  if (c2Status && vf['VSD04']) {
    const v = vf['VSD04'];
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

// =========================================================
// STEP REPORT MODAL LOGIC (OFFICIAL A4 PDF EXPORT)
// =========================================================
window.openStepReportModal = function(section) {
  const modal = document.getElementById('step-report-modal-overlay');
  if (!modal) return;
  
  const secSelect = document.getElementById('step-report-section-select');
  if (secSelect && section) {
    secSelect.value = section;
  }
  
  const pad = (n) => String(n).padStart(2, '0');
  const fromInput = document.getElementById('step-report-from-input');
  const toInput = document.getElementById('step-report-to-input');
  
  if (fromInput && !fromInput.value) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    fromInput.value = `${startOfDay.getFullYear()}-${pad(startOfDay.getMonth() + 1)}-${pad(startOfDay.getDate())}T00:00`;
  }
  if (toInput && !toInput.value) {
    const now = new Date();
    toInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  
  modal.classList.add('active');
};

window.closeStepReportModal = function() {
  const modal = document.getElementById('step-report-modal-overlay');
  if (modal) modal.classList.remove('active');
};

window.openStepReportDocument = function() {
  const sec = document.getElementById('step-report-section-select')?.value || 'uht';
  const fromVal = document.getElementById('step-report-from-input')?.value || '';
  const toVal = document.getElementById('step-report-to-input')?.value || '';
  const batchVal = document.getElementById('step-report-batch-input')?.value.trim() || '';
  
  let url = `http://${window.location.hostname || '127.0.0.1'}:8000/api/v1/process_logs/report?section=${encodeURIComponent(sec)}`;
  if (fromVal) {
    url += `&from_time=${encodeURIComponent(fromVal)}`;
  }
  if (toVal) {
    url += `&to_time=${encodeURIComponent(toVal)}`;
  }
  if (batchVal) {
    url += `&batch_id=${encodeURIComponent(batchVal)}`;
  }
  
  // Open in new tab/window for instant print
  window.open(url, '_blank', 'noopener,noreferrer');
  closeStepReportModal();
};

// =========================================================
// HISTORIAN CUSTOM DATE-TIME RANGE (FROM - TO) LOGIC
// =========================================================
async function loadHistoricalCustomRange(sec, fromTime, toTime, windowVal) {
  const rec = sectionRecorders[sec];
  if (!rec) return;
  if (!rec.chart) initRecorderForSection(sec);
  if (!rec.chart) return;

  const statusTag = document.getElementById(rec.statusId);
  if (statusTag) {
    statusTag.textContent = 'QUERYING INFLUXDB (FROM-TO)...';
    statusTag.style.background = 'rgba(2, 132, 199, 0.25)';
    statusTag.style.color = '#38bdf8';
    statusTag.style.borderColor = 'rgba(56, 189, 248, 0.5)';
  }

  try {
    const host = window.location.hostname || '127.0.0.1';
    let url = `http://${host}:8000/api/v1/telemetry/history?section=${encodeURIComponent(sec)}&from_time=${encodeURIComponent(fromTime)}&to_time=${encodeURIComponent(toTime)}`;
    if (windowVal) {
      url += `&window=${encodeURIComponent(windowVal)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    if (data.status === 'success' && data.timestamps && data.timestamps.length > 0) {
      rec.chart.data.labels = data.timestamps;
      rec.chart.$fullTimestamps = data.full_timestamps || [];
      rec.chart.data.$fullTimestamps = data.full_timestamps || [];
      data.pens.forEach((penData, idx) => {
        if (rec.chart.data.datasets[idx]) {
          rec.chart.data.datasets[idx].data = penData;
        }
      });
      rec.chart.update();
      if (statusTag) {
        const fromDisp = fromTime.replace('T', ' ');
        const toDisp = toTime.replace('T', ' ');
        statusTag.textContent = `HISTORIAN: ${data.count} จุด (${fromDisp} → ${toDisp})`;
        statusTag.style.background = 'rgba(2, 132, 199, 0.2)';
        statusTag.style.color = '#38bdf8';
        statusTag.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      }
    } else {
      if (statusTag) {
        statusTag.textContent = `HISTORIAN: ไม่มีข้อมูลในช่วงเวลาที่เลือก`;
        statusTag.style.background = 'rgba(239, 68, 68, 0.15)';
        statusTag.style.color = '#f87171';
        statusTag.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
    }
  } catch (err) {
    console.error('Failed to load historical custom range:', err);
    if (statusTag) {
      statusTag.textContent = 'QUERY FAILED';
      statusTag.style.background = 'rgba(239, 68, 68, 0.2)';
      statusTag.style.color = '#ef4444';
      statusTag.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    }
  }
}

window.openHistorianRangeModal = function(section) {
  const modal = document.getElementById('historian-range-modal-overlay');
  if (!modal) return;
  
  const secSelect = document.getElementById('hist-section-select');
  if (secSelect && section) {
    secSelect.value = section;
  }
  
  const pad = (n) => String(n).padStart(2, '0');
  const fromInput = document.getElementById('hist-from-input');
  const toInput = document.getElementById('hist-to-input');
  
  if (fromInput && !fromInput.value) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    fromInput.value = `${startOfDay.getFullYear()}-${pad(startOfDay.getMonth() + 1)}-${pad(startOfDay.getDate())}T00:00`;
  }
  if (toInput && !toInput.value) {
    const now = new Date();
    toInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  
  modal.classList.add('active');
};

window.closeHistorianRangeModal = function() {
  const modal = document.getElementById('historian-range-modal-overlay');
  if (modal) modal.classList.remove('active');
};

window.applyHistorianCustomRange = async function() {
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

  const rec = sectionRecorders[sec];
  if (rec) {
    rec.mode = 'history';
    rec.historyRange = 'custom';
    rec.customFrom = fromVal;
    rec.customTo = toVal;
    
    // Highlight the custom range button in the section's control bar
    const container = document.querySelector(`.recorder-card [data-section="${sec}"]`)?.closest('.recorder-card');
    if (container) {
      container.querySelectorAll('.win-btn').forEach(b => b.classList.remove('active'));
      container.querySelector('.btn-custom-range')?.classList.add('active');
    }
  }

  closeHistorianRangeModal();
  await loadHistoricalCustomRange(sec, fromVal, toVal, winVal);
};

window.exportHistorianCsvCustomRange = async function() {
  const sec = document.getElementById('hist-section-select')?.value || 'uht';
  const fromVal = document.getElementById('hist-from-input')?.value;
  const toVal = document.getElementById('hist-to-input')?.value;
  const winVal = document.getElementById('hist-window-select')?.value || '';

  if (!fromVal || !toVal) {
    alert('กรุณาระบุทั้งวัน-เวลาเริ่มต้น (From) และสิ้นสุด (To)');
    return;
  }

  const host = window.location.hostname || '127.0.0.1';
  let url = `http://${host}:8000/api/v1/telemetry/history?section=${encodeURIComponent(sec)}&from_time=${encodeURIComponent(fromVal)}&to_time=${encodeURIComponent(toVal)}`;
  if (winVal) {
    url += `&window=${encodeURIComponent(winVal)}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    if (!data.timestamps || data.timestamps.length === 0) {
      alert('ไม่พบข้อมูลประวัติในช่วงเวลาที่ระบุ');
      return;
    }

    const secTitles = {
      uht: 'UHT_Sterilizer_Process',
      atank: 'Aseptic_Tank_ATANK',
      cip: 'CIP_Systems',
      prod: 'Production_Duplex_Filter'
    };

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${secTitles[sec] || sec}_Custom_${fromVal.replace(/[:T]/g, '')}_to_${toVal.replace(/[:T]/g, '')}.csv`;

    let csv = '\uFEFF';
    csv += `# =========================================================================\n`;
    csv += `# RUNGSAPPATTANA (THAILAND) CO., LTD. - SCADA PROCESS RECORDER REPORT\n`;
    csv += `# UHT SCADA OPERATIONS & INVENTORY COMMAND CENTER • By xDev.CO.LTD\n`;
    csv += `# =========================================================================\n`;
    csv += `# PROCESS UNIT        : ${secTitles[sec] || sec.toUpperCase()}\n`;
    csv += `# FILTER FROM         : ${fromVal.replace('T', ' ')} (Asia/Bangkok +07:00)\n`;
    csv += `# FILTER TO           : ${toVal.replace('T', ' ')} (Asia/Bangkok +07:00)\n`;
    csv += `# EXPORT DATE & TIME  : ${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH')}\n`;
    csv += `# TOTAL DATA POINTS   : ${data.count}\n`;
    csv += `# =========================================================================\n#\n`;

    const labelsList = data.pen_labels || ['Pen 1', 'Pen 2', 'Pen 3', 'Pen 4', 'Pen 5'];
    csv += `Timestamp,` + labelsList.map(l => `"${l}"`).join(',') + '\n';

    const tsList = data.full_timestamps || data.timestamps;
    for (let i = 0; i < tsList.length; i++) {
      const row = [tsList[i]];
      for (let p = 0; p < data.pens.length; p++) {
        const val = data.pens[p][i];
        row.push(val !== undefined && val !== null ? val : '');
      }
      csv += row.join(',') + '\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    console.error('Failed to export custom range CSV:', err);
    alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล CSV');
  }
};

// Global modal background click handler
document.addEventListener('click', (e) => {
  const stepModal = document.getElementById('step-report-modal-overlay');
  if (stepModal && e.target === stepModal) {
    closeStepReportModal();
  }
  const histModal = document.getElementById('historian-range-modal-overlay');
  if (histModal && e.target === histModal) {
    closeHistorianRangeModal();
  }
});


// =========================================================================
// OFFICIAL SCADA TREND EXPORT: DIRECT CSV & AUDIT PDF REPORT (BY xDev.CO.LTD)
// =========================================================================
const MARINE_LOGO_B64 = "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";

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

// =========================================================================
// TREND PDF REPORT & DATA STAMP SETTINGS MODAL & SAMPLING LOGIC
// =========================================================================

function parseTimestampToMs(tsStr) {
  if (!tsStr) return null;
  if (tsStr instanceof Date) return tsStr.getTime();
  if (typeof tsStr === 'number') return tsStr;

  const str = String(tsStr).trim();
  // Format DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Format YYYY-MM-DD HH:mm:ss or ISO
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Format HH:mm:ss
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const now = new Date();
    const hour = parseInt(timeMatch[1], 10);
    const min = parseInt(timeMatch[2], 10);
    const sec = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, sec).getTime();
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function calculateSampleIndices(timestamps, intervalSetting) {
  const total = timestamps.length;
  if (total === 0) return [];

  if (intervalSetting === 'all') {
    const res = [];
    for (let i = 0; i < total; i++) res.push(i);
    return res;
  }

  if (intervalSetting && intervalSetting.startsWith('fixed_')) {
    const targetCount = parseInt(intervalSetting.replace('fixed_', ''), 10) || 25;
    if (total <= targetCount) {
      const res = [];
      for (let i = 0; i < total; i++) res.push(i);
      return res;
    }
    const res = [];
    const step = (total - 1) / (targetCount - 1);
    for (let k = 0; k < targetCount; k++) {
      res.push(Math.round(k * step));
    }
    return res;
  }

  // Time-based interval: step_1m, step_2m, step_5m, step_10m, step_15m, step_30m, step_60m
  let intervalMinutes = 5;
  if (intervalSetting && intervalSetting.startsWith('step_')) {
    intervalMinutes = parseInt(intervalSetting.replace('step_', '').replace('m', ''), 10) || 5;
  }
  const intervalMs = intervalMinutes * 60 * 1000;

  const parsedMs = timestamps.map(ts => parseTimestampToMs(ts));
  const validCount = parsedMs.filter(m => m !== null).length;

  if (validCount >= total * 0.5) {
    const res = [];
    let lastSampledMs = null;
    for (let i = 0; i < total; i++) {
      const curMs = parsedMs[i];
      if (curMs === null) continue;
      if (lastSampledMs === null) {
        res.push(i);
        lastSampledMs = curMs;
      } else if ((curMs - lastSampledMs) >= (intervalMs - 1500)) {
        res.push(i);
        lastSampledMs = curMs;
      }
    }
    if (res.length > 0 && res[res.length - 1] !== total - 1) {
      res.push(total - 1);
    }
    if (res.length > 0) return res;
  }

  // Fallback if timestamps are index/relative
  const step = Math.max(1, Math.round(total / 24));
  const res = [];
  for (let i = 0; i < total; i += step) {
    res.push(i);
  }
  if (res[res.length - 1] !== total - 1) res.push(total - 1);
  return res;
}

window.openTrendPdfModal = function(section, fromTime, toTime) {
  let effectiveSec = section || 'uht';
  if (section === 'cip') {
    const cur = sectionRecorders.cip?.currentCircuit;
    if (cur === 'cip_line1' || cur === 'cip_line2') effectiveSec = cur;
  }

  const modal = document.getElementById('trend-pdf-modal-overlay');
  if (!modal) return;

  const secSelect = document.getElementById('trend-pdf-sec-select');
  if (secSelect) secSelect.value = effectiveSec;

  const radioCurrent = document.querySelector('input[name="trend-pdf-scope-radio"][value="current"]');
  const radioCustom = document.querySelector('input[name="trend-pdf-scope-radio"][value="custom"]');
  const customBox = document.getElementById('trend-pdf-custom-range-box');
  const fromInput = document.getElementById('trend-pdf-from-input');
  const toInput = document.getElementById('trend-pdf-to-input');

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const formatIsoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  if (fromTime && toTime) {
    if (radioCustom) radioCustom.checked = true;
    if (customBox) customBox.style.display = 'flex';
    if (fromInput) fromInput.value = fromTime;
    if (toInput) toInput.value = toTime;
  } else {
    if (radioCurrent) radioCurrent.checked = true;
    if (customBox) customBox.style.display = 'none';
    if (toInput) toInput.value = formatIsoLocal(now);
    const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    if (fromInput) fromInput.value = formatIsoLocal(oneDayAgo);
  }

  const batchInput = document.getElementById('trend-pdf-batch-input');
  if (batchInput) {
    const prefix = effectiveSec.toUpperCase().slice(0, 3);
    const dateCode = now.toISOString().slice(2, 10).replace(/-/g, '');
    batchInput.value = `${prefix}-B${dateCode}-01`;
  }

  updateTrendPdfEstimate();
  modal.classList.add('active');
};

window.closeTrendPdfModal = function() {
  const modal = document.getElementById('trend-pdf-modal-overlay');
  if (modal) modal.classList.remove('active');
};

window.onTrendPdfScopeChange = function() {
  const isCustom = document.querySelector('input[name="trend-pdf-scope-radio"][value="custom"]')?.checked;
  const customBox = document.getElementById('trend-pdf-custom-range-box');
  if (customBox) {
    customBox.style.display = isCustom ? 'flex' : 'none';
  }
  updateTrendPdfEstimate();
};

window.onTrendPdfSectionChange = function() {
  const sec = document.getElementById('trend-pdf-sec-select')?.value || 'uht';
  const now = new Date();
  const prefix = sec.toUpperCase().slice(0, 3);
  const dateCode = now.toISOString().slice(2, 10).replace(/-/g, '');
  const batchInput = document.getElementById('trend-pdf-batch-input');
  if (batchInput) batchInput.value = `${prefix}-B${dateCode}-01`;
  updateTrendPdfEstimate();
};

window.updateTrendPdfEstimate = function() {
  const sec = document.getElementById('trend-pdf-sec-select')?.value || 'uht';
  const interval = document.getElementById('trend-pdf-interval-select')?.value || 'step_5m';
  const isCustom = document.querySelector('input[name="trend-pdf-scope-radio"][value="custom"]')?.checked;

  const rec = (sec === 'cip_line1' || sec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[sec];
  const chartTs = rec?.chart?.data?.$fullTimestamps || rec?.chart?.$fullTimestamps || rec?.chart?.data?.labels || [];
  const sourceCount = chartTs.length || (rec?.history?.times?.length || 0);

  const srcPtsEl = document.getElementById('trend-pdf-est-source-points');
  const tgtRowsEl = document.getElementById('trend-pdf-est-target-rows');
  const hintEl = document.getElementById('trend-pdf-est-hint');

  if (srcPtsEl) {
    srcPtsEl.textContent = isCustom ? 'จะดึงใหม่จาก InfluxDB ตามช่วงเวลา' : `${sourceCount} จุด`;
  }

  let estRows = 24;
  const labelMap = {
    step_1m: 'ทุก 1 นาที',
    step_2m: 'ทุก 2 นาที',
    step_5m: 'ทุก 5 นาที',
    step_10m: 'ทุก 10 นาที',
    step_15m: 'ทุก 15 นาที',
    step_30m: 'ทุก 30 นาที',
    step_60m: 'ทุก 1 ชั่วโมง',
    fixed_15: 'เฉลี่ย 15 แถว',
    fixed_25: 'เฉลี่ย 25 แถว',
    fixed_50: 'เฉลี่ย 50 แถว',
    fixed_100: 'เฉลี่ย 100 แถว',
    all: 'ทุกจุดข้อมูลทั้งหมด'
  };
  const intervalLabel = labelMap[interval] || interval;

  if (interval === 'all') {
    estRows = sourceCount || 720;
  } else if (interval.startsWith('fixed_')) {
    estRows = parseInt(interval.replace('fixed_', ''), 10) || 25;
  } else if (chartTs.length > 1) {
    const indices = calculateSampleIndices(chartTs, interval);
    estRows = indices.length;
  }

  if (tgtRowsEl) {
    tgtRowsEl.textContent = `~${estRows} แถว (${intervalLabel})`;
  }
  if (hintEl) {
    hintEl.textContent = `ระบบจะดึงเฉพาะ Record ที่ตรงตาม Interval เวลา (${intervalLabel}) เพื่อลงตาราง Audit Trail ในรายงาน PDF`;
  }
};

window.executeConfiguredTrendPdf = async function() {
  const sec = document.getElementById('trend-pdf-sec-select')?.value || 'uht';
  const isCustom = document.querySelector('input[name="trend-pdf-scope-radio"][value="custom"]')?.checked;
  const fromVal = document.getElementById('trend-pdf-from-input')?.value;
  const toVal = document.getElementById('trend-pdf-to-input')?.value;
  const interval = document.getElementById('trend-pdf-interval-select')?.value || 'step_5m';
  const batchNo = document.getElementById('trend-pdf-batch-input')?.value || '';
  const operatorNote = document.getElementById('trend-pdf-operator-input')?.value || '';

  const includeChart = document.getElementById('trend-pdf-opt-chart')?.checked !== false;
  const includeStats = document.getElementById('trend-pdf-opt-stats')?.checked !== false;
  const includeTable = document.getElementById('trend-pdf-opt-table')?.checked !== false;
  const includeSign = document.getElementById('trend-pdf-opt-sign')?.checked !== false;

  const btnConfirm = document.getElementById('btn-trend-pdf-confirm');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = '⏳ กำลังเตรียมรายงาน...';
  }

  try {
    if (isCustom) {
      if (!fromVal || !toVal) {
        alert('กรุณาระบุทั้งวัน-เวลาเริ่มต้น (From) และสิ้นสุด (To)');
        if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = '🖨️ สร้างรายงาน PDF ทันที'; }
        return;
      }
      if (new Date(fromVal) > new Date(toVal)) {
        alert('วัน-เวลาเริ่มต้น (From) ต้องมาก่อนวัน-เวลาสิ้นสุด (To)');
        if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = '🖨️ สร้างรายงาน PDF ทันที'; }
        return;
      }
      await loadHistoricalCustomRange(sec, fromVal, toVal, '');
    }

    generateTrendPdfDocument(sec, {
      interval,
      batchNo,
      operatorNote,
      includeChart,
      includeStats,
      includeTable,
      includeSign,
      scope: isCustom ? 'custom' : 'current'
    });

    closeTrendPdfModal();
  } catch (err) {
    console.error('Error generating configured trend PDF:', err);
    alert('เกิดข้อผิดพลาดในการสร้างรายงาน PDF: ' + err.message);
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '🖨️ สร้างรายงาน PDF ทันที';
    }
  }
};

window.executeConfiguredTrendCsv = async function() {
  const sec = document.getElementById('trend-pdf-sec-select')?.value || 'uht';
  const isCustom = document.querySelector('input[name="trend-pdf-scope-radio"][value="custom"]')?.checked;
  const fromVal = document.getElementById('trend-pdf-from-input')?.value;
  const toVal = document.getElementById('trend-pdf-to-input')?.value;
  const interval = document.getElementById('trend-pdf-interval-select')?.value || 'step_5m';

  if (isCustom) {
    if (!fromVal || !toVal) {
      alert('กรุณาระบุทั้งวัน-เวลาเริ่มต้น (From) และสิ้นสุด (To)');
      return;
    }
    await loadHistoricalCustomRange(sec, fromVal, toVal, '');
  }

  const effectiveSec = (sec === 'cip_line1' || sec === 'cip_line2') ? sec : sec;
  const rec = (sec === 'cip_line1' || sec === 'cip_line2') ? sectionRecorders.cip : sectionRecorders[sec];
  if (!rec || !rec.chart) {
    alert('ไม่พบข้อมูลกราฟสำหรับหมวดนี้');
    return;
  }

  const timestamps = rec.chart.data.$fullTimestamps || rec.chart.$fullTimestamps || rec.chart.data.labels || [];
  if (timestamps.length === 0) {
    alert('ไม่มีข้อมูลสำหรับส่งออก CSV');
    return;
  }

  const sampleIndices = calculateSampleIndices(timestamps, interval);
  const datasets = rec.chart.data.datasets || [];
  const confList = PEN_ALARM_LIMITS[effectiveSec] || [];

  const headers = ['#', 'Date_Time_Bangkok_0700'];
  datasets.forEach((ds, idx) => {
    const conf = confList[idx];
    const tag = conf?.tag || ds.label;
    const unit = conf?.unit ? `_${conf.unit}` : '';
    headers.push(`"${tag}${unit}"`);
  });

  const rows = [
    `# RUNGSAPPATTANA (THAILAND) CO. LTD. - SCADA TREND STAMP DATA EXPORT`,
    `# Process: ${sec.toUpperCase()} • Interval Setting: ${interval} • Attribution: By xDev.CO.LTD`,
    headers.join(',')
  ];

  sampleIndices.forEach((rowIdx, seq) => {
    const ts = timestamps[rowIdx] || '';
    const r = [seq + 1, `"${ts}"`];
    for (let p = 0; p < datasets.length; p++) {
      const val = datasets[p].data ? datasets[p].data[rowIdx] : null;
      if (val !== null && val !== undefined && !isNaN(val)) {
        r.push(Number(val).toFixed(2));
      } else {
        r.push('');
      }
    }
    rows.push(r.join(','));
  });

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fileDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const filename = `RUNGSAPPATTANA_${sec.toUpperCase()}_STAMP_DATA_${interval}_${fileDate}.csv`;

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.exportTrendPdfReport = function(section) {
  openTrendPdfModal(section);
};

window.exportHistorianPdfCustomRange = function() {
  const sec = document.getElementById('hist-section-select')?.value || 'uht';
  const fromVal = document.getElementById('hist-from-input')?.value;
  const toVal = document.getElementById('hist-to-input')?.value;
  closeHistorianRangeModal();
  openTrendPdfModal(sec, fromVal, toVal);
};

window.generateTrendPdfDocument = function(section, options) {
  const opts = options || {};
  const intervalSetting = opts.interval || 'step_5m';
  const includeChart = opts.includeChart !== false;
  const includeStats = opts.includeStats !== false;
  const includeTable = opts.includeTable !== false;
  const includeSign = opts.includeSign !== false;

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

  const labelMap = {
    step_1m: 'ทุก 1 นาที (Every 1 Min)',
    step_2m: 'ทุก 2 นาที (Every 2 Mins)',
    step_5m: 'ทุก 5 นาที (Every 5 Mins)',
    step_10m: 'ทุก 10 นาที (Every 10 Mins)',
    step_15m: 'ทุก 15 นาที (Every 15 Mins)',
    step_30m: 'ทุก 30 นาที (Every 30 Mins)',
    step_60m: 'ทุก 1 ชั่วโมง (Every 1 Hour)',
    fixed_15: 'สุ่มเฉลี่ย 15 แถว (Fixed 15 Rows)',
    fixed_25: 'สุ่มเฉลี่ย 25 แถว (Fixed 25 Rows)',
    fixed_50: 'สุ่มเฉลี่ย 50 แถว (Fixed 50 Rows)',
    fixed_100: 'สุ่มเฉลี่ย 100 แถว (Fixed 100 Rows)',
    all: 'บันทึกทุกจุดข้อมูลทั้งหมด (All Logged Points)'
  };
  const intervalDesc = labelMap[intervalSetting] || intervalSetting;

  const secMeta = {
    uht: {
      name: 'UHT STERILIZATION UNIT [DB1200]',
      desc: 'Continuous High-Temperature Short-Time Sterilization Process Trend Report',
      batch: opts.batchNo || ('UHT-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    },
    atank: {
      name: 'ASEPTIC TANK STORAGE SYSTEM [DB1301]',
      desc: 'Aseptic Air Barrier & Sterile Storage Integrity Process Trend Report',
      batch: opts.batchNo || ('ATK-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    },
    cip: {
      name: 'CIP DUAL-LINE CHEMICAL & THERMAL RECORDER',
      desc: 'Clean-In-Place Dual Circuit Conductivity & Thermal Trend Report',
      batch: opts.batchNo || ('CIP-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    },
    cip_line1: {
      name: 'CIP CIRCUIT 1 [DB1801] (FILLER MACHINE)',
      desc: 'Clean-In-Place Circuit 1 Conductivity & Thermal Trend Report',
      batch: opts.batchNo || ('CIP1-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    },
    cip_line2: {
      name: 'CIP CIRCUIT 2 [DB1802] (ASEPTIC TANK)',
      desc: 'Clean-In-Place Circuit 2 Conductivity & Thermal Trend Report',
      batch: opts.batchNo || ('CIP2-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    },
    prod: {
      name: 'SUPPLY & DUPLEX FILTRATION SYSTEM',
      desc: 'Pressure & Filtration Differential Integrity Trend Report',
      batch: opts.batchNo || ('PRD-B' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
    }
  };

  const meta = secMeta[effectiveSec] || {
    name: effectiveSec.toUpperCase(),
    desc: 'SCADA Telemetry Process Trend Report',
    batch: opts.batchNo || ('BAT-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-01')
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

  const sampleIndices = calculateSampleIndices(timestamps, intervalSetting);

  const sampleHeaders = ['#', 'วัน-เวลา (Date-Time +07:00)'];
  datasets.forEach((ds, idx) => {
    const conf = confList[idx];
    sampleHeaders.push(conf?.tag ? (conf.tag + ' (' + conf.unit + ')') : ds.label);
  });

  const sampleRowsHtml = sampleIndices.map((rowIdx, num) => {
    const bg = num % 2 === 0 ? '#ffffff' : '#f8fafc';
    const ts = timestamps[rowIdx] || '';
    const cols = ['<td style="text-align:center; font-family:monospace; color:#64748b;">' + (num + 1) + '</td>', '<td style="text-align:center; font-family:monospace; font-weight:600; color:#0f172a;">' + ts + '</td>'];
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

  const noteBlock = opts.operatorNote ? `<tr><td class="field-lbl">Operator Note :</td><td colspan="3" class="field-val" style="color:#0f172a; font-weight:600;">${opts.operatorNote}</td></tr>` : '';

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
        <td style="width:315px; vertical-align:top; padding:4px 6px;">
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
              <td class="field-lbl">Stamp Setting :</td>
              <td class="field-val" style="color:#0d9488;">${intervalDesc}</td>
              <td class="field-lbl">Audit Points :</td>
              <td class="field-val" style="color:#ea580c; font-weight:800;">${sampleIndices.length} / ${totalPoints}</td>
            </tr>
            ${noteBlock}
          </table>
        </td>
      </tr>
    </table>
  </div>

  ${includeChart ? `
  <!-- CHART IMAGE BOX -->
  <div class="chart-box">
    <img src="${chartImgUri}" class="chart-img" alt="Process Historian Trend Curve">
  </div>
  ` : ''}

  ${includeStats ? `
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
  ` : ''}

  ${includeTable ? `
  <!-- KEY SAMPLE DATA POINTS TABLE -->
  <div class="section-title-bar" style="margin-top:6px;">
    <div>⏱️ KEY AUDIT SAMPLES TIMELINE (ตัวอย่างข้อมูลบันทึกประวัติกระบวนการ)</div>
    <div style="font-size:7pt; color:#64748b; font-weight:600;">SETTING: ${intervalDesc} • PULLED ${sampleIndices.length} OF ${totalPoints} LOGGED POINTS</div>
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
  ` : ''}

  ${includeSign ? `
  <!-- SIGN-OFF FOOTER -->
  <table class="sign-table" style="margin-top:8px;">
    <tr>
      <td class="sign-box" style="width:33.3%;">
        <div>________________________________________</div>
        <div style="font-weight:700; color:#1e293b; margin-top:2px;">ผู้บันทึกข้อมูล (SCADA Operator)</div>
        <div style="font-size:6.5pt; color:#475569;">${opts.operatorNote ? opts.operatorNote : 'SCADA Operations Team'}</div>
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
  ` : ''}

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


// =========================================================================
// FEATURE 2, 4, 5: VSD ENERGY ANALYTICS, PREVENTIVE MAINTENANCE & FAULT PARETO
// =========================================================================
let vsdEnergyChart = null;
let vsdParetoChart = null;
let lastVsdAnalyticsFetch = 0;

function updateVsdAnalyticsUI(telemetryData) {
  const host = window.location.hostname || '127.0.0.1';
  const now = Date.now();
  
  // 1. If vsd_analytics is embedded in live telemetry cache, use it immediately!
  if (telemetryData && telemetryData.vsd_analytics) {
    renderVsdEnergyUI(telemetryData.vsd_analytics.energy_analytics, telemetryData.vsd_fleet);
    renderVsdMaintenanceUI(telemetryData.vsd_analytics.preventive_maintenance);
    renderVsdParetoUI(telemetryData.vsd_analytics.fault_pareto);
    return;
  }

  // 2. Fallback: fetch from REST API every 5 seconds
  if (now - lastVsdAnalyticsFetch > 5000) {
    lastVsdAnalyticsFetch = now;
    
    // Fetch Energy
    fetch(`http://${host}:8000/api/v1/vsd/energy`)
      .then(res => res.json())
      .then(data => renderVsdEnergyUI(data, telemetryData.vsd_fleet))
      .catch(e => console.warn('VSD energy fetch err:', e));

    // Fetch Maintenance
    fetch(`http://${host}:8000/api/v1/vsd/maintenance`)
      .then(res => res.json())
      .then(data => renderVsdMaintenanceUI(data))
      .catch(e => console.warn('VSD maint fetch err:', e));

    // Fetch Pareto
    fetch(`http://${host}:8000/api/v1/vsd/fault_pareto`)
      .then(res => res.json())
      .then(data => renderVsdParetoUI(data))
      .catch(e => console.warn('VSD pareto fetch err:', e));
  }
}

// -------------------------------------------------------------------------
// 2. VSD ENERGY & POWER ANALYTICS
// -------------------------------------------------------------------------
function renderVsdEnergyUI(energyData, vf) {
  if (!energyData) return;

  const totalKw = (vf) ? Object.values(vf).reduce((sum, v) => sum + (v.power_kw || 0), 0) : 0;
  setText('vsd-energy-live-kw', `${totalKw.toFixed(1)} kW`);
  setText('vsd-energy-daily-kwh', `${(energyData.total_daily_kwh || 0).toFixed(2)} kWh`);
  setText('vsd-energy-daily-thb', `${(energyData.total_cost_thb || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`);
  setText('vsd-energy-cost-per-liter', `${(energyData.cost_per_liter_thb || 0.007).toFixed(4)} ฿/L`);

  // Render or Update Energy Breakdown Bar Chart
  const ctx = document.getElementById('chartVsdEnergy');
  if (!ctx) return;

  const items = energyData.by_vsd || [];
  const labels = items.map(i => `${i.tag} (${i.name.split(' ')[0]})`);
  const kwhVals = items.map(i => i.daily_kwh || i.energy_kwh || 0);
  const costVals = items.map(i => i.daily_cost_thb || i.cost_thb || 0);

  if (vsdEnergyChart) {
    vsdEnergyChart.data.labels = labels;
    vsdEnergyChart.data.datasets[0].data = kwhVals;
    vsdEnergyChart.data.datasets[1].data = costVals;
    vsdEnergyChart.update('none');
  } else {
    vsdEnergyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'พลังงานสะสม (kWh)',
            data: kwhVals,
            backgroundColor: 'rgba(245, 158, 11, 0.75)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: 'ค่าไฟฟ้าสะสม (บาท)',
            data: costVals,
            backgroundColor: 'rgba(6, 182, 212, 0.75)',
            borderColor: '#06b6d4',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'Outfit, Sarabun' } } },
          tooltip: {
            callbacks: {
              afterBody: function(context) {
                return `อัตราค่าไฟ: 4.20 บาท/หน่วย (TOU PEA)`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'หน่วยไฟฟ้า (kWh)', color: '#f59e0b' },
            ticks: { color: '#f59e0b' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'ค่าไฟฟ้า (บาท)', color: '#06b6d4' },
            ticks: { color: '#06b6d4' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
}

// -------------------------------------------------------------------------
// 4. PREVENTIVE MAINTENANCE & RUNNING HOURS
// -------------------------------------------------------------------------
function renderVsdMaintenanceUI(maintData) {
  if (!maintData) return;

  const healthText = document.getElementById('vsd-overall-health-text');
  if (healthText) {
    const avg = maintData.overall_fleet_health_pct || 99.5;
    healthText.textContent = `${avg.toFixed(1)}%`;
    healthText.style.color = (avg >= 90) ? '#34d399' : (avg >= 75 ? '#fbbf24' : '#f87171');
  }

  const tbody = document.getElementById('vsd-pm-rows');
  if (!tbody || !maintData.fleet) return;

  tbody.innerHTML = maintData.fleet.map(f => {
    const health = f.health_pct || 100;
    const barClass = (health >= 85) ? 'good' : (health >= 60 ? 'warn' : 'danger');
    const statusClass = (f.status === 'GOOD') ? 'good' : (f.status === 'DUE_SOON' ? 'warn' : 'danger');
    const statusLabel = (f.status === 'GOOD') ? 'ปกติ (GOOD)' : (f.status === 'DUE_SOON' ? 'ใกล้ครบกำหนด' : 'เกินกำหนด PM!');

    return `
      <tr>
        <td><strong class="highlight-cyan font-mono">${f.tag}</strong></td>
        <td><strong>${f.name}</strong></td>
        <td><span class="tag-sub">${f.section}</span></td>
        <td class="font-mono">${f.rated_kw} kW</td>
        <td class="font-mono highlight-gold"><strong>${(f.total_running_hours || 0).toFixed(1)} ชม.</strong></td>
        <td>
          <div class="pm-health-cell">
            <div class="pm-health-bar-wrap">
              <div class="pm-health-bar-fill ${barClass}" style="width: ${health}%;"></div>
            </div>
            <span class="font-mono" style="font-size:11px;font-weight:700;">${health.toFixed(1)}%</span>
          </div>
        </td>
        <td class="font-mono highlight-green">${(f.hours_remaining || 0).toFixed(1)} ชม.</td>
        <td style="font-size:12px;color:#cbd5e1;">${f.pm_task || 'Level 2: Grease Motor Bearings'}</td>
        <td><span class="pm-status-pill ${statusClass}">${statusLabel}</span></td>
        <td>
          <button class="pm-reset-btn" onclick="resetVsdPm('${f.tag}')" title="กดเมื่อช่างซ่อมบำรุงตรวจเช็คหรืออัดจารบีเสร็จแล้ว">
            🛠️ รีเซ็ต PM
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.resetVsdPm = async function(vsdTag) {
  if (!confirm(`ยืนยันการบันทึกงานซ่อมบำรุง (PM Complete) สำหรับมอเตอร์ ${vsdTag} หรือไม่?\n\nระบบจะบันทึกชั่วโมงปัจจุบันเป็นจุดเริ่มต้นรอบใหม่ และรีเซ็ตดัชนีสุขภาพเป็น 100% ทันที`)) {
    return;
  }
  const host = window.location.hostname || '127.0.0.1';
  try {
    const res = await fetch(`http://${host}:8000/api/v1/vsd/maintenance/reset?vsd_tag=${vsdTag}`, { method: 'POST' });
    const json = await res.json();
    if (json.status === 'success') {
      alert(`✅ บันทึกงานซ่อมบำรุง ${vsdTag} สำเร็จ!\nรอบ PM ถัดไปที่: ${json.next_pm_due_hours} ชม.`);
      // Force refresh maintenance UI
      const maintRes = await fetch(`http://${host}:8000/api/v1/vsd/maintenance`);
      const maintData = await maintRes.json();
      renderVsdMaintenanceUI(maintData);
    } else {
      alert('เกิดข้อผิดพลาด: ' + (json.message || 'ไม่สามารถรีเซ็ตได้'));
    }
  } catch (err) {
    alert('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: ' + err.message);
  }
};

// -------------------------------------------------------------------------
// 5. VSD FAULT & DOWNTIME PARETO ANALYSIS
// -------------------------------------------------------------------------
function renderVsdParetoUI(paretoData) {
  if (!paretoData) return;

  setText('vsd-pareto-total-trips', `${paretoData.total_trip_events || 0} ครั้ง`);
  setText('vsd-pareto-total-mins', `${(paretoData.total_downtime_minutes || 0).toFixed(1)} นาที`);

  const items = paretoData.pareto_items || [];
  if (items.length > 0) {
    const top = items[0];
    setText('vsd-pareto-top-culprit', `${top.tag} (${top.pct_of_total_downtime}%)`);
  } else {
    setText('vsd-pareto-top-culprit', 'ไม่มีทริป (0%)');
  }

  // Populate Pareto Incident Table
  const tbody = document.getElementById('vsd-pareto-rows');
  if (tbody) {
    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:16px;">ยังไม่มีประวัติ VSD ทริป (ระบบทำงานสมบูรณ์ 100%)</td></tr>`;
    } else {
      tbody.innerHTML = items.map(item => `
        <tr>
          <td><strong class="highlight-cyan font-mono">${item.tag}</strong></td>
          <td>${item.name}</td>
          <td class="font-mono highlight-gold"><strong>${item.downtime_minutes} นาที</strong> (${item.trip_count} ครั้ง)</td>
          <td class="font-mono highlight-red">${item.pct_of_total_downtime}%</td>
          <td class="font-mono highlight-green"><strong>${item.cumulative_pct}%</strong></td>
        </tr>
      `).join('');
    }
  }

  // Render Dual-Axis Pareto Chart
  const ctx = document.getElementById('chartVsdPareto');
  if (!ctx || items.length === 0) return;

  const labels = items.map(i => `${i.tag}`);
  const downtimeMins = items.map(i => i.downtime_minutes);
  const cumPcts = items.map(i => i.cumulative_pct);

  if (vsdParetoChart) {
    vsdParetoChart.data.labels = labels;
    vsdParetoChart.data.datasets[0].data = downtimeMins;
    vsdParetoChart.data.datasets[1].data = cumPcts;
    vsdParetoChart.update('none');
  } else {
    vsdParetoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'bar',
            label: 'เวลาเครื่องหยุด (นาที)',
            data: downtimeMins,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'สัดส่วนสะสม (Cumulative %)',
            data: cumPcts,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderWidth: 3,
            pointBackgroundColor: '#10b981',
            pointRadius: 5,
            fill: false,
            tension: 0.2,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#cbd5e1', font: { family: 'Outfit, Sarabun' } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'เวลา Downtime (นาที)', color: '#ef4444' },
            ticks: { color: '#ef4444' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            min: 0,
            max: 100,
            title: { display: true, text: 'สะสม (%)', color: '#10b981' },
            ticks: { color: '#10b981', callback: val => `${val}%` },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }
}

window.refreshVsdPareto = async function() {
  const host = window.location.hostname || '127.0.0.1';
  try {
    const paretoRes = await fetch(`http://${host}:8000/api/v1/vsd/fault_pareto`);
    const paretoData = await paretoRes.json();
    renderVsdParetoUI(paretoData);
  } catch (err) {
    console.warn('Failed to refresh Pareto data:', err);
  }
};



