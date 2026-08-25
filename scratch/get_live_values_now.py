import json
import urllib.request
from influxdb_client import InfluxDBClient

target_tags = ['FT04', 'FT10', 'TT01', 'TT44', 'TT42', 'TT06']

# 1. Fetch from FastAPI Backend live API
backend_data = {}
try:
    res = urllib.request.urlopen('http://localhost:8000/api/v1/telemetry/live').read()
    items = json.loads(res.decode())
    for it in items:
        name = it.get('tag_name')
        if name in target_tags:
            backend_data[name] = it
except Exception as e:
    print(f"Backend API error: {e}")

# 2. Fetch from InfluxDB
influx_data = {}
try:
    client = InfluxDBClient(url="http://localhost:8087", token="thpack-telemetry-token-123", org="thpack")
    query = 'from(bucket: "telemetry") |> range(start: -15m) |> filter(fn: (r) => r._measurement == "process_telemetry" and r._field == "value_scaled") |> last()'
    tables = client.query_api().query(query)
    for table in tables:
        for record in table.records:
            name = record.values.get("tag_name")
            if name in target_tags:
                influx_data[name] = {
                    "val": record.get_value(),
                    "time": str(record.get_time())
                }
except Exception as e:
    print(f"InfluxDB error: {e}")

# Build summary
results = []
for tag in target_tags:
    b_item = backend_data.get(tag, {})
    i_item = influx_data.get(tag, {})
    results.append({
        "tag": tag,
        "description": b_item.get("description", ""),
        "db_address": f"DB{b_item.get('db_number')}.DBD{b_item.get('byte_offset')}",
        "live_plc_value": f"{b_item.get('scaled_value', 0.0)} {b_item.get('unit_of_measure', '')}",
        "influxdb_value": f"{i_item.get('val', 0.0)} {b_item.get('unit_of_measure', '')}",
        "timestamp": i_item.get("time", "N/A"),
        "quality": b_item.get("quality_status", "GOOD")
    })

print(json.dumps(results, indent=2))
