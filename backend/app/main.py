import os
import time

# Enforce Asia/Bangkok (+07:00) timezone for all logging and datetimes
os.environ["TZ"] = "Asia/Bangkok"
if hasattr(time, "tzset"):
    time.tzset()

import asyncio
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from master_reader import master_reader
from app.influx_writer import influx_writer
from app.step_tracker import step_tracker
from app.report_generator import generate_step_report_html
from app.database import fetch_all, execute_insert

app = FastAPI(
    title="xDev.CO.LTD Siemens S7 Industrial Plant Operations Intelligence API",
    description="Real-time SCADA telemetry, 1-Year Historian & Process Step Log Report for UHT, ATANK, CIP 1/2, Prod Supply & Sinamics G120C VSD Fleet",
    version="2.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
import sys
import json
import subprocess

HEARTBEAT_FILE = "/tmp/scada_heartbeat.json"
CACHE_FILE = "/tmp/scada_live_cache.json"

connected_websockets = set()
cached_telemetry = {}
worker_proc: Optional[subprocess.Popen] = None

def spawn_worker():
    global worker_proc
    worker_paths = [
        "/app/telemetry_worker.py",
        "/app/app/telemetry_worker.py",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "telemetry_worker.py"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "telemetry_worker.py")
    ]
    target_path = None
    for p in worker_paths:
        if os.path.exists(p):
            target_path = p
            break

    if not target_path:
        print(f"[WATCHDOG-ALARM] Telemetry Worker script not found in {worker_paths}")
        return False

    # Check if a live worker is already beating
    if os.path.exists(HEARTBEAT_FILE):
        try:
            with open(HEARTBEAT_FILE, "r") as f:
                hb = json.load(f)
                hb_time = hb.get("timestamp", 0)
                pid = hb.get("pid")
                if (time.time() - hb_time) < 8.0 and pid:
                    try:
                        os.kill(pid, 0)
                        print(f"[WATCHDOG] Worker PID {pid} is already active and healthy.")
                        return True
                    except OSError:
                        pass
        except Exception:
            pass

    try:
        log_f = open("/tmp/scada_worker.log", "a")
        cwd = "/app" if os.path.exists("/app") else os.path.dirname(target_path)
        worker_proc = subprocess.Popen(
            [sys.executable, target_path],
            stdout=log_f,
            stderr=log_f,
            cwd=cwd
        )
        print(f"[WATCHDOG] Telemetry Worker successfully spawned with PID {worker_proc.pid}")
        return True
    except Exception as e:
        print(f"[WATCHDOG-ERROR] Failed to spawn worker: {e}")
        return False

@app.on_event("startup")
async def startup_event():
    print("==================================================================")
    print("xDev.CO.LTD INDUSTRIAL SCADA API GATEWAY & SUPERVISOR INITIALIZING...")
    print("Target Node: Siemens S7-1500 PLC (192.168.1.11:102)")
    print("==================================================================")
    # 1. Spawn / Verify Telemetry Ingestion Worker
    spawn_worker()
    # 2. Start Supervisor Watchdog Task
    asyncio.create_task(watchdog_supervisor())
    # 3. Start Cache Broadcast Task
    asyncio.create_task(background_telemetry_broadcast_loop())

async def watchdog_supervisor():
    """
    Industrial Watchdog Supervisor Task:
    Monitors Telemetry Worker Heartbeat every 5 seconds.
    Auto-recovers and respawns worker if heartbeat > 10 seconds or process dies.
    """
    await asyncio.sleep(2.0)
    while True:
        try:
            now = time.time()
            stale = True
            if os.path.exists(HEARTBEAT_FILE):
                try:
                    with open(HEARTBEAT_FILE, "r") as f:
                        hb = json.load(f)
                        hb_time = hb.get("timestamp", 0)
                        pid = hb.get("pid")
                        if (now - hb_time) < 10.0:
                            stale = False
                            if pid:
                                try:
                                    os.kill(pid, 0)
                                except OSError:
                                    stale = True
                except Exception:
                    stale = True

            if stale:
                print("[WATCHDOG-ALARM] Telemetry worker heartbeat missing or dead! Triggering Auto-Recovery...")
                spawn_worker()
        except Exception as e:
            print(f"[WATCHDOG] Supervisor loop error: {e}")

        await asyncio.sleep(5.0)

async def background_telemetry_broadcast_loop():
    """
    High-Performance Consumer & WebSocket Broadcast Loop:
    Reads atomic cache file /tmp/scada_live_cache.json at 1 Hz.
    Decoupled from S7comm socket & InfluxDB writes.
    """
    global cached_telemetry
    while True:
        try:
            if os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data:
                            cached_telemetry = data
                except Exception:
                    pass

            # Fallback if worker cache not yet ready
            if not cached_telemetry:
                try:
                    cached_telemetry = await asyncio.to_thread(master_reader.read_all_telemetry)
                except Exception:
                    pass

            # Broadcast to UI clients
            if connected_websockets and cached_telemetry:
                payload = {"type": "plant_telemetry", "data": cached_telemetry}
                for ws in list(connected_websockets):
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        connected_websockets.discard(ws)
        except Exception as e:
            print(f"Broadcast loop error: {e}")

        await asyncio.sleep(1.0)

@app.get("/")
def root():
    hb = {}
    if os.path.exists(HEARTBEAT_FILE):
        try:
            with open(HEARTBEAT_FILE, "r") as f:
                hb = json.load(f)
        except Exception:
            pass
    return {
        "service": "xDev.CO.LTD Master SCADA Operations Intelligence API Gateway",
        "plant": "RUNGSAPPATTANA (THAILAND) CO., LTD.",
        "plc_host": "192.168.1.11:102",
        "status": "ONLINE",
        "worker_status": hb.get("status", "INITIALIZING"),
        "worker_pid": hb.get("pid"),
        "plc_connected": hb.get("plc_connected", False),
        "uptime_sec": hb.get("uptime_sec", 0),
        "poll_count": hb.get("poll_count", 0),
        "active_websockets": len(connected_websockets)
    }

@app.get("/api/v1/health")
def health_check():
    worker_info = {
        "status": "UNKNOWN",
        "pid": None,
        "uptime_sec": 0,
        "poll_count": 0,
        "last_heartbeat_ago_sec": None,
        "plc_connected": False,
        "last_duration_ms": 0,
        "last_error": ""
    }
    if os.path.exists(HEARTBEAT_FILE):
        try:
            with open(HEARTBEAT_FILE, "r") as f:
                hb = json.load(f)
                worker_info = hb
                worker_info["last_heartbeat_ago_sec"] = round(time.time() - hb.get("timestamp", 0), 2)
        except Exception:
            pass

    overall_status = "HEALTHY"
    if worker_info.get("last_heartbeat_ago_sec") is None or worker_info.get("last_heartbeat_ago_sec") > 10:
        overall_status = "WARNING_WORKER_HEARTBEAT_TIMEOUT"
    elif not worker_info.get("plc_connected", False):
        overall_status = "WARNING_PLC_DISCONNECTED"

    return {
        "status": overall_status,
        "system": "xDev.CO.LTD Industrial SCADA (RUNGSAPPATTANA Plant)",
        "plc_host": "192.168.1.11:102",
        "worker": worker_info,
        "active_websockets": len(connected_websockets),
        "timestamp": time.time()
    }

@app.get("/api/v1/telemetry/live_full")
def get_live_full():
    global cached_telemetry
    if not cached_telemetry and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cached_telemetry = json.load(f)
        except Exception:
            pass
    if not cached_telemetry:
        cached_telemetry = master_reader.read_all_telemetry()
    return cached_telemetry

@app.get("/api/v1/telemetry/live")
def get_live_compat():
    return get_live_full()

@app.get("/api/v1/telemetry/history")
async def get_telemetry_history(
    section: str = Query("uht", description="Process section: uht, atank, cip, prod"),
    range: str = Query("1d", description="Time range: 1h, 6h, 1d, 7d, 30d, 1y"),
    window: Optional[str] = Query(None, description="Custom aggregation window, e.g. 1m, 5m, 1h"),
    from_time: Optional[str] = Query(None, description="Start datetime ISO or YYYY-MM-DDTHH:MM"),
    to_time: Optional[str] = Query(None, description="End datetime ISO or YYYY-MM-DDTHH:MM")
):
    """
    Industrial Historian Historical Telemetry API
    Returns downsampled time-series using InfluxDB aggregateWindow.
    Supports preset ranges and exact From/To date-time intervals.
    """
    return await asyncio.to_thread(influx_writer.query_history, section, range, window, from_time, to_time)

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    if cached_telemetry:
        try:
            await websocket.send_json({"type": "plant_telemetry", "data": cached_telemetry})
        except Exception:
            pass
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.discard(websocket)

@app.get("/api/v1/executive/summary")
def get_executive_summary():
    global cached_telemetry
    if not cached_telemetry:
        cached_telemetry = master_reader.read_all_telemetry()
    return cached_telemetry.get("executive_kpis", {})

@app.get("/api/v1/process_summary/today")
def get_today_process_summary():
    """
    Returns live aggregated process metrics from MySQL process_step_logs:
    - today_prod_liters (UHT production steps 28-42)
    - today_water_liters (Utility & flushes)
    - today_ccp_violations
    - today_total_steps
    - compliance_pct
    """
    try:
        query = """
        SELECT 
            COALESCE(SUM(CASE WHEN step_int BETWEEN 28 AND 42 THEN (flow_avg * duration_sec / 3600.0) ELSE 0 END), 0) as prod_liters,
            COALESCE(SUM(CASE WHEN step_int NOT BETWEEN 28 AND 42 AND flow_avg > 0 THEN (flow_avg * duration_sec / 3600.0) ELSE 0 END), 0) as water_used_liters,
            COUNT(CASE WHEN validation_result = 'FAIL' OR (temp_primary_min < 137.0 AND step_int BETWEEN 18 AND 40) THEN 1 END) as ccp_violations,
            COUNT(*) as total_steps
        FROM process_step_logs
        WHERE section = 'uht' AND DATE(start_time) = CURDATE();
        """
        rows = fetch_all(query)
        row = rows[0] if rows else {}

        prod_liters = round(float(row.get("prod_liters", 0)), 1)
        water_liters = round(float(row.get("water_used_liters", 0)), 1)
        ccp_violations = int(row.get("ccp_violations", 0))
        total_steps = int(row.get("total_steps", 0))

        compliance_pct = round(max(0.0, 100.0 - (ccp_violations * 10.0)), 1) if ccp_violations > 0 else 100.0

        return {
            "status": "success",
            "prod_liters": prod_liters,
            "water_used_liters": water_liters,
            "ccp_violations": ccp_violations,
            "compliance_pct": compliance_pct,
            "total_steps": total_steps
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "prod_liters": 0.0,
            "water_used_liters": 0.0,
            "ccp_violations": 0,
            "compliance_pct": 100.0,
            "total_steps": 0
        }

# =========================================================================
# PROCESS STEP LOGS & OFFICIAL REPORT GENERATION APIS
# =========================================================================

@app.get("/api/v1/process_logs")
def get_process_logs(
    section: Optional[str] = Query(None, description="Process section filter: uht, atank, cip_line1, cip_line2"),
    date_filter: Optional[str] = Query(None, description="Date filter YYYY-MM-DD"),
    from_time: Optional[str] = Query(None, description="From datetime YYYY-MM-DDTHH:MM"),
    to_time: Optional[str] = Query(None, description="To datetime YYYY-MM-DDTHH:MM"),
    batch_id: Optional[str] = Query(None, description="Batch reference filter"),
    limit: int = Query(100, description="Max records to return")
):
    """
    Retrieves recorded process step execution logs with start/stop stamps and sensor averages.
    Supports filtering by exact From / To time intervals.
    """
    where_clauses = []
    params = []

    if section:
        where_clauses.append("section = %s")
        params.append(section)
    if from_time and to_time:
        where_clauses.append("start_time BETWEEN %s AND %s")
        params.extend([from_time.replace("T", " "), to_time.replace("T", " ")])
    elif from_time:
        where_clauses.append("start_time >= %s")
        params.append(from_time.replace("T", " "))
    elif to_time:
        where_clauses.append("start_time <= %s")
        params.append(to_time.replace("T", " "))
    elif date_filter:
        where_clauses.append("DATE(start_time) = %s")
        params.append(date_filter)
    if batch_id:
        where_clauses.append("batch_id = %s")
        params.append(batch_id)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    sql = f"""
    SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
           start_time, stop_time, duration_sec, duration_formatted, status, validation_result,
           validation_note, temp_primary_avg, temp_primary_min, temp_primary_max,
           temp_secondary_avg, pressure_avg, flow_avg, conductivity_avg, level_avg,
           sensor_summary_json, operator_name, created_at
    FROM process_step_logs
    {where_sql}
    ORDER BY id ASC
    LIMIT %s
    """
    params.append(limit)
    rows = fetch_all(sql, tuple(params))
    return {
        "status": "success",
        "count": len(rows),
        "section": section,
        "logs": rows
    }

@app.get("/api/v1/process_logs/report", response_class=HTMLResponse)
def get_process_step_report(
    section: str = Query("uht", description="Section: uht, atank, cip_line1, cip_line2"),
    date_filter: Optional[str] = Query(None, description="Date filter YYYY-MM-DD"),
    from_time: Optional[str] = Query(None, description="From datetime YYYY-MM-DDTHH:MM"),
    to_time: Optional[str] = Query(None, description="To datetime YYYY-MM-DDTHH:MM"),
    batch_id: Optional[str] = Query(None, description="Batch reference filter"),
    route: Optional[str] = Query(None, description="Filter by Route, e.g. Filler Machine, Prepare Chemical, Aseptic Tank"),
    exclude_standby: bool = Query(False, description="Exclude Step 0 (System Standby)")
):
    """
    Generates an official A4 Portrait HTML/PDF Print report with Start/Stop time stamps,
    durations, and validated process parameters matching the GMP/BMR factory standard.
    """
    where_clauses = ["section = %s"]
    params = [section]

    if route and route.strip() and route.strip().lower() != 'all':
        where_clauses.append("sku_name LIKE %s")
        params.append(f"%{route.strip()}%")

    if exclude_standby:
        where_clauses.append("step_int > 0")

    if from_time and to_time:
        where_clauses.append("start_time BETWEEN %s AND %s")
        params.extend([from_time.replace("T", " "), to_time.replace("T", " ")])
    elif from_time:
        where_clauses.append("start_time >= %s")
        params.append(from_time.replace("T", " "))
    elif to_time:
        where_clauses.append("start_time <= %s")
        params.append(to_time.replace("T", " "))
    elif date_filter:
        where_clauses.append("DATE(start_time) = %s")
        params.append(date_filter)
    else:
        # Default to today's date if no time range or date is specified
        today_str = datetime.now().strftime("%Y-%m-%d")
        where_clauses.append("DATE(start_time) = %s")
        params.append(today_str)

    if batch_id and batch_id.strip() and batch_id.strip() not in ('-', 'all', 'none', 'null'):
        where_clauses.append("batch_id = %s")
        params.append(batch_id.strip())

    where_sql = "WHERE " + " AND ".join(where_clauses)
    sql = f"""
    SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
           start_time, stop_time, duration_sec, duration_formatted, status, validation_result,
           validation_note, temp_primary_avg, temp_primary_min, temp_primary_max,
           temp_secondary_avg, pressure_avg, flow_avg, conductivity_avg, level_avg,
           sensor_summary_json, operator_name, created_at
    FROM process_step_logs
    {where_sql}
    ORDER BY start_time ASC, id ASC
    LIMIT 500
    """
    rows = fetch_all(sql, tuple(params))
    
    # If no data found for today, query the latest available date for this section
    if not rows and not from_time and not to_time and not date_filter:
        latest_date_row = fetch_all(
            "SELECT DATE(start_time) as d FROM process_step_logs WHERE section = %s ORDER BY start_time DESC LIMIT 1",
            (section,)
        )
        if latest_date_row and latest_date_row[0].get("d"):
            latest_d = str(latest_date_row[0]["d"])
            fb_where = ["section = %s", "DATE(start_time) = %s"]
            fb_params = [section, latest_d]
            if route and route.strip() and route.strip().lower() != 'all':
                fb_where.append("sku_name LIKE %s")
                fb_params.append(f"%{route.strip()}%")
            if exclude_standby:
                fb_where.append("step_int > 0")
            fallback_sql = f"""
            SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
                   start_time, stop_time, duration_sec, duration_formatted, status, validation_result,
                   validation_note, temp_primary_avg, temp_primary_min, temp_primary_max,
                   temp_secondary_avg, pressure_avg, flow_avg, conductivity_avg, level_avg,
                   sensor_summary_json, operator_name, created_at
            FROM process_step_logs
            WHERE {" AND ".join(fb_where)}
            ORDER BY start_time ASC, id ASC
            LIMIT 500
            """
            rows = fetch_all(fallback_sql, tuple(fb_params))
            date_filter = latest_d

    if from_time and to_time:
        target_date = f"{from_time.replace('T', ' ')} ถึง {to_time.replace('T', ' ')}"
    elif date_filter:
        target_date = date_filter
    else:
        target_date = datetime.now().strftime("%d/%m/%Y")
    target_batch = batch_id or (rows[0]["batch_id"] if rows else "P" + datetime.now().strftime("%y%m%d") + "-01")

    report_meta = {"batch_id": target_batch}
    if route and route.strip() and route.strip().lower() != 'all':
        report_meta["route_desc"] = route.strip()
        report_meta["route_name"] = route.strip()

    html_content = generate_step_report_html(
        section=section,
        batch_id=target_batch,
        date_str=target_date,
        steps=rows,
        meta=report_meta
    )
    return HTMLResponse(content=html_content, status_code=200)



# =========================================================================
# VSD ENERGY, PREVENTIVE MAINTENANCE & FAULT PARETO APIS
# =========================================================================

@app.get("/api/v1/vsd/energy")
def get_vsd_energy(
    date_filter: Optional[str] = Query(None, description="Date filter YYYY-MM-DD")
):
    """
    Returns VSD Energy Consumption, Electricity Cost (THB),
    and Energy Cost per Liter for all 8 Inverter Motors.
    """
    # Check cache first for real-time live data
    global cached_telemetry
    if cached_telemetry and "vsd_analytics" in cached_telemetry:
        return cached_telemetry["vsd_analytics"]["energy_analytics"]
    
    # Fallback to MySQL
    target_d = date_filter or date.today().isoformat()
    rows = fetch_all("""
        SELECT vsd_tag, vsd_name, section, energy_kwh, cost_thb, cost_per_liter, peak_power_kw
        FROM vsd_energy_logs
        WHERE record_date = %s
        ORDER BY energy_kwh DESC
    """, (target_d,))

    total_kwh = sum(float(r["energy_kwh"]) for r in rows) if rows else 0.0
    total_cost = sum(float(r["cost_thb"]) for r in rows) if rows else 0.0

    return {
        "date": target_d,
        "total_daily_kwh": round(total_kwh, 2),
        "total_cost_thb": round(total_cost, 2),
        "electricity_rate": 4.20,
        "cost_per_liter_thb": round(rows[0]["cost_per_liter"], 4) if rows else 0.007,
        "by_vsd": rows
    }

@app.get("/api/v1/vsd/maintenance")
def get_vsd_maintenance():
    """
    Returns Operating Hours, PM Countdown, and Health % of all 8 VSD Motors.
    """
    global cached_telemetry
    if cached_telemetry and "vsd_analytics" in cached_telemetry:
        return cached_telemetry["vsd_analytics"]["preventive_maintenance"]

    rows = fetch_all("SELECT * FROM vsd_maintenance_records ORDER BY vsd_tag ASC")
    fleet = []
    for r in rows:
        hrs = float(r.get("total_running_hours", 0))
        last_pm = float(r.get("last_pm_hours", 0))
        interval = float(r.get("pm_interval_hours", 2000))
        since_pm = hrs - last_pm
        rem = max(0.0, round(interval - since_pm, 1))
        fleet.append({
            "tag": r["vsd_tag"],
            "name": r["vsd_name"],
            "section": r["section"],
            "rated_kw": float(r["rated_kw"]),
            "total_running_hours": hrs,
            "hours_since_pm": round(since_pm, 1),
            "hours_remaining": rem,
            "health_pct": float(r["health_pct"]),
            "pm_task": r["pm_task_desc"],
            "status": r["status"]
        })

    avg_health = round(sum(f["health_pct"] for f in fleet) / len(fleet), 1) if fleet else 100.0
    return {
        "overall_fleet_health_pct": avg_health,
        "fleet": fleet
    }

@app.post("/api/v1/vsd/maintenance/reset")
def reset_vsd_maintenance(
    vsd_tag: str = Query(..., description="VSD Tag e.g. VSD01"),
    technician_name: str = Query("Piyapong EE", description="Name of maintenance technician")
):
    """
    Resets PM counter after maintenance service is completed.
    """
    row = fetch_all("SELECT total_running_hours, pm_interval_hours FROM vsd_maintenance_records WHERE vsd_tag = %s", (vsd_tag,))
    if not row:
        return {"status": "error", "message": f"VSD {vsd_tag} not found"}

    curr_hrs = float(row[0]["total_running_hours"])
    interval = float(row[0]["pm_interval_hours"])
    next_hrs = curr_hrs + interval

    execute_insert("""
        UPDATE vsd_maintenance_records
        SET last_pm_hours = %s,
            next_pm_hours = %s,
            health_pct = 100.00,
            status = 'GOOD'
        WHERE vsd_tag = %s
    """, (curr_hrs, next_hrs, vsd_tag))

    return {
        "status": "success",
        "vsd_tag": vsd_tag,
        "reset_at_hours": curr_hrs,
        "next_pm_due_hours": next_hrs,
        "technician": technician_name
    }

@app.get("/api/v1/vsd/fault_pareto")
def get_vsd_fault_pareto():
    """
    Returns Pareto Analysis of VSD Inverter Fault Trips (80/20 Rule)
    Categorized strictly by hardware VSD alarms to prevent false alarms during plant breaks.
    """
    global cached_telemetry
    if cached_telemetry and "vsd_analytics" in cached_telemetry:
        return cached_telemetry["vsd_analytics"]["fault_pareto"]

    rows = fetch_all("""
        SELECT vsd_tag, vsd_name, section, 
               COUNT(*) as trip_count, 
               ROUND(SUM(duration_minutes), 2) as total_downtime_minutes,
               ROUND(AVG(duration_minutes), 2) as avg_downtime_minutes
        FROM vsd_fault_incidents
        GROUP BY vsd_tag, vsd_name, section
        ORDER BY total_downtime_minutes DESC, trip_count DESC
    """)

    total_events = sum(r["trip_count"] for r in rows)
    total_mins = sum(float(r["total_downtime_minutes"] or 0) for r in rows)

    pareto_items = []
    cum_pct = 0.0
    for r in rows:
        mins = float(r["total_downtime_minutes"] or 0)
        pct = (mins / total_mins * 100.0) if total_mins > 0 else 0.0
        cum_pct += pct
        pareto_items.append({
            "tag": r["vsd_tag"],
            "name": r["vsd_name"],
            "section": r["section"],
            "trip_count": r["trip_count"],
            "downtime_minutes": mins,
            "pct_of_total_downtime": round(pct, 1),
            "cumulative_pct": round(min(100.0, cum_pct), 1)
        })

    return {
        "total_trip_events": total_events,
        "total_downtime_minutes": round(total_mins, 2),
        "active_trips_count": 0,
        "pareto_items": pareto_items
    }


