import json
import re

# 1. Update parsed_instruments.json
json_path = r'e:\x01-git\xDashBoard\parsed_instruments.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

count = 0
for item in data:
    label = item.get('Label', '')
    uom = item.get('UOM', '')
    if uom in ('DegC', 'C', '°C') or label.startswith('TT') or label.startswith('TIC'):
        item['Max'] = "200"
        count += 1

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Updated {count} temperature tags in parsed_instruments.json (Max = 200).")

# 2. Re-run scratch/update_all_code.py to update mysql/init.sql
import subprocess
subprocess.run(['python', r'e:\x01-git\xDashBoard\scratch\update_all_code.py'], check=True)
print("Re-generated mysql/init.sql cleanly.")

# 3. Update live MySQL database inside container thpack_mysql
try:
    cmd = [
        'docker', 'exec', 'thpack_mysql', 'mysql',
        '-uroot', '-prootpassword123', 'thpack_dashboard',
        '-e', "UPDATE process_instruments SET scale_eng_max = 200.00 WHERE engineering_unit IN ('DegC', 'C', '°C') OR tag_name LIKE 'TT%' OR tag_name LIKE 'TIC%';"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print("Live MySQL update successful: scale_eng_max set to 200.00 for all Temperature tags.")
except Exception as e:
    print(f"Live MySQL update warning: {e}")

# 4. Update Grafana panels max values if applicable
files = [
    r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\uht_scada_dashboard.json',
    r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\influxdb_scada_dashboard.json'
]

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        dashboard = json.load(f)
    
    modified = False
    for p in dashboard.get('panels', []):
        defaults = p.get('fieldConfig', {}).get('defaults', {})
        unit = defaults.get('unit', '')
        title = p.get('title', '').encode('ascii', 'ignore').decode('ascii')
        
        if unit == 'celsius' or 'TT' in title or 'Temp' in title:
            defaults['max'] = 200
            # Update thresholds if any
            if 'thresholds' in defaults and 'steps' in defaults['thresholds']:
                for step in defaults['thresholds']['steps']:
                    if step.get('value') and step['value'] > 160:
                        step['value'] = 200
            modified = True
            print(f"Updated Grafana max scale (200 °C) for panel {p.get('id')} ({title})")

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(dashboard, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved {filepath.split('\\')[-1]}")
