import json

filepath = r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\uht_scada_dashboard.json'

with open(filepath, 'r', encoding='utf-8') as f:
    dashboard = json.load(f)

# Update row section titles and ordering
# 100 -> Section 1: UHT-01 Live Process KPIs & Operating State (InfluxDB Stream)
# 109 -> Section 2: All Temperature Transmitters (Direct InfluxDB Flux Query)
# 107 -> Section 3: Flow Rates Monitoring: FT04 (Product), FT10 (Hotwater), and (FT10 - FT04)
# 104 -> Section 4: Differential Pressure Monitoring: Section 14 (PT61A - PT61B), Section 15 (PT64A - PT64B), Section 12 (PT67A - PT67B)
# 108 -> Section 5: Section 11 Thermal Approach: TT44, TT08, and (TT08 - TT44)
# 111 -> Section 6: Steam Heating & Heat Recovery Correlation: PT44, TT44, TT08, TT10
# 102 -> Section 7: Buffer Tank (BTD) Level Continuous Line Graph (InfluxDB)
# 110 -> Section 8: Server & Gateway Infrastructure Health (Telegraf Telemetry)
# 103 -> Section 9: Pump Inverters & Motor Drives Configuration (MySQL Config Master)
# 101 -> Section 10: All SCADA Instruments Catalog & Alarm Interlocks (MySQL Master)

row_titles = {
    100: "⚡ Section 1: UHT-01 Live Process KPIs & Operating State (InfluxDB Stream)",
    109: "🌡️ Section 2: All Temperature Transmitters (Direct InfluxDB Flux Query)",
    107: "🌊 Section 3: Flow Rates Monitoring: FT04 (Product), FT10 (Hotwater), and (FT10 - FT04)",
    104: "⚖️ Section 4: Differential Pressure Monitoring: Sec 14 (PT61A/B), Sec 15 (PT64A/B), Sec 12 (PT67A/B)",
    108: "🔥 Section 5: Section 11 Thermal Approach: TT44, TT08, and (TT08 - TT44)",
    111: "💨 Section 6: Steam Heating & Heat Recovery Correlation: PT44, TT44, TT08, TT10",
    102: "🛢️ Section 7: Buffer Tank (BTD) Level Continuous Line Graph (InfluxDB)",
    110: "🖥️ Section 8: Server & Gateway Infrastructure Health (Telegraf Telemetry)",
    103: "⚙️ Section 9: Pump Inverters & Motor Drives Configuration (MySQL Config Master)",
    101: "📋 Section 10: All SCADA Instruments Catalog & Alarm Interlocks (MySQL Master)"
}

for p in dashboard.get('panels', []):
    pid = p.get('id')
    if pid in row_titles:
        p['title'] = row_titles[pid]

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(dashboard, f, indent=2, ensure_ascii=False)

print(f"Updated section titles in {filepath}")

# Also update influxdb_scada_dashboard.json
filepath2 = r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\influxdb_scada_dashboard.json'
with open(filepath2, 'r', encoding='utf-8') as f:
    d2 = json.load(f)

for p in d2.get('panels', []):
    if p.get('id') == 102:
        p['title'] = " Section 4: Differential Pressure Monitoring (PT61A/B, PT64A/B, PT67A/B)"

with open(filepath2, 'w', encoding='utf-8') as f:
    json.dump(d2, f, indent=2, ensure_ascii=False)

print(f"Updated section titles in {filepath2}")
