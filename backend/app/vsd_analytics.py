"""
VSD Analytics, Preventive Maintenance & Fault Pareto Engine
===========================================================
Calculates energy consumption, electrical costs, motor running hours,
preventive maintenance (PM) health status, and VSD fault trip incidents
without false alarms during plant breaks.
"""

import time
from datetime import datetime, date
from typing import Dict, Any, List
try:
    from app.database import fetch_all, execute_insert
except ImportError:
    from database import fetch_all, execute_insert

ELECTRICITY_RATE_PER_KWH = 4.20  # Standard Industrial MEA/PEA Rate (THB/kWh)
DEFAULT_PM_INTERVAL_HOURS = 2000.0  # Level 2 Greasing interval

class VSDAnalyticsEngine:
    def __init__(self):
        self.last_tick_time = time.time()
        self.daily_energy_kwh: Dict[str, float] = {}  # tag -> kwh
        self.peak_power_kw: Dict[str, float] = {}    # tag -> kw
        self.active_faults: Dict[str, Dict[str, Any]] = {}  # tag -> incident metadata
        self.last_sync_time = 0
        self.running_seconds_cache: Dict[str, float] = {}
        self.initialized_from_db = False

    def init_from_db(self):
        if self.initialized_from_db:
            return
        try:
            records = fetch_all("SELECT vsd_tag, total_running_seconds, total_running_hours FROM vsd_maintenance_records")
            for r in records:
                tag = r["vsd_tag"]
                self.running_seconds_cache[tag] = float(r.get("total_running_seconds", 0))
            self.initialized_from_db = True
        except Exception as e:
            print(f"[VSD-ANALYTICS] DB init warning: {e}")

    def process_tick(self, telemetry: dict):
        now = time.time()
        dt = min(3.0, max(0.5, now - self.last_tick_time))
        self.last_tick_time = now

        if not self.initialized_from_db:
            self.init_from_db()

        vsd_fleet = telemetry.get("vsd_fleet", {})
        if not vsd_fleet:
            return

        uht_output = telemetry.get("executive_kpis", {}).get("total_output", 85000.0)

        # 1. Update Energy & Running Hours
        for tag, vsd in vsd_fleet.items():
            power_kw = float(vsd.get("power_kw", 0.0))
            is_running = bool(vsd.get("running", False))
            is_fault = bool(vsd.get("fault", False))
            speed = float(vsd.get("curspeed_pct", 0.0))
            current = float(vsd.get("current_a", 0.0))
            name = vsd.get("name", tag)
            sec = vsd.get("section", "General")

            # Energy integration (kWh = kW * hours)
            inc_kwh = power_kw * (dt / 3600.0)
            self.daily_energy_kwh[tag] = self.daily_energy_kwh.get(tag, 0.0) + inc_kwh

            if power_kw > self.peak_power_kw.get(tag, 0.0):
                self.peak_power_kw[tag] = power_kw

            # Running hours accumulation
            if is_running or speed > 1.0:
                self.running_seconds_cache[tag] = self.running_seconds_cache.get(tag, 0.0) + dt

            # 2. VSD Fault Trip Tracking (Objective Hardware Alarms)
            if is_fault:
                if tag not in self.active_faults:
                    # New trip started!
                    start_dt = datetime.now()
                    try:
                        sql = """
                            INSERT INTO vsd_fault_incidents 
                            (vsd_tag, vsd_name, section, start_time, fault_type, speed_at_fault, current_at_fault, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE')
                        """
                        inc_id = execute_insert(sql, (tag, name, sec, start_dt, "VSD Inverter Trip", speed, current))
                        self.active_faults[tag] = {
                            "incident_id": inc_id,
                            "start_time": start_dt,
                            "name": name,
                            "section": sec
                        }
                        print(f"[VSD-FAULT-ALARM] TRIP DETECTED on {tag} ({name}) at {start_dt}")
                    except Exception as ex:
                        print(f"[VSD-ANALYTICS] Fault insert error: {ex}")
            else:
                if tag in self.active_faults:
                    # Trip resolved!
                    meta = self.active_faults.pop(tag)
                    end_dt = datetime.now()
                    inc_id = meta.get("incident_id")
                    start_dt = meta.get("start_time", end_dt)
                    dur_sec = max(1, int((end_dt - start_dt).total_seconds()))
                    dur_min = round(dur_sec / 60.0, 2)
                    try:
                        sql = """
                            UPDATE vsd_fault_incidents 
                            SET end_time = %s, duration_seconds = %s, duration_minutes = %s, status = 'RESOLVED'
                            WHERE id = %s
                        """
                        execute_insert(sql, (end_dt, dur_sec, dur_min, inc_id))
                        print(f"[VSD-FAULT-ALARM] TRIP RESOLVED on {tag} ({meta.get('name')}) duration: {dur_min} min")
                    except Exception as ex:
                        print(f"[VSD-ANALYTICS] Fault update error: {ex}")

        # 3. Periodic DB Sync (Every 30 seconds)
        if now - self.last_sync_time > 30.0:
            self.last_sync_time = now
            self.sync_to_database(vsd_fleet, uht_output)

    def sync_to_database(self, vsd_fleet: dict, uht_output: float):
        today = date.today()
        # Sync Maintenance Running Hours
        for tag, sec_total in self.running_seconds_cache.items():
            hours = round(sec_total / 3600.0, 2)
            try:
                # Calculate health % based on interval
                sql = """
                    UPDATE vsd_maintenance_records 
                    SET total_running_seconds = %s,
                        total_running_hours = %s,
                        health_pct = GREATEST(0.0, LEAST(100.0, 100.0 - (((%s - last_pm_hours) / pm_interval_hours) * 100.0))),
                        status = CASE 
                            WHEN (%s - last_pm_hours) >= pm_interval_hours THEN 'OVERDUE'
                            WHEN (%s - last_pm_hours) >= (pm_interval_hours * 0.85) THEN 'DUE_SOON'
                            ELSE 'GOOD'
                        END,
                        last_run_timestamp = NOW()
                    WHERE vsd_tag = %s
                """
                execute_insert(sql, (int(sec_total), hours, hours, hours, hours, tag))
            except Exception as e:
                pass

        # Sync Daily Energy Logs
        total_kwh = sum(self.daily_energy_kwh.values())
        total_cost = total_kwh * ELECTRICITY_RATE_PER_KWH
        cost_per_liter = total_cost / max(1.0, uht_output)

        for tag, kwh in self.daily_energy_kwh.items():
            vsd = vsd_fleet.get(tag, {})
            name = vsd.get("name", tag)
            sec = vsd.get("section", "General")
            cost = kwh * ELECTRICITY_RATE_PER_KWH
            peak_kw = self.peak_power_kw.get(tag, 0.0)

            try:
                sql = """
                    INSERT INTO vsd_energy_logs 
                    (record_date, shift, vsd_tag, vsd_name, section, energy_kwh, cost_thb, cost_per_liter, peak_power_kw, avg_power_kw)
                    VALUES (%s, 'Daily', %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        energy_kwh = VALUES(energy_kwh),
                        cost_thb = VALUES(cost_thb),
                        cost_per_liter = VALUES(cost_per_liter),
                        peak_power_kw = GREATEST(peak_power_kw, VALUES(peak_power_kw))
                """
                execute_insert(sql, (today, tag, name, sec, round(kwh, 3), round(cost, 2), round(cost_per_liter, 4), round(peak_kw, 2), round(peak_kw * 0.7, 2)))
            except Exception:
                pass

    def get_summary_snapshot(self, vsd_fleet: dict, uht_output: float = 85000.0) -> dict:
        """Returns consolidated analytics for live UI & REST APIs"""
        total_kwh = sum(self.daily_energy_kwh.values())
        total_cost_thb = total_kwh * ELECTRICITY_RATE_PER_KWH
        cost_per_liter = total_cost_thb / max(1.0, uht_output)

        energy_by_vsd = []
        for tag, vsd in vsd_fleet.items():
            kwh = round(self.daily_energy_kwh.get(tag, 0.0), 3)
            energy_by_vsd.append({
                "tag": tag,
                "name": vsd.get("name", tag),
                "section": vsd.get("section", ""),
                "rated_kw": vsd.get("rated_kw", 0.0),
                "current_power_kw": vsd.get("power_kw", 0.0),
                "daily_kwh": kwh,
                "daily_cost_thb": round(kwh * ELECTRICITY_RATE_PER_KWH, 2),
                "pct_of_total": round((kwh / total_kwh * 100.0) if total_kwh > 0 else 0.0, 1)
            })

        # Maintenance records
        maint_list = []
        try:
            maint_rows = fetch_all("SELECT * FROM vsd_maintenance_records ORDER BY vsd_tag ASC")
            for r in maint_rows:
                tag = r["vsd_tag"]
                hours = float(r.get("total_running_hours", 0))
                last_pm = float(r.get("last_pm_hours", 0))
                interval = float(r.get("pm_interval_hours", 2000))
                hours_since_pm = hours - last_pm
                hours_remaining = max(0.0, round(interval - hours_since_pm, 1))
                maint_list.append({
                    "tag": tag,
                    "name": r.get("vsd_name"),
                    "section": r.get("section"),
                    "rated_kw": float(r.get("rated_kw", 0)),
                    "total_running_hours": hours,
                    "hours_since_pm": round(hours_since_pm, 1),
                    "hours_remaining": hours_remaining,
                    "health_pct": float(r.get("health_pct", 100.0)),
                    "pm_task": r.get("pm_task_desc"),
                    "status": r.get("status", "GOOD")
                })
        except Exception:
            pass

        # Downtime Pareto Analysis
        pareto_list = []
        total_trip_events = 0
        total_trip_minutes = 0.0
        try:
            pareto_rows = fetch_all("""
                SELECT vsd_tag, vsd_name, section, 
                       COUNT(*) as trip_count, 
                       ROUND(SUM(duration_minutes), 2) as total_downtime_minutes,
                       ROUND(AVG(duration_minutes), 2) as avg_downtime_minutes
                FROM vsd_fault_incidents
                GROUP BY vsd_tag, vsd_name, section
                ORDER BY total_downtime_minutes DESC, trip_count DESC
            """)
            total_trip_events = sum(r["trip_count"] for r in pareto_rows)
            total_trip_minutes = sum(float(r["total_downtime_minutes"] or 0) for r in pareto_rows)

            cumulative_pct = 0.0
            for r in pareto_rows:
                mins = float(r["total_downtime_minutes"] or 0)
                pct = (mins / total_trip_minutes * 100.0) if total_trip_minutes > 0 else 0.0
                cumulative_pct += pct
                pareto_list.append({
                    "tag": r["vsd_tag"],
                    "name": r["vsd_name"],
                    "section": r["section"],
                    "trip_count": r["trip_count"],
                    "downtime_minutes": mins,
                    "pct_of_total_downtime": round(pct, 1),
                    "cumulative_pct": round(min(100.0, cumulative_pct), 1)
                })
        except Exception:
            pass

        return {
            "energy_analytics": {
                "total_daily_kwh": round(total_kwh, 2),
                "total_cost_thb": round(total_cost_thb, 2),
                "electricity_rate": ELECTRICITY_RATE_PER_KWH,
                "cost_per_liter_thb": round(cost_per_liter, 4),
                "by_vsd": energy_by_vsd
            },
            "preventive_maintenance": {
                "overall_fleet_health_pct": round(sum(m["health_pct"] for m in maint_list) / len(maint_list), 1) if maint_list else 100.0,
                "fleet": maint_list
            },
            "fault_pareto": {
                "total_trip_events": total_trip_events,
                "total_downtime_minutes": round(total_trip_minutes, 2),
                "active_trips_count": len(self.active_faults),
                "pareto_items": pareto_list
            }
        }

vsd_analytics = VSDAnalyticsEngine()
