import json
import subprocess

# 1. Ensure FT01 exists in parsed_instruments.json
json_path = r'e:\x01-git\xDashBoard\parsed_instruments.json'
with open(json_path, 'r', encoding='utf-8') as f:
    catalog = json.load(f)

has_ft01 = any(item.get('Label') == 'FT01' for item in catalog)
if not has_ft01:
    ft01_entry = {
        "Column1": 11000,
        "Process": "UHT-01",
        "PLC": "192.168.0.101",
        "Database": "DB1601.DBD0000",
        "Label": "FT01",
        "DashBoard": "Y",
        "ID": "Eng_00",
        "Group": "Product",
        "Type": "Real",
        "Signal Type": "Eng Value",
        "Min": "0",
        "Max": "15000",
        "Setpoint": "",
        "UOM": "LPH",
        "Description": "Raw Product Feed Flow",
        "Denomination": "Magnetic Flow meter",
        "Type2": "Promag 50H ISO W25.0 0-15000l/h PFA Display 20-55V AC/16-62V DC w.10m cable Pulse signal / 4-20mA HART0.5% cal.",
        "Doc No.": "1218415-0101",
        "Note": "",
        "Rev.": ""
    }
    catalog.insert(0, ft01_entry)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
    print("Added FT01 entry to parsed_instruments.json")

# Re-generate mysql/init.sql
subprocess.run(['python', r'e:\x01-git\xDashBoard\scratch\update_all_code.py'], check=True)

# Update live MySQL database
try:
    sql = """
    INSERT INTO process_instruments 
    (instrument_id, area_code, group_code, tag_name, description, plc_data_format, signal_type, scale_eng_min, scale_eng_max, engineering_unit, hardware_type, is_active, dashboard_visible)
    VALUES (1, 'UHT-01', 'Product', 'FT01', 'Raw Product Feed Flow', 'REAL', 'ENG_VALUE', 0.00, 15000.00, 'LPH', 'Magnetic Flow meter', 1, 1)
    ON DUPLICATE KEY UPDATE description='Raw Product Feed Flow', scale_eng_max=15000.00, engineering_unit='LPH';
    """
    cmd = ['docker', 'exec', 'thpack_mysql', 'mysql', '-uroot', '-prootpassword123', 'thpack_dashboard', '-e', sql]
    subprocess.run(cmd, check=True)
    print("Updated live MySQL process_instruments table for FT01.")
except Exception as e:
    print(f"MySQL insert warning: {e}")

# 2. Update uht_scada_dashboard.json Section 1 stat cards
dash_path = r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\uht_scada_dashboard.json'
with open(dash_path, 'r', encoding='utf-8') as f:
    dashboard = json.load(f)

# Define the 6 stat cards for Section 1 (x: 0, 4, 8, 12, 16, 20)
sec1_cards = [
    {
        "id": 1,
        "x": 0,
        "tag": "FT01",
        "title": "FT01 - Product Feed Flow",
        "unit": "LPH",
        "max": 15000,
        "color": "green"
    },
    {
        "id": 2,
        "x": 4,
        "tag": "FT04",
        "title": "FT04 - Product Flow",
        "unit": "LPH",
        "max": 15000,
        "color": "green"
    },
    {
        "id": 3,
        "x": 8,
        "tag": "TT01",
        "title": "TT01 - Raw Product In Feed Temp",
        "unit": "celsius",
        "max": 200,
        "color": "blue"
    },
    {
        "id": 4,
        "x": 12,
        "tag": "TT44",
        "title": "TT44 - Sec 11 HC Inlet Temp",
        "unit": "celsius",
        "max": 200,
        "color": "yellow"
    },
    {
        "id": 8,
        "x": 16,
        "tag": "TT42",
        "title": "TT42 - Product Outlet HC Temp",
        "unit": "celsius",
        "max": 200,
        "color": "orange"
    },
    {
        "id": 5,
        "x": 20,
        "tag": "TT06",
        "title": "TT06 - Sec 15 Product Temp",
        "unit": "celsius",
        "max": 200,
        "color": "purple"
    }
]

for card in sec1_cards:
    pid = card["id"]
    for p in dashboard.get('panels', []):
        if p.get('id') == pid:
            p['title'] = card["title"]
            p['gridPos'] = {"h": 4, "w": 4, "x": card["x"], "y": 1}
            p['targets'] = [
                {
                    "query": f'from(bucket: "telemetry") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "process_telemetry" and r.tag_name == "{card["tag"]}" and r._field == "value_scaled") |> yield(name: "{card["tag"]}")',
                    "refId": "A"
                }
            ]
            defaults = p.get('fieldConfig', {}).get('defaults', {})
            defaults['unit'] = card["unit"]
            defaults['max'] = card["max"]
            if card["unit"] == "LPH":
                defaults['decimals'] = 1
                defaults['custom'] = {"suffix": " LPH"}
            else:
                defaults.pop('custom', None)

with open(dash_path, 'w', encoding='utf-8') as f:
    json.dump(dashboard, f, indent=2, ensure_ascii=False)
print("Successfully configured Section 1 stat cards in uht_scada_dashboard.json")

# Also update influxdb_scada_dashboard.json Section 1
dash_path2 = r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\influxdb_scada_dashboard.json'
with open(dash_path2, 'r', encoding='utf-8') as f:
    dashboard2 = json.load(f)

for card in sec1_cards:
    pid = card["id"]
    for p in dashboard2.get('panels', []):
        if p.get('id') == pid:
            p['title'] = card["title"]
            p['gridPos'] = {"h": 4, "w": 4, "x": card["x"], "y": 1}
            p['targets'] = [
                {
                    "query": f'from(bucket: "telemetry") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "process_telemetry" and r.tag_name == "{card["tag"]}" and r._field == "value_scaled") |> yield(name: "{card["tag"]}")',
                    "refId": "A"
                }
            ]
            defaults = p.get('fieldConfig', {}).get('defaults', {})
            defaults['unit'] = card["unit"]
            defaults['max'] = card["max"]
            if card["unit"] == "LPH":
                defaults['decimals'] = 1
                defaults['custom'] = {"suffix": " LPH"}

with open(dash_path2, 'w', encoding='utf-8') as f:
    json.dump(dashboard2, f, indent=2, ensure_ascii=False)
print("Successfully configured Section 1 stat cards in influxdb_scada_dashboard.json")
