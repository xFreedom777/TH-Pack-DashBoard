from influxdb_client import InfluxDBClient

client = InfluxDBClient(url="http://localhost:8087", token="thpack-telemetry-token-123", org="thpack")
query_api = client.query_api()

# 1. Check all distinct tag_name values in process_telemetry
q1 = 'from(bucket: "telemetry") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "process_telemetry") |> keep(columns: ["tag_name"]) |> group() |> distinct(column: "tag_name")'
tables1 = query_api.query(q1)

tags = []
for t in tables1:
    for rec in t.records:
        tags.append(rec.get_value())

print("Distinct tag_name in InfluxDB process_telemetry:", sorted(tags))

# 2. Check tag_name matching TT
q2 = 'from(bucket: "telemetry") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "process_telemetry" and r._field == "value_scaled" and r.tag_name =~ /^TT/) |> limit(n: 5)'
tables2 = query_api.query(q2)

tt_points = 0
for t in tables2:
    for rec in t.records:
        tt_points += 1
        print(f"TT Point: {rec.values.get('tag_name')} = {rec.get_value()} at {rec.get_time()}")

print(f"Total TT points matching /^TT/: {tt_points}")
