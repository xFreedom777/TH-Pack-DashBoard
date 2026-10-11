import os
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "thpack-telemetry-token-123")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "thpack")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "telemetry")

# Section pen field configurations
SECTION_CONFIG = {
    "uht": {
        "pens": ["tt01", "tt02", "tt04", "ft04fiq", "lt", "uht_power"],
        "labels": [
            "TT01 Holding Temp (°C)",
            "TT02 Pre-Heat 1 (°C)",
            "TT04 Inlet Temp (°C)",
            "FT04FIQ Inlet Flow (L/h)",
            "LT Balance Level (m)",
            "UHT VSDs Power (kW)"
        ]
    },
    "atank": {
        "pens": ["pt460", "tt460", "tt477", "lc", "vsd09_speed"],
        "labels": [
            "PT460 Aseptic Press (bar)",
            "TT460 Sterile Temp (°C)",
            "TT477 Barrier Temp (°C)",
            "LC Product Level (%)",
            "VSD09 Agitator Speed (%)"
        ]
    },
    "cip": {
        "pens": ["c1_ct_r", "c1_tt_r", "c1_ft_s", "c2_ct_r", "c2_tt_r", "cip_power"],
        "labels": [
            "L1 CT_R Return Cond (mS/cm)",
            "L1 TT_R Return Temp (°C)",
            "L1 FT_S Supply Flow (L/h)",
            "L2 CT_R Return Cond (mS/cm)",
            "L2 TT_R Return Temp (°C)",
            "CIP Pumps Power (kW)"
        ]
    },
    "prod": {
        "pens": ["pt_in", "pt_out", "dp", "p101_power", "p101_speed"],
        "labels": [
            "PT_IN Filter Inlet (bar)",
            "PT_OUT Filter Outlet (bar)",
            "ΔP Diff Press (bar)",
            "P101 Power (kW)",
            "P101 Running Speed (%)"
        ]
    }
}

RANGE_PRESETS = {
    "1h": {"start": "-1h", "window": "10s", "format": "%H:%M:%S"},
    "6h": {"start": "-6h", "window": "1m", "format": "%H:%M"},
    "1d": {"start": "-24h", "window": "2m", "format": "%H:%M"},
    "24h": {"start": "-24h", "window": "2m", "format": "%H:%M"},
    "7d": {"start": "-7d", "window": "15m", "format": "%d/%m %H:%M"},
    "30d": {"start": "-30d", "window": "1h", "format": "%d/%m %H:%M"},
    "1m": {"start": "-30d", "window": "1h", "format": "%d/%m %H:%M"},
    "365d": {"start": "-365d", "window": "4h", "format": "%Y-%m-%d %H:%M"},
    "1y": {"start": "-365d", "window": "4h", "format": "%Y-%m-%d %H:%M"}
}

class InfluxTelemetryWriter:
    def __init__(self):
        self.client = None
        self.write_api = None
        self.query_api = None
        self._init_client()

    def _init_client(self):
        try:
            self.client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG, timeout=15000)
            self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
            self.query_api = self.client.query_api()
            print("Connected to InfluxDB writer & query API successfully.")
        except Exception as e:
            print(f"Failed to initialize InfluxDB client: {e}")

    def write_master_telemetry(self, telemetry: dict):
        """
        Extracts telemetry from master_reader and records time-series points to InfluxDB.
        """
        if not telemetry:
            return
        if not self.write_api:
            self._init_client()
            if not self.write_api:
                return

        points = []
        now = datetime.now(timezone.utc)

        vf = telemetry.get("vsd_fleet") or {}

        # 1. UHT Section
        u = telemetry.get("uht") or {}
        uht_pwr = sum(float(vf.get(k, {}).get("power_kw", 0.0) or 0.0) for k in ["VSD01", "VSD02", "VSD03", "VSD06"])
        p_uht = Point("process_telemetry").tag("section", "uht").time(now)
        for f in ["tt01", "tt02", "tt03", "tt04", "tt05", "tt06", "tt07", "ct", "lt", "ft04fiq"]:
            val = u.get(f)
            if isinstance(val, (int, float)):
                p_uht.field(f, float(val))
        p_uht.field("uht_power", float(uht_pwr))
        points.append(p_uht)

        # 2. ATANK Section
        a = telemetry.get("atank") or {}
        vsd09 = vf.get("VSD09") or {}
        vsd09_spd = float(vsd09.get("curspeed_pct") or vsd09.get("speed_pct") or 0.0)
        p_atk = Point("process_telemetry").tag("section", "atank").time(now)
        for f in ["pt460", "tt460", "tt477", "lc"]:
            val = a.get(f)
            if isinstance(val, (int, float)):
                p_atk.field(f, float(val))
        p_atk.field("vsd09_speed", vsd09_spd)
        points.append(p_atk)

        # 3. CIP Section
        c1 = telemetry.get("cip_line1") or {}
        c2 = telemetry.get("cip_line2") or {}
        cip_pwr = sum(float(vf.get(k, {}).get("power_kw", 0.0) or 0.0) for k in ["VSD04", "VSD05"])
        p_cip = Point("process_telemetry").tag("section", "cip").time(now)
        p_cip.field("c1_ct_r", float(c1.get("ct_r") or 0.0))
        p_cip.field("c1_tt_r", float(c1.get("tt_r") or 0.0))
        p_cip.field("c1_ft_s", float(c1.get("ft_s") or 0.0))
        p_cip.field("c2_ct_r", float(c2.get("ct_r") or 0.0))
        p_cip.field("c2_tt_r", float(c2.get("tt_r") or 0.0))
        p_cip.field("cip_power", float(cip_pwr))
        points.append(p_cip)

        # 4. PROD SUPPLY Section
        p = telemetry.get("prod_supply") or {}
        vsd08 = vf.get("VSD08") or {}
        pt_in = float(p.get("pt_in") or 0.0)
        pt_out = float(p.get("pt_out") or 0.0)
        dp = max(pt_in - pt_out, 0.0)
        p_prod = Point("process_telemetry").tag("section", "prod").time(now)
        p_prod.field("pt_in", pt_in)
        p_prod.field("pt_out", pt_out)
        p_prod.field("dp", dp)
        p_prod.field("p101_power", float(vsd08.get("power_kw") or 0.0))
        p_prod.field("p101_speed", float(vsd08.get("curspeed_pct") or vsd08.get("speed_pct") or 0.0))
        points.append(p_prod)

        # 5. Executive KPIs
        kpi = telemetry.get("executive_kpis") or {}
        p_kpi = Point("process_telemetry").tag("section", "kpi").time(now)
        for f in ["plant_oee", "current_flow_rate", "sterilization_compliance_pct", "total_active_kw", "availability", "performance", "quality"]:
            val = kpi.get(f)
            if isinstance(val, (int, float)):
                p_kpi.field(f, float(val))
        points.append(p_kpi)

        try:
            self.write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=points)
        except Exception as e:
            print(f"Error writing master telemetry to InfluxDB: {e}")

    def query_history(self, section: str = "uht", range_key: str = "1d", custom_window: str = None, from_time: str = None, to_time: str = None):
        """
        Queries historical telemetry using InfluxDB 2.7 Flux aggregateWindow.
        Downsamples high-frequency data for fast browser rendering.
        Supports both relative range presets (1d, 7d, 1y) and exact From / To date-time ranges.
        """
        if not self.query_api:
            self._init_client()
            if not self.query_api:
                return {"error": "InfluxDB client not connected", "pens": [], "timestamps": []}

        sec_info = SECTION_CONFIG.get(section)
        if not sec_info:
            return {"error": f"Invalid section '{section}'. Choose from: {list(SECTION_CONFIG.keys())}", "pens": [], "timestamps": []}

        pens = sec_info["pens"]
        field_filter = " or ".join([f'r._field == "{f}"' for f in pens])

        if from_time:
            try:
                from_str_clean = from_time.replace(" ", "T")
                to_str_clean = to_time.replace(" ", "T") if to_time else datetime.now().isoformat()
                tz_local = timezone(timedelta(hours=7))

                def parse_to_utc(s):
                    # Handle formats like 2026-10-11T13:00 or 2026-10-11T13:00:00
                    clean = s[:19] if len(s) >= 19 else s
                    dt = datetime.fromisoformat(clean)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=tz_local)
                    return dt.astimezone(timezone.utc)

                dt_from = parse_to_utc(from_str_clean)
                dt_to = parse_to_utc(to_str_clean)
                diff_hours = max((dt_to - dt_from).total_seconds() / 3600.0, 0.1)

                if not custom_window:
                    if diff_hours <= 1:
                        window_size = "10s"
                        date_format = "%H:%M:%S"
                    elif diff_hours <= 6:
                        window_size = "30s"
                        date_format = "%H:%M:%S"
                    elif diff_hours <= 24:
                        window_size = "1m"
                        date_format = "%H:%M"
                    elif diff_hours <= 168:
                        window_size = "15m"
                        date_format = "%d/%m %H:%M"
                    elif diff_hours <= 720:
                        window_size = "1h"
                        date_format = "%d/%m %H:%M"
                    else:
                        window_size = "4h"
                        date_format = "%Y-%m-%d %H:%M"
                else:
                    window_size = custom_window
                    date_format = "%Y-%m-%d %H:%M" if diff_hours > 48 else "%H:%M:%S"

                from_utc_str = dt_from.strftime("%Y-%m-%dT%H:%M:%SZ")
                to_utc_str = dt_to.strftime("%Y-%m-%dT%H:%M:%SZ")
                range_clause = f'start: time(v: "{from_utc_str}"), stop: time(v: "{to_utc_str}")'
                range_key = f"custom_{from_time}_{to_time}"
            except Exception as ex:
                print(f"Error parsing custom time range: {ex}, falling back to preset 1d")
                preset = RANGE_PRESETS.get("1d")
                range_clause = f'start: {preset["start"]}'
                window_size = custom_window or preset["window"]
                date_format = preset["format"]
        else:
            preset = RANGE_PRESETS.get(range_key.lower(), RANGE_PRESETS["1d"])
            start_range = preset["start"]
            window_size = custom_window or preset["window"]
            date_format = preset["format"]
            range_clause = f'start: {start_range}'

        flux = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
          |> range({range_clause})
          |> filter(fn: (r) => r._measurement == "process_telemetry" and r.section == "{section}")
          |> filter(fn: (r) => {field_filter})
          |> aggregateWindow(every: {window_size}, fn: mean, createEmpty: false)
          |> yield(name: "downsampled")
        '''

        try:
            tables = self.query_api.query(flux, org=INFLUXDB_ORG)
            data_by_time = {}

            for table in tables:
                for record in table.records:
                    rec_time = record.get_time()
                    t_str = rec_time.strftime(date_format)
                    f_name = record.get_field()
                    f_val = record.get_value()

                    if t_str not in data_by_time:
                        data_by_time[t_str] = {"_raw_time": rec_time}
                    data_by_time[t_str][f_name] = round(f_val, 2) if f_val is not None else None

            # Sort timestamps chronologically
            sorted_entries = sorted(data_by_time.items(), key=lambda item: item[1]["_raw_time"])
            timestamps = [entry[0] for entry in sorted_entries]
            full_timestamps = [entry[1]["_raw_time"].strftime("%Y-%m-%d %H:%M:%S") for entry in sorted_entries]

            # Build pen arrays matching dataset order
            pen_arrays = []
            for pen_field in pens:
                series_vals = [
                    entry[1].get(pen_field) for entry in sorted_entries
                ]
                pen_arrays.append(series_vals)

            return {
                "status": "success",
                "section": section,
                "range": range_key,
                "window": window_size,
                "count": len(timestamps),
                "timestamps": timestamps,
                "full_timestamps": full_timestamps,
                "pens": pen_arrays,
                "pen_labels": sec_info["labels"],
                "pen_fields": pens
            }

        except Exception as e:
            print(f"Error executing Flux query: {e}")
            return {
                "error": str(e),
                "section": section,
                "range": range_key,
                "timestamps": [],
                "pens": [[] for _ in pens]
            }

influx_writer = InfluxTelemetryWriter()
