import sys
from influxdb_client import InfluxDBClient

client = InfluxDBClient(url="http://localhost:8087", token="thpack-telemetry-token-123", org="thpack")
query_api = client.query_api()

query = 'from(bucket: "telemetry") |> range(start: -5m) |> limit(n: 10)'
tables = query_api.query(query)

count = 0
for table in tables:
    for record in table.records:
        count += 1
        tag = record.values.get("tag_name", "N/A")
        print(f"Point {count:02d}: {record.get_measurement()} | {record.get_field()} = {record.get_value()} (Tag: {tag})")

print(f"\nTotal sample records retrieved from fresh telemetry bucket: {count}")
