import time
from datetime import datetime, timedelta
import json
import mysql.connector
from app.database import get_db_connection

def format_duration(seconds: int) -> str:
    hrs = seconds // 3600
    mins = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}"

class SectionStepState:
    def __init__(self, section: str):
        self.section = section
        self.current_step_int = None
        self.current_step_desc = None
        self.current_step_sp = 0
        self.start_time = None
        self.batch_id = "P" + datetime.now().strftime("%y%m%d") + "-01"
        self.sku_id = "THP-PROD-01"
        self.sku_name = "Standard Production"
        self.operator_name = "Operator"
        self.samples = []

    def add_sample(self, sensor_dict: dict):
        if len(self.samples) < 3600:  # limit buffer size
            self.samples.append(sensor_dict)

    def calculate_stats(self):
        if not self.samples:
            return {}, {}, {}

        numeric_keys = set()
        for s in self.samples:
            for k, v in s.items():
                if isinstance(v, (int, float)):
                    numeric_keys.add(k)

        avg_dict = {}
        min_dict = {}
        max_dict = {}

        for k in numeric_keys:
            vals = [float(s[k]) for s in self.samples if k in s and isinstance(s[k], (int, float))]
            if vals:
                avg_dict[k] = round(sum(vals) / len(vals), 2)
                min_dict[k] = round(min(vals), 2)
                max_dict[k] = round(max(vals), 2)

        return avg_dict, min_dict, max_dict


class StepTransitionTracker:
    def __init__(self):
        self.states = {
            "uht": SectionStepState("uht"),
            "atank": SectionStepState("atank"),
            "cip_line1": SectionStepState("cip_line1"),
            "cip_line2": SectionStepState("cip_line2")
        }

    def process_telemetry_tick(self, telemetry: dict):
        if not telemetry:
            return

        now = datetime.now()

        # 1. Process UHT
        uht_data = telemetry.get("uht")
        if uht_data:
            step_int = uht_data.get("step_int", 0)
            step_desc = uht_data.get("step_desc", "OFF")
            step_sp = uht_data.get("step_setpoint", 0)
            sensors = {
                "tt01": uht_data.get("tt01", 0.0),
                "tt02": uht_data.get("tt02", 0.0),
                "tt03": uht_data.get("tt03", 0.0),
                "tt04": uht_data.get("tt04", 0.0),
                "tt05": uht_data.get("tt05", 0.0),
                "tt06": uht_data.get("tt06", 0.0),
                "tt07": uht_data.get("tt07", 0.0),
                "ft04fiq": uht_data.get("ft04fiq", 0.0),
                "lt": uht_data.get("lt", 0.0),
                "ct": uht_data.get("ct", 0.0)
            }
            self._handle_step_tick("uht", step_int, step_desc, step_sp, sensors, now)

        # 2. Process ATANK
        atk_data = telemetry.get("atank")
        if atk_data:
            step_int = atk_data.get("step_int", 0)
            step_desc = atk_data.get("step_desc", "OFF")
            step_sp = atk_data.get("step_setpoint", 0)
            sensors = {
                "pt460": atk_data.get("pt460", 0.0),
                "tt460": atk_data.get("tt460", 0.0),
                "tt477": atk_data.get("tt477", 0.0),
                "lc": atk_data.get("lc", 0.0)
            }
            self._handle_step_tick("atank", step_int, step_desc, step_sp, sensors, now)

        # 3. Process CIP Line 1
        cip1_data = telemetry.get("cip_line1")
        if cip1_data:
            step_int = cip1_data.get("step_int", 0)
            step_desc = cip1_data.get("step_desc", "000::System Standby")
            step_sp = cip1_data.get("step_setpoint", 0)
            sensors = {
                "ct_r": cip1_data.get("ct_r", 0.0),
                "tt_r": cip1_data.get("tt_r", 0.0),
                "tt_s": cip1_data.get("tt_s", 0.0),
                "ft_s": cip1_data.get("ft_s", 0.0)
            }
            self._handle_step_tick("cip_line1", step_int, step_desc, step_sp, sensors, now)

        # 4. Process CIP Line 2
        cip2_data = telemetry.get("cip_line2")
        if cip2_data:
            step_int = cip2_data.get("step_int", 0)
            step_desc = cip2_data.get("step_desc", "000::System Standby")
            step_sp = cip2_data.get("step_setpoint", 0)
            sensors = {
                "ct_r": cip2_data.get("ct_r", 0.0),
                "tt_r": cip2_data.get("tt_r", 0.0),
                "tt_s": cip2_data.get("tt_s", 0.0),
                "ft_s": cip2_data.get("ft_s", 0.0)
            }
            self._handle_step_tick("cip_line2", step_int, step_desc, step_sp, sensors, now)

    def _handle_step_tick(self, section: str, step_int: int, step_desc: str, step_sp: int, sensors: dict, now: datetime):
        state = self.states[section]

        # First initialization
        if state.current_step_int is None:
            state.current_step_int = step_int
            state.current_step_desc = step_desc
            state.current_step_sp = step_sp
            state.start_time = now
            state.samples = [sensors]
            return

        # Check if step has transitioned
        if step_int != state.current_step_int:
            # Complete the previous step
            prev_step_int = state.current_step_int
            prev_step_desc = state.current_step_desc
            prev_step_sp = state.current_step_sp
            prev_start = state.start_time
            stop_time = now
            duration_sec = max(int((stop_time - prev_start).total_seconds()), 1)
            duration_fmt = format_duration(duration_sec)

            avg_s, min_s, max_s = state.calculate_stats()

            # Perform section-specific validation
            val_res, val_note = self._validate_step(section, prev_step_int, avg_s, min_s, max_s)

            # Extract key indicators
            temp_p_avg, temp_p_min, temp_p_max = None, None, None
            temp_s_avg = None
            press_avg = None
            flow_avg = None
            cond_avg = None
            level_avg = None

            if section == "uht":
                temp_p_avg = avg_s.get("tt01")
                temp_p_min = min_s.get("tt01")
                temp_p_max = max_s.get("tt01")
                temp_s_avg = avg_s.get("tt02")
                flow_avg = avg_s.get("ft04fiq")
                cond_avg = avg_s.get("ct")
                level_avg = avg_s.get("lt")
            elif section == "atank":
                temp_p_avg = avg_s.get("tt460")
                temp_p_min = min_s.get("tt460")
                temp_p_max = max_s.get("tt460")
                temp_s_avg = avg_s.get("tt477")
                press_avg = avg_s.get("pt460")
                level_avg = avg_s.get("lc")
            elif section in ("cip_line1", "cip_line2"):
                temp_p_avg = avg_s.get("tt_r")
                temp_p_min = min_s.get("tt_r")
                temp_p_max = max_s.get("tt_r")
                temp_s_avg = avg_s.get("tt_s")
                flow_avg = avg_s.get("ft_s")
                cond_avg = avg_s.get("ct_r")

            summary_json = json.dumps({
                "samples_count": len(state.samples),
                "averages": avg_s,
                "minimums": min_s,
                "maximums": max_s
            })

            # Save completed step to MySQL
            self._save_step_to_db(
                section=section,
                batch_id=state.batch_id,
                sku_id=state.sku_id,
                sku_name=state.sku_name,
                step_int=prev_step_int,
                step_desc=prev_step_desc,
                step_setpoint=prev_step_sp,
                start_time=prev_start,
                stop_time=stop_time,
                duration_sec=duration_sec,
                duration_formatted=duration_fmt,
                status="COMPLETED",
                validation_result=val_res,
                validation_note=val_note,
                temp_p_avg=temp_p_avg,
                temp_p_min=temp_p_min,
                temp_p_max=temp_p_max,
                temp_s_avg=temp_s_avg,
                press_avg=press_avg,
                flow_avg=flow_avg,
                cond_avg=cond_avg,
                level_avg=level_avg,
                summary_json=summary_json,
                operator_name=state.operator_name
            )

            # Start new step
            state.current_step_int = step_int
            state.current_step_desc = step_desc
            state.current_step_sp = step_sp
            state.start_time = now
            state.samples = [sensors]
        else:
            # Same step continues -> accumulate sensor sample
            state.add_sample(sensors)

    def _validate_step(self, section: str, step_int: int, avg_s: dict, min_s: dict, max_s: dict):
        if section == "uht":
            if step_int == 18:  # Sterile Timer
                tt01_min = min_s.get("tt01", 0.0)
                if tt01_min >= 137.0:
                    return "OK", f"Sterile Temp Verified: Min {tt01_min:.1f}°C >= 137.0°C"
                else:
                    return "NG", f"Sterile Temp Deviation: Min {tt01_min:.1f}°C < 137.0°C"
            return "OK", "Normal Transition"

        elif section == "atank":
            if step_int == 18:  # Sterile Timer
                tt460_min = min_s.get("tt460", 0.0)
                pt460_avg = avg_s.get("pt460", 0.0)
                if tt460_min >= 121.0 and pt460_avg >= 1.5:
                    return "OK", f"Aseptic Integrity OK (Temp: {tt460_min:.1f}°C, Press: {pt460_avg:.2f} bar)"
                return "NG", f"Integrity Alert (Temp: {tt460_min:.1f}°C, Press: {pt460_avg:.2f} bar)"
            return "OK", "Normal Transition"

        elif section in ("cip_line1", "cip_line2"):
            if step_int == 14:  # Alkali Recir
                ct_avg = avg_s.get("ct_r", 0.0)
                if ct_avg >= 10.0:
                    return "OK", f"Caustic Conductivity Target Met ({ct_avg:.1f} mS/cm)"
                return "OK", f"Caustic Circulated ({ct_avg:.1f} mS/cm)"
            return "OK", "Normal Transition"

        return "OK", "Step Passed"

    def _save_step_to_db(self, section, batch_id, sku_id, sku_name, step_int, step_desc,
                         step_setpoint, start_time, stop_time, duration_sec, duration_formatted,
                         status, validation_result, validation_note, temp_p_avg, temp_p_min,
                         temp_p_max, temp_s_avg, press_avg, flow_avg, cond_avg, level_avg,
                         summary_json, operator_name):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            sql = """
            INSERT INTO process_step_logs (
                section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
                start_time, stop_time, duration_sec, duration_formatted, status,
                validation_result, validation_note, temp_primary_avg, temp_primary_min,
                temp_primary_max, temp_secondary_avg, pressure_avg, flow_avg,
                conductivity_avg, level_avg, sensor_summary_json, operator_name
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            """
            params = (
                section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
                start_time, stop_time, duration_sec, duration_formatted, status,
                validation_result, validation_note, temp_p_avg, temp_p_min,
                temp_p_max, temp_s_avg, press_avg, flow_avg,
                cond_avg, level_avg, summary_json, operator_name
            )
            cursor.execute(sql, params)
            conn.commit()
            cursor.close()
            conn.close()
            print(f"✅ [StepTracker] Recorded Step {step_int} ({step_desc}) for [{section}] Duration: {duration_formatted} (Status: {validation_result})")
        except Exception as e:
            print(f"❌ [StepTracker] Error saving step to DB: {e}")

step_tracker = StepTransitionTracker()
