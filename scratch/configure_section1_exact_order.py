import json

# Define the 6 stat cards for Section 1 in exact order: FT04, FT10, TT01, TT44, TT42, TT06
sec1_cards = [
    {
        "id": 1,
        "x": 0,
        "tag": "FT04",
        "title": "FT04 - Product Flow",
        "unit": "LPH",
        "max": 15000,
        "color": "green"
    },
    {
        "id": 2,
        "x": 4,
        "tag": "FT10",
        "title": "FT10 - Hotwater Flow",
        "unit": "LPH",
        "max": 15000,
        "color": "blue"
    },
    {
        "id": 3,
        "x": 8,
        "tag": "TT01",
        "title": "TT01 - Raw Product In Feed",
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

files = [
    r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\uht_scada_dashboard.json',
    r'e:\x01-git\xDashBoard\grafana\provisioning\dashboards\influxdb_scada_dashboard.json'
]

for dash_path in files:
    with open(dash_path, 'r', encoding='utf-8') as f:
        dashboard = json.load(f)

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

    with open(dash_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)
    print(f"Successfully configured Section 1 stat cards in exact order in {dash_path.split('\\')[-1]}")
