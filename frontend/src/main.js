// ==========================================
// TH-Pack Dashboard Application Logic
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Live Clock Counter
  const clockElement = document.getElementById('clock');
  
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
  
  setInterval(updateClock, 1000);
  updateClock();

  // Dynamic Telemetry Simulation (Simulates live readings from MySQL / PLC)
  const oeeElement = document.getElementById('kpi-oee');
  const throughputElement = document.getElementById('kpi-throughput');
  const tempElement = document.getElementById('kpi-temp');
  const logsBox = document.getElementById('logs-box');

  setInterval(() => {
    // Subtle OEE oscillation
    const baseOEE = 87.5;
    const oeeVar = (Math.random() * 0.4 - 0.2).toFixed(1);
    const newOEE = (baseOEE + parseFloat(oeeVar)).toFixed(1);
    if (oeeElement) {
      oeeElement.innerHTML = `${newOEE}<span class="unit">%</span>`;
    }

    // Temperature fluctuation
    const baseTemp = 138.4;
    const tempVar = (Math.random() * 0.2 - 0.1).toFixed(1);
    const newTemp = (baseTemp + parseFloat(tempVar)).toFixed(1);
    if (tempElement) {
      tempElement.innerHTML = `${newTemp}<span class="unit">°C</span>`;
    }
  }, 4000);

  // Auto-scroll logs box to bottom
  if (logsBox) {
    logsBox.scrollTop = logsBox.scrollHeight;
  }
});
