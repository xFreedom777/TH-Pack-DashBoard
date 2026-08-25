import json

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
        if defaults.get('unit') == 'litre':
            defaults['unit'] = 'none'
            if 'custom' not in defaults:
                defaults['custom'] = {}
            defaults['custom']['suffix'] = ' LPH'
            defaults['decimals'] = 1
            title = p.get('title', '').encode('ascii', 'ignore').decode('ascii')
            print(f"Updated panel {p.get('id')} ({title}) in {filepath.split('\\')[-1]}")
            modified = True
            
    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(dashboard, f, indent=2, ensure_ascii=False)
        print(f"Successfully saved {filepath.split('\\')[-1]}")
