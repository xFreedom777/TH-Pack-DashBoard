import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "thpack-telemetry-token-123")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "thpack")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "telemetry")

class InfluxTelemetryWriter:
    def __init__(self):
        self.client = None
        self.write_api = None
        self._init_client()

    def _init_client(self):
        try:
            self.client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
            self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
            print("Connected to InfluxDB writer successfully.")
        except Exception as e:
            print(f"Failed to initialize InfluxDB client: {e}")

    def write_readings(self, readings):
        if not self.write_api:
            self._init_client()
            if not self.write_api:
                return
        points = []
        for r in readings:
            tag_name = r.get("tag_name")
            if not tag_name:
                continue
            
            p = Point("process_telemetry") \
                .tag("tag_name", tag_name) \
                .tag("plc_format", r.get("plc_data_format", "REAL")) \
                .field("value_scaled", float(r.get("scaled_value", 0.0))) \
                .field("value_raw", float(r.get("raw_value", 0.0))) \
                .field("digital_value", bool(r.get("digital_value", False))) \
                .field("quality_status", str(r.get("quality_status", "GOOD")))
            points.append(p)
        
        if points:
            try:
                self.write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=points)
            except Exception as e:
                print(f"Error writing to InfluxDB: {e}")
