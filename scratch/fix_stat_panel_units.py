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
        title = p.get('title', '').encode('ascii', 'ignore').decode('ascii')
        defaults = p.get('fieldConfig', {}).get('defaults', {})
        
        if 'FT04' in title or 'Product Flow' in title:
            defaults['unit'] = 'LPH'
            defaults['decimals'] = 1
            defaults['max'] = 15000
            modified = True
            print(f"Updated {title} unit to 'LPH'")
            
        elif 'FT10' in title or 'Hotwater Flow' in title:
            defaults['unit'] = 'LPH'
            defaults['decimals'] = 1
            defaults['max'] = 15000
            modified = True
            print(f"Updated {title} unit to 'LPH'")
            
        elif 'PT01' in title or 'PT44' in title or 'Pressure' in title:
            if defaults.get('unit') in ('none', 'bar', 'custom:BarG', ''):
                defaults['unit'] = 'BarG'
                defaults['decimals'] = 2
                modified = True
                print(f"Updated {title} unit to 'BarG'")

    if modified:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(dashboard, f, indent=2, ensure_ascii=False)
        print(f"Saved {filepath.split('\\')[-1]}")
