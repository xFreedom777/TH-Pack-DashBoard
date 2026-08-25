import json
import subprocess

# 1. Update parsed_instruments.json
json_path = r'e:\x01-git\xDashBoard\parsed_instruments.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

count = 0
for item in data:
    label = item.get('Label', '')
    uom = item.get('UOM', '')
    if uom == 'LPH' or label.startswith('FT'):
        item['Max'] = "15000"
        count += 1

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Updated {count} flow tags in parsed_instruments.json (Max = 15000).")

# 2. Re-run scratch/update_all_code.py to update mysql/init.sql
subprocess.run(['python', r'e:\x01-git\xDashBoard\scratch\update_all_code.py'], check=True)
print("Re-generated mysql/init.sql cleanly.")

# 3. Update live MySQL database inside container thpack_mysql
try:
    cmd = [
        'docker', 'exec', 'thpack_mysql', 'mysql',
        '-uroot', '-prootpassword123', 'thpack_dashboard',
        '-e', "UPDATE process_instruments SET scale_eng_max = 15000.00 WHERE engineering_unit = 'LPH' OR tag_name LIKE 'FT%';"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print("Live MySQL update successful: scale_eng_max set to 15000.00 for all Flow tags.")
except Exception as e:
    print(f"Live MySQL update warning: {e}")

# 4. Update Grafana panels max values for Flow panels
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
        title = p.get('title', '').encode('ascii', 'ignore').decode('ascii')
        custom = defaults.get('custom', {})
        suffix = custom.get('suffix', '')
        
        if 'FT' in title or 'Flow' in title or 'LPH' in suffix:
            defaults['max'] = 15000
            # Update thresholds if any
            if 'thresholds' in defaults and 'steps' in defaults['thresholds']:
                steps = defaults['thresholds']['steps']
                if len(steps) >= 3:
                    steps[1]['value'] = 12000
                    steps[2]['value'] = 15000
                elif len(steps) == 2:
                    steps[1]['value'] = 12000
            modified = True
            print(f"Updated Grafana flow max scale (15000 LPH) for panel {p.get('id')} ({title})")

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(dashboard, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved {filepath.split('\\')[-1]}")
