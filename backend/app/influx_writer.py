import os
from datetime import datetime, timezone, timedelta
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "thpack-telemetry-token-123")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "thpack")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "telemetry")

# Section pen field configurations
SECTION_CONFIG = {
    "uht": {
        "pens": [
            "tt01", "tt02", "tt04", "ft04fiq", "lt", "uht_power", "tt05", "tt06",
            "tt03", "tt07", "ct", "tt71",
            "sp_htc", "sp_ph01", "sp_c01", "sp_c02", "sp_ph02", "sp_ctc",
            "fiq04_sv", "fiqcv08_sv"
        ],
        "labels": [
            "TT01 Holding Temp (°C)",
            "TT02 Pre-Heat 1 (°C)",
            "TT04 Inlet Temp (°C)",
            "FIQ04 Inlet Flow (M4) (L/h)",
            "FIQCV08 Add Water (Liter)",
            "UHT VSDs Power (kW)",
            "TT42 (TT05) Outlet HC (°C)",
            "TT44 (TT06) Sec 11 HC (°C)",
            "TT03 Pre-Heat 2 (°C)",
            "TT07 Outlet Temp (°C)",
            "CT Conductivity (mS/cm)",
            "TT71 Aseptic Outlet (°C)",
            "SP: TT01 Holding (136°C)",
            "SP: TT02 Pre-Heat 1 (90°C)",
            "SP: TT42 (TT05) Outlet HC (SP: TT01)",
            "SP: TT44 Sec 11 HC (25°C)",
            "SP: TT03 Pre-Heat 2 (90°C)",
            "SP: TT07 Outlet Temp (SP: TT01)",
            "SP: FIQ04 Inlet Flow (L/h)",
            "SP: FIQCV08 Add Water (Liter)"
        ]
    },
    "atank": {
        "pens": [
            "pt460", "tt460", "tt477", "lc", "vsd09_speed",
            "sp_pt", "sp_tt"
        ],
        "labels": [
            "PT460 Aseptic Press (bar)",
            "TT460 Sterile Temp (°C)",
            "TT477 Barrier Temp (°C)",
            "LC Product Weight (kg)",
            "VSD09 Agitator Speed (%)",
            "SP: PT460 Press (bar)",
            "SP: TT460/TT477 Temp (°C)"
        ]
    },
    "cip": {
        "pens": [
            "c1_ct_r", "c1_tt_r", "c1_tt_s", "c1_ft_s",
            "c2_ct_r", "c2_tt_r", "c2_tt_s", "c2_ft_s",
            "cip_power",
            "c1_sp_ct", "c1_sp_tt", "c1_sp_ft",
            "c2_sp_ct", "c2_sp_tt", "c2_sp_ft"
        ],
        "labels": [
            "L1 Return Cond (CT_R) (mS/cm)",
            "L1 Return Temp (TT_R) (°C)",
            "L1 Supply Temp (TT_S) (°C)",
            "L1 Supply Flow (FT_S) (L/h)",
            "L2 Return Cond (CT_R) (mS/cm)",
            "L2 Return Temp (TT_R) (°C)",
            "L2 Supply Temp (TT_S) (°C)",
            "L2 Supply Flow (FT_S) (L/h)",
            "CIP Pumps Power (kW)",
            "SP: L1 Return Cond (mS/cm)",
            "SP: L1 Temp (°C)",
            "SP: L1 Supply Flow (L/h)",
            "SP: L2 Return Cond (mS/cm)",
            "SP: L2 Temp (°C)",
            "SP: L2 Supply Flow (L/h)"
        ]
    },
    "cip_line1": {
        "pens": [
            "c1_ct_r", "c1_tt_r", "c1_tt_s", "c1_ft_s", "c1_power",
            "c1_sp_ct", "c1_sp_tt", "c1_sp_ft"
        ],
        "labels": [
            "C1 Return Cond (CT_R) (mS/cm)",
            "C1 Return Temp (TT_R) (°C)",
            "C1 Supply Temp (TT_S) (°C)",
            "C1 Supply Flow (FT_S) (L/h)",
            "VSD05 Pump Power (kW)",
            "SP: C1 Return Cond (mS/cm)",
            "SP: C1 Temp (°C)",
            "SP: C1 Supply Flow (L/h)"
        ]
    },
    "cip_line2": {
        "pens": [
            "c2_ct_r", "c2_tt_r", "c2_tt_s", "c2_ft_s", "c2_power",
            "c2_sp_ct", "c2_sp_tt", "c2_sp_ft"
        ],
        "labels": [
            "C2 Return Cond (CT_R) (mS/cm)",
            "C2 Return Temp (TT_R) (°C)",
            "C2 Supply Temp (TT_S) (°C)",
            "C2 Supply Flow (FT_S) (L/h)",
            "VSD04 Pump Power (kW)",
            "SP: C2 Return Cond (mS/cm)",
            "SP: C2 Temp (°C)",
            "SP: C2 Supply Flow (L/h)"
        ]
    },
    "prod": {
        "pens": ["pt_in", "pt_out", "dp", "p101_power", "p101_speed", "sp_pt_in"],
        "labels": [
            "PT_IN Filter Inlet (bar)",
            "PT_OUT Filter Outlet (bar)",
            "ΔP Diff Press (bar)",
            "P101 Power (kW)",
            "P101 Running Speed (%)",
            "SP: PT_IN Inlet (bar)"
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
        for f in ["tt01", "tt02", "tt03", "tt04", "tt05", "tt06", "tt07", "tt71", "ct", "lt", "ft04fiq",
                  "sp_htc", "sp_ph01", "sp_c01", "sp_c02", "sp_ph02", "sp_ctc",
                  "fiq04_sv", "fiqcv08_sv"]:
            val = u.get(f)
            if val is None and f == "tt71":
                val = u.get("tt171")
            if isinstance(val, (int, float)):
                p_uht.field(f, float(val))
        p_uht.field("uht_power", float(uht_pwr))
        points.append(p_uht)

        # 2. ATANK Section
        a = telemetry.get("atank") or {}
        vsd09 = vf.get("VSD09") or {}
        vsd09_spd = float(vsd09.get("curspeed_pct") or vsd09.get("speed_pct") or 0.0)
        p_atk = Point("process_telemetry").tag("section", "atank").time(now)
        for f in ["pt460", "tt460", "tt477", "lc", "sp_pt", "sp_tt"]:
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
        p_cip.field("c1_tt_s", float(c1.get("tt_s") or 0.0))
        p_cip.field("c1_ft_s", float(c1.get("ft_s") or 0.0))
        p_cip.field("c1_power", float(vf.get("VSD05", {}).get("power_kw", 0.0) or 0.0))
        p_cip.field("c1_sp_ct", float(c1.get("sp_ct") or 0.0))
        p_cip.field("c1_sp_tt", float(c1.get("sp_tt") or 0.0))
        p_cip.field("c1_sp_ft", float(c1.get("sp_ft") or 0.0))
        p_cip.field("c2_ct_r", float(c2.get("ct_r") or 0.0))
        p_cip.field("c2_tt_r", float(c2.get("tt_r") or 0.0))
        p_cip.field("c2_tt_s", float(c2.get("tt_s") or 0.0))
        p_cip.field("c2_ft_s", float(c2.get("ft_s") or 0.0))
        p_cip.field("c2_power", float(vf.get("VSD04", {}).get("power_kw", 0.0) or 0.0))
        p_cip.field("c2_sp_ct", float(c2.get("sp_ct") or 0.0))
        p_cip.field("c2_sp_tt", float(c2.get("sp_tt") or 0.0))
        p_cip.field("c2_sp_ft", float(c2.get("sp_ft") or 0.0))
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
        p_prod.field("sp_pt_in", float(p.get("sp_pt_in") or 2.0))
        p_prod.field("pid_ov", float(p.get("pid_ov") or 0.0))
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

        influx_sec = "cip" if section in ("cip_line1", "cip_line2") else section
        flux = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
          |> range({range_clause})
          |> filter(fn: (r) => r._measurement == "process_telemetry" and r.section == "{influx_sec}")
          |> filter(fn: (r) => {field_filter})
          |> aggregateWindow(every: {window_size}, fn: mean, createEmpty: false)
          |> yield(name: "downsampled")
        '''

        try:
            tables = self.query_api.query(flux, org=INFLUXDB_ORG)
            data_by_time = {}
            tz_bkk = timezone(timedelta(hours=7))

            for table in tables:
                for record in table.records:
                    rec_time = record.get_time()
                    if rec_time.tzinfo is not None:
                        rec_time_bkk = rec_time.astimezone(tz_bkk)
                    else:
                        rec_time_bkk = rec_time.replace(tzinfo=timezone.utc).astimezone(tz_bkk)

                    t_str = rec_time_bkk.strftime(date_format)
                    f_name = record.get_field()
                    f_val = record.get_value()

                    time_key = rec_time_bkk.isoformat()
                    if time_key not in data_by_time:
                        data_by_time[time_key] = {
                            "_raw_time": rec_time_bkk,
                            "_label": t_str
                        }
                    data_by_time[time_key][f_name] = round(f_val, 2) if f_val is not None else None

            # Sort timestamps chronologically
            sorted_entries = sorted(data_by_time.items(), key=lambda item: item[1]["_raw_time"])
            timestamps = [entry[1]["_label"] for entry in sorted_entries]
            full_timestamps = [entry[1]["_raw_time"].strftime("%d/%m/%Y %H:%M:%S") for entry in sorted_entries]

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
