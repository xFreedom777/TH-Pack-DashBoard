import json
from influxdb_client import InfluxDBClient

with open(r'e:\x01-git\xDashBoard\parsed_instruments.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

tt_tags = [item for item in data if item.get('Label', '').startswith('TT')]

client = InfluxDBClient(url="http://localhost:8087", token="thpack-telemetry-token-123", org="thpack")
query_api = client.query_api()

query = 'from(bucket: "telemetry") |> range(start: -15m) |> filter(fn: (r) => r._measurement == "process_telemetry" and r._field == "value_scaled") |> last()'
tables = query_api.query(query)

readings = {}
for table in tables:
    for record in table.records:
        t_name = record.values.get("tag_name")
        if t_name:
            readings[t_name] = {
                "value": record.get_value(),
                "time": str(record.get_time()),
                "quality": record.values.get("quality_status", "GOOD")
            }

output = []
for idx, item in enumerate(tt_tags, start=1):
    tag = item.get("Label")
    r_info = readings.get(tag, {})
    output.append({
        "num": idx,
        "tag": tag,
        "db": item.get("Database"),
        "id": item.get("ID"),
        "description": item.get("Description"),
        "range": f"{item.get('Min')} - {item.get('Max')} {item.get('UOM')}",
        "live_val": f"{r_info.get('value', 0.0):.2f} {item.get('UOM')}",
        "quality": r_info.get("quality", "GOOD")
    })

print(f"Total TT Tags: {len(tt_tags)}")
print(json.dumps(output, indent=2))
