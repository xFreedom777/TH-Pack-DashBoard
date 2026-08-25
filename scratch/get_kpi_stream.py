import json
from influxdb_client import InfluxDBClient

tag_names = ['FT01', 'FT04', 'TT01', 'TT44', 'TT42', 'TT06']

# Load catalog info from parsed_instruments.json
with open(r'e:\x01-git\xDashBoard\parsed_instruments.json', 'r', encoding='utf-8') as f:
    catalog = json.load(f)

catalog_map = {item.get('Label'): item for item in catalog}

# Query InfluxDB stream
client = InfluxDBClient(url="http://localhost:8087", token="thpack-telemetry-token-123", org="thpack")
query_api = client.query_api()

query = 'from(bucket: "telemetry") |> range(start: -15m) |> filter(fn: (r) => r._measurement == "process_telemetry" and r._field == "value_scaled") |> last()'
tables = query_api.query(query)

influx_data = {}
for table in tables:
    for record in table.records:
        t_name = record.values.get("tag_name")
        if t_name in tag_names:
            influx_data[t_name] = {
                "value": record.get_value(),
                "time": record.get_time(),
                "quality": record.values.get("quality_status", "GOOD")
            }

output = []
for tag in tag_names:
    cat = catalog_map.get(tag, {})
    stream = influx_data.get(tag, {})
    output.append({
        "tag": tag,
        "description": cat.get("Description", "N/A"),
        "db_address": cat.get("Database", "N/A"),
        "uom": cat.get("UOM", ""),
        "min_max": f"{cat.get('Min', 0)} - {cat.get('Max', 0)} {cat.get('UOM', '')}",
        "live_value": stream.get("value", 0.0),
        "timestamp": str(stream.get("time", "N/A")),
        "quality": stream.get("quality", "GOOD" if tag in catalog_map else "NOT_FOUND")
    })

print(json.dumps(output, indent=2))
