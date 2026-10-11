import asyncio
import time
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
    title="TH-Pack Siemens S7 Industrial Plant Operations Intelligence API",
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

connected_websockets = set()
cached_telemetry = {}

@app.on_event("startup")
async def startup_event():
    print("Starting TH-Pack Industrial SCADA Master Reader, Historian & Step Tracker Service...")
    master_reader.connect()
    asyncio.create_task(background_plc_poll_loop())

async def background_plc_poll_loop():
    global cached_telemetry
    while True:
        try:
            telemetry = master_reader.read_all_telemetry()
            cached_telemetry = telemetry
            
            if telemetry:
                # 1. Persist to InfluxDB Time-Series Historian (1Hz)
                await asyncio.to_thread(influx_writer.write_master_telemetry, telemetry)
                
                # 2. Watch for Step Transitions & Record Start/Stop Timestamps
                await asyncio.to_thread(step_tracker.process_telemetry_tick, telemetry)

            # 3. Broadcast live state to active WebSockets for UI
            if connected_websockets:
                payload = {"type": "plant_telemetry", "data": telemetry}
                for ws in list(connected_websockets):
                    try:
                        await ws.send_json(payload)
                    except Exception:
                        connected_websockets.discard(ws)
        except Exception as e:
            print(f"Background poll error: {e}")
        
        await asyncio.sleep(1.0)

@app.get("/")
def root():
    return {
        "service": "TH-Pack Master SCADA Operations Intelligence API",
        "plc_host": "192.168.1.11:102",
        "status": "ONLINE",
        "historian_status": "ONLINE",
        "step_tracker_status": "ONLINE",
        "plc_connected": master_reader.is_connected,
        "active_websockets": len(connected_websockets)
    }

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "HEALTHY",
        "plc_connected": master_reader.is_connected,
        "active_websockets": len(connected_websockets),
        "timestamp": time.time()
    }

@app.get("/api/v1/telemetry/live_full")
def get_live_full():
    global cached_telemetry
    if not cached_telemetry:
        cached_telemetry = master_reader.read_all_telemetry()
    return cached_telemetry

@app.get("/api/v1/telemetry/live")
def get_live_compat():
    global cached_telemetry
    if not cached_telemetry:
        cached_telemetry = master_reader.read_all_telemetry()
    return cached_telemetry

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
           operator_name, created_at
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
    batch_id: Optional[str] = Query(None, description="Batch reference filter")
):
    """
    Generates an official A4 Portrait HTML/PDF Print report with Start/Stop time stamps,
    durations, and validated process parameters matching the GMP/BMR factory standard.
    """
    where_clauses = ["section = %s"]
    params = [section]

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

    where_sql = "WHERE " + " AND ".join(where_clauses)
    sql = f"""
    SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
           start_time, stop_time, duration_sec, duration_formatted, status, validation_result,
           validation_note, temp_primary_avg, temp_primary_min, temp_primary_max,
           temp_secondary_avg, pressure_avg, flow_avg, conductivity_avg, level_avg,
           operator_name, created_at
    FROM process_step_logs
    {where_sql}
    ORDER BY id ASC
    LIMIT 100
    """
    rows = fetch_all(sql, tuple(params))
    
    # If no data found for today, check without date filter to provide the latest records
    if not rows:
        fallback_sql = f"""
        SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
               start_time, stop_time, duration_sec, duration_formatted, status, validation_result,
               validation_note, temp_primary_avg, temp_primary_min, temp_primary_max,
               temp_secondary_avg, pressure_avg, flow_avg, conductivity_avg, level_avg,
               operator_name, created_at
        FROM process_step_logs
        WHERE section = %s
        ORDER BY id DESC
        LIMIT 25
        """
        rows = list(reversed(fetch_all(fallback_sql, (section,))))

    if from_time and to_time:
        target_date = f"{from_time.replace('T', ' ')} ถึง {to_time.replace('T', ' ')}"
    else:
        target_date = date_filter or datetime.now().strftime("%d/%m/%Y")
    target_batch = batch_id or (rows[0]["batch_id"] if rows else "P" + datetime.now().strftime("%y%m%d") + "-01")

    html_content = generate_step_report_html(
        section=section,
        batch_id=target_batch,
        date_str=target_date,
        steps=rows,
        meta={"batch_id": target_batch}
    )
    return HTMLResponse(content=html_content, status_code=200)

@app.post("/api/v1/process_logs/seed_demo")
def seed_demo_step_logs():
    """
    Utility endpoint to populate realistic step history for UHT, ATANK, and CIP
    matching standard factory sequences so reports can be previewed immediately.
    """
    base_time = datetime.now() - timedelta(minutes=45)
    batch_ref = "P" + datetime.now().strftime("%y%m%d") + "-UHT-01"

    uht_seq = [
        (2, "Standby Wait to Start", 10, 10, 25.5, 0.0, 0.5),
        (6, "Flush-01 Water Rinse", 10, 15, 28.0, 1200.0, 1.2),
        (10, "Flush Process Circulation", 600, 600, 55.4, 2500.0, 1.4),
        (14, "Heating Step 1 (Regeneration)", 5, 120, 85.2, 2800.0, 1.5),
        (16, "Heating Step 2 (Sterile Target)", 5, 180, 138.5, 3000.0, 1.5),
        (18, "Sterile Timer (Sterilization Hold)", 1800, 1800, 140.2, 3000.0, 1.5),
        (20, "Cool Down Step 1", 300, 300, 80.5, 3000.0, 1.5),
        (24, "Water Production Mode", 120, 180, 30.2, 3000.0, 1.5),
        (28, "Start Production (Product Intake)", 3, 120, 28.5, 3000.0, 1.5),
        (30, "Product Push Water To Drain", 1, 45, 28.4, 3000.0, 1.5)
    ]

    curr_t = base_time
    inserted = 0
    for s_int, desc, sp, dur, tt, fl, lt in uht_seq:
        st = curr_t
        et = curr_t + timedelta(seconds=dur)
        curr_t = et
        dur_fmt = f"{dur//3600:02d}:{(dur%3600)//60:02d}:{dur%60:02d}"
        val_res = "OK"

        sql = """
        INSERT INTO process_step_logs (
            section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
            start_time, stop_time, duration_sec, duration_formatted, status,
            validation_result, validation_note, temp_primary_avg, temp_primary_min,
            temp_primary_max, flow_avg, level_avg, operator_name
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        params = (
            "uht", batch_ref, "SKU-UHT-200ML", "UHT Fresh Milk 200ml", s_int, desc, sp,
            st, et, dur, dur_fmt, "COMPLETED",
            val_res, "Verified compliant", tt, tt - 0.2, tt + 0.3, fl, lt, "cj"
        )
    # ATANK Sequence matching exact TIA Portal Text list entries
    atk_seq = [
        (2, "Standby Wait to Start", 5, 10, 25.0, 0.05, 0.0),
        (4, "Empty Tank", 5, 20, 26.1, 0.08, 0.0),
        (6, "Air Pluge 01", 10, 30, 28.5, 0.50, 0.0),
        (8, "Drain Air 01", 10, 25, 30.2, 0.20, 0.0),
        (10, "Air Pluge 02", 10, 30, 45.0, 0.80, 0.0),
        (12, "Drain Air 02", 10, 25, 48.1, 0.30, 0.0),
        (14, "Air Pluge 03", 10, 30, 85.0, 1.20, 0.0),
        (16, "Drain Air 03", 10, 25, 95.0, 0.50, 0.0),
        (18, "Sterile Timer", 1800, 1800, 133.5, 1.95, 0.0),
        (20, "Cool Down Step 1", 5, 180, 65.0, 1.90, 0.0),
        (22, "Cool Down Step 2", 5, 180, 30.5, 1.85, 0.0),
        (24, "Condensate Drain 01", 10, 60, 28.0, 1.80, 0.0),
        (26, "Condensate Drain 02", 10, 60, 28.0, 1.80, 0.0),
        (28, "Ready Production", 5, 120, 28.0, 1.80, 0.0),
        (30, "Production", 0, 900, 28.2, 1.82, 85.5)
    ]

    atk_ref = "P" + datetime.now().strftime("%y%m%d") + "-ATANK-01"
    curr_t = base_time
    for s_int, desc, sp, dur, tt, pt, lc in atk_seq:
        st = curr_t
        et = curr_t + timedelta(seconds=dur)
        curr_t = et
        dur_fmt = f"{dur//3600:02d}:{(dur%3600)//60:02d}:{dur%60:02d}"
        val_res = "OK"

        sql = """
        INSERT INTO process_step_logs (
            section, batch_id, sku_id, sku_name, step_int, step_desc, step_setpoint,
            start_time, stop_time, duration_sec, duration_formatted, status,
            validation_result, validation_note, temp_primary_avg, temp_primary_min,
            temp_primary_max, pressure_avg, level_avg, operator_name
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s, %s, %s
        )
        """
        params = (
            "atank", atk_ref, "SKU-UHT-200ML", "UHT Fresh Milk 200ml", s_int, desc, sp,
            st, et, dur, dur_fmt, "COMPLETED",
            val_res, "Aseptic integrity compliant", tt, tt - 0.2, tt + 0.3, pt, lc, "cj"
        )
        execute_insert(sql, params)
        inserted += 1

    return {"status": "success", "inserted": inserted, "batch_id": batch_ref}
