// ==========================================================================
// MITR PHOL / TH-PACK PROCESS COCKPIT & DAILY AUDIT REPORT
// Real-Time Thermal Alerting & Official Quality Verification
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Digital Clock
  const clockElement = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (clockElement) clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // 2. Tab Navigation (Live Cockpit vs Daily Audit Report)
  const tabLive = document.getElementById('tab-btn-live');
  const tabReport = document.getElementById('tab-btn-report');
  const viewLive = document.getElementById('view-live');
  const viewReport = document.getElementById('view-report');
  const btnPrint = document.getElementById('btn-print-report');

  if (tabLive && tabReport && viewLive && viewReport) {
    tabLive.addEventListener('click', () => {
      tabLive.classList.add('active');
      tabReport.classList.remove('active');
      viewLive.style.display = 'block';
      viewReport.classList.remove('active-view');
      viewReport.style.display = 'none';
    });

    tabReport.addEventListener('click', () => {
      tabReport.classList.add('active');
      tabLive.classList.remove('active');
      viewLive.style.display = 'none';
      viewReport.classList.add('active-view');
      viewReport.style.display = 'block';
    });
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  // 3. Circular OEE Gauge
  const gaugeCircle = document.getElementById('gauge-circle');
  const circumference = 2 * Math.PI * 45; // 282.74
  if (gaugeCircle) gaugeCircle.style.strokeDasharray = `${circumference}`;

  function setGaugeValue(percent) {
    if (!gaugeCircle) return;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = circumference - (clamped / 100) * circumference;
    gaugeCircle.style.strokeDashoffset = offset;
  }
  setGaugeValue(85.3);

  // 4. Element Mappings
  const elOee = document.getElementById('val-oee');
  const elAvail = document.getElementById('val-avail');
  const elPerf = document.getElementById('val-perf');
  const elQual = document.getElementById('val-qual');
  const elActualVolume = document.getElementById('val-actual-volume');
  const elCompletionPct = document.getElementById('val-completion-pct');
  const elVolumeBar = document.getElementById('val-volume-bar');
  const elGoodLiters = document.getElementById('val-good-liters');
  const elLossLiters = document.getElementById('val-loss-liters');
  const elFlow = document.getElementById('val-flow');
  
  const elLiveTic49 = document.getElementById('live-tic49');
  const elLiveTic50 = document.getElementById('live-tic50');
  const elLiveTic63 = document.getElementById('live-tic63');
  const elCipTemp = document.getElementById('cip-live-temp');
  const elCipPump = document.getElementById('cip-pump-state');
  const elTblTic49 = document.getElementById('tbl-tic49');
  const elTblTic63 = document.getElementById('tbl-tic63');
  const alertBanner = document.getElementById('thermal-alert-banner');
  const alertBannerText = document.getElementById('alert-banner-text');
  const elPlcStatusPill = document.getElementById('plc-status-pill');
  const elPlcStatusText = document.getElementById('plc-status-text');

  // 5. Fetch Executive Summary from API
  async function fetchExecutiveSummary() {
    try {
      const apiUrl = window.location.port === '3000' 
        ? 'http://localhost:8000/api/v1/executive/summary' 
        : '/api/v1/executive/summary';
      
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      if (data.oee_metrics) {
        if (elOee) elOee.textContent = data.oee_metrics.overall_oee.toFixed(1);
        setGaugeValue(data.oee_metrics.overall_oee);
        if (elAvail) elAvail.textContent = `${data.oee_metrics.availability.toFixed(1)}%`;
        if (elPerf) elPerf.textContent = `${data.oee_metrics.performance.toFixed(1)}%`;
        if (elQual) elQual.textContent = `${data.oee_metrics.quality.toFixed(1)}%`;
      }

      if (data.process_throughput) {
        if (elActualVolume) {
          elActualVolume.innerHTML = `${data.process_throughput.actual_processed_liters.toLocaleString()} <span style="font-size: 1.1rem; color: var(--text-secondary); font-weight: 500;">Liters</span>`;
        }
        if (elCompletionPct) elCompletionPct.textContent = `${data.process_throughput.completion_pct.toFixed(1)}%`;
        if (elVolumeBar) elVolumeBar.style.width = `${data.process_throughput.completion_pct}%`;
        if (elGoodLiters) elGoodLiters.textContent = `${data.process_throughput.good_product_liters.toLocaleString()} L`;
        if (elLossLiters) {
          elLossLiters.textContent = `${data.process_throughput.process_loss_liters.toLocaleString()} L (${data.process_throughput.loss_pct}%)`;
        }
        if (elFlow) {
          elFlow.innerHTML = `${data.process_throughput.actual_flow_lph.toLocaleString()} <span style="font-size: 1.1rem; color: var(--text-secondary); font-weight: 500;">L/h</span>`;
        }
      }

      if (data.plc_status && elPlcStatusPill && elPlcStatusText) {
        if (data.plc_status.connected) {
          elPlcStatusPill.className = 'plc-status-pill';
          elPlcStatusText.textContent = `S7-1500 (${data.plc_status.ip}) • DB${data.plc_status.monitored_db} CONNECTED`;
        } else {
          elPlcStatusPill.className = 'plc-status-pill offline';
          elPlcStatusText.textContent = `S7-1500 (${data.plc_status.ip}) • SIMULATED / OFFLINE`;
        }
      }
    } catch (err) {
      console.warn("Could not fetch summary:", err);
    }
  }

  fetchExecutiveSummary();
  setInterval(fetchExecutiveSummary, 5000);

  // 6. Connect WebSocket for Real-Time Telemetry
  function connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.port === '3000' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/telemetry`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket Telemetry Stream Connected!");
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'telemetry_update' && Array.isArray(msg.data)) {
          handleTelemetryReadings(msg.data);
        }
      } catch (e) {
        console.error("WS Parse error", e);
      }
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 4000);
    };
  }

  function handleTelemetryReadings(readings) {
    readings.forEach(item => {
      const tag = item.tag_name;
      const val = item.scaled_value;

      if (tag === 'TIC49_pv' || tag === 'TIC49_sp') {
        if (elLiveTic49) elLiveTic49.textContent = val.toFixed(1);
        if (elCipTemp) elCipTemp.textContent = val.toFixed(1);
        if (elTblTic49) elTblTic49.textContent = `${val.toFixed(1)} °C`;

        // Thermal Compliance Deviation Alert Check (Holding tube must stay >= 137.0°C)
        if (val < 137.0 && alertBanner && alertBannerText) {
          alertBanner.className = 'thermal-alert-banner deviation';
          alertBannerText.innerHTML = `🚨 <strong>แจ้งเตือนอุณหภูมิวูบ (DEVIATION)!</strong> TIC49 ลดลงเหลือ ${val.toFixed(1)}°C (ต่ำกว่า 137°C) • วาล์วสับนม Divert กลับถัง Balance Tank ทันที!`;
        } else if (alertBanner && alertBannerText) {
          alertBanner.className = 'thermal-alert-banner';
          alertBannerText.textContent = 'จุดวิกฤตอุณหภูมิและความดันปลอดเชื้อทั้งหมดอยู่ในเกณฑ์มาตรฐานความปลอดภัย (Safe Band) • ไม่พบอุณหภูมิวูบ/Divert';
        }
      }

      if (tag === 'TIC50_sp' || tag === 'TIC50_pv') {
        if (elLiveTic50) elLiveTic50.textContent = val.toFixed(1);
      }

      if (tag === 'TIC63_pv') {
        if (elLiveTic63) elLiveTic63.textContent = val.toFixed(1);
        if (elTblTic63) elTblTic63.textContent = `${val.toFixed(1)} °C`;
      }

      if (tag === 'SX10') {
        if (elCipPump) elCipPump.innerHTML = `${val.toFixed(2)} <span class="cip-metric-unit">Hz / ON</span>`;
      }
    });
  }

  connectWebSocket();

  // 7. OT Tag Linkage Tool Modal Handling
  const modal = document.getElementById('ot-modal');
  const btnOpenModal = document.getElementById('btn-open-ot-modal');
  const btnCloseModal = document.getElementById('btn-close-ot-modal');
  const tagForm = document.getElementById('tag-test-form');
  const resultBox = document.getElementById('test-result-box');
  const dbTagsBody = document.getElementById('db-tags-list-body');

  if (btnOpenModal && modal) {
    btnOpenModal.addEventListener('click', () => {
      modal.classList.add('open');
      loadDbTagsList();
    });
  }

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  let tagsLoaded = false;
  async function loadDbTagsList() {
    if (tagsLoaded || !dbTagsBody) return;
    try {
      const apiUrl = window.location.port === '3000' 
        ? 'http://localhost:8000/api/v1/plc/datablocks' 
        : '/api/v1/plc/datablocks';
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error("API error");
      const tags = await res.json();
      
      if (tags && tags.length > 0) {
        dbTagsBody.innerHTML = tags.map(t => `
          <tr>
            <td><strong>${t.tag_name}</strong></td>
            <td><code>DB${t.db_number}.${t.plc_data_format === 'BOOL' ? 'DBX' : (t.plc_data_format === 'INT' ? 'DBW' : 'DBD')}${t.byte_offset}</code></td>
            <td><span class="status-chip-sm chip-normal">${t.plc_data_format}</span></td>
            <td>${t.description || '-'}</td>
          </tr>
        `).join('');
        tagsLoaded = true;
      }
    } catch (e) {
      if (dbTagsBody) {
        dbTagsBody.innerHTML = `<tr><td colspan="4" style="color: var(--accent-rose); text-align: center;">ไม่สามารถโหลดรายการ Tags ได้: ${e.message}</td></tr>`;
      }
    }
  }

  if (tagForm) {
    tagForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const db = document.getElementById('input-db').value;
      const offset = document.getElementById('input-offset').value;
      const bit = document.getElementById('input-bit').value;
      const format = document.getElementById('input-format').value;

      if (resultBox) {
        resultBox.className = 'test-result-box show';
        resultBox.innerHTML = '<span style="color: var(--accent-cyan);">กำลังส่งคำสั่งอ่านค่าไปยัง Siemens S7-1500...</span>';
      }

      try {
        const apiUrl = window.location.port === '3000' 
          ? `http://localhost:8000/api/v1/plc/read-tag?db=${db}&offset=${offset}&bit=${bit}&format=${format}` 
          : `/api/v1/plc/read-tag?db=${db}&offset=${offset}&bit=${bit}&format=${format}`;
        
        const startTime = performance.now();
        const res = await fetch(apiUrl);
        const data = await res.json();
        const latency = (performance.now() - startTime).toFixed(1);

        if (resultBox) {
          resultBox.innerHTML = `
            <div style="margin-bottom: 0.35rem; color: ${data.quality === 'GOOD' ? 'var(--accent-emerald)' : 'var(--accent-rose)'}; font-weight: bold;">
              ${data.quality === 'GOOD' ? '✓ READ SUCCESS (คุณภาพข้อมูล: GOOD)' : '⚠️ READ NOTICE (คุณภาพข้อมูล: BAD)'} • Latency: ${latency} ms
            </div>
            <div>Target: <strong>DB${data.db_number} OFFSET ${data.byte_offset}</strong> (Format: ${data.plc_format})</div>
            <div>Raw Hex: <code>${data.raw_hex || 'N/A'}</code></div>
            <div style="font-size: 1rem; margin-top: 0.25rem;">Parsed Value: <strong style="color: var(--accent-cyan);">${data.value !== null ? data.value : 'N/A'}</strong></div>
            ${data.error ? `<div style="color: var(--accent-rose); margin-top: 0.25rem;">Note: ${data.error}</div>` : ''}
          `;
        }
      } catch (err) {
        if (resultBox) {
          resultBox.innerHTML = `<span style="color: var(--accent-rose);">เกิดข้อผิดพลาดในการเรียก API: ${err.message}</span>`;
        }
      }
    });
  }
});
