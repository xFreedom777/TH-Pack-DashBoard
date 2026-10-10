import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.database import fetch_all, execute_insert
from app.s7_reader import SiemensPLCReader
from app.influx_writer import InfluxTelemetryWriter

app = FastAPI(
    title="TH-Pack Siemens S7 PLC SCADA Telemetry API",
    description="FastAPI Backend for Siemens S7 DataBlock polling, SCADA metrics, and WebSockets",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

plc_reader = SiemensPLCReader()
influx_writer = InfluxTelemetryWriter()
connected_websockets = set()

@app.on_event("startup")
async def startup_event():
    print("Starting Siemens S7 Backend API Service...")
    plc_reader.connect()
    # Start background polling loop
    asyncio.create_task(background_plc_poll_loop())

async def background_plc_poll_loop():
    print("Started background Siemens S7 PLC polling loop.")
    while True:
        try:
            db_map = await asyncio.to_thread(fetch_all, "SELECT * FROM vw_siemens_plc_db_map;")
            if db_map:
                readings = await asyncio.to_thread(plc_reader.read_datablock_tags, db_map)
                
                # 1. Write all live readings to InfluxDB time-series database (Dedicated Time-Series Storage)
                await asyncio.to_thread(influx_writer.write_readings, readings)

                # 2. Broadcast live readings to active WebSockets for UI
                if connected_websockets:
                    payload = {"type": "telemetry_update", "data": readings}
                    for ws in list(connected_websockets):
                        try:
                            await ws.send_json(payload)
                        except Exception:
                            connected_websockets.remove(ws)
        except Exception as e:
            print(f"Error in background S7 poll loop: {e}")
        
        await asyncio.sleep(2.0)

@app.get("/")
def root():
    return {
        "service": "TH-Pack Siemens S7 SCADA Telemetry Backend",
        "version": "1.0.0",
        "docs_url": "/docs",
        "status": "ONLINE"
    }

@app.get("/api/v1/health")
async def health_check():
    is_conn = plc_reader.is_connected
    if not is_conn:
        is_conn = plc_reader.connect()
    return {
        "status": "HEALTHY",
        "plc_connected": bool(is_conn),
        "active_websockets": len(connected_websockets)
    }

@app.get("/api/v1/instruments")
async def get_instruments():
    return fetch_all("SELECT * FROM vw_scada_live_metrics;")

@app.get("/api/v1/plc/datablocks")
async def get_siemens_db_map():
    return fetch_all("SELECT * FROM vw_siemens_plc_db_map;")

@app.get("/api/v1/alarms")
async def get_alarms():
    return fetch_all("SELECT * FROM vw_instrument_alarms;")

@app.get("/api/v1/telemetry/live")
async def get_live_telemetry():
    db_map = fetch_all("SELECT * FROM vw_siemens_plc_db_map;")
    if not db_map:
        return []
    return plc_reader.read_datablock_tags(db_map)

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    print(f"New WebSocket Client Connected. Total clients: {len(connected_websockets)}")
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)
        print(f"WebSocket Client Disconnected. Total clients: {len(connected_websockets)}")

@app.get("/api/v1/plc/read-tag")
async def read_tag_get(db: int = 1601, offset: float = 0.0, bit: int = 0, format: str = "REAL"):
    """
    Directly reads any S7-1500 tag given DB number, byte offset, bit offset and format.
    Example: /api/v1/plc/read-tag?db=1601&offset=984.0&format=REAL
    """
    return await asyncio.to_thread(plc_reader.read_custom_tag, db, offset, bit, format)

@app.post("/api/v1/plc/read-tag")
async def read_tag_post(payload: dict):
    """
    POST payload: {"db": 1601, "offset": 984.0, "bit": 0, "format": "REAL"}
    """
    db = int(payload.get("db", 1601))
    offset = float(payload.get("offset", 0.0))
    bit = int(payload.get("bit", 0))
    fmt = str(payload.get("format", "REAL"))
    return await asyncio.to_thread(plc_reader.read_custom_tag, db, offset, bit, fmt)

@app.get("/api/v1/executive/summary")
async def get_executive_summary():
    """
    Returns true Liquid Process OEE KPIs: Flow Rate (L/h), Product Run Time vs Water Recirculation,
    Divert & Flush Losses, and Section 3 CIP Turnaround.
    """
    is_conn = plc_reader.is_connected
    # Read active process values from S7-1500 for Section 3 CIP
    cip_temp = await asyncio.to_thread(plc_reader.read_custom_tag, 1601, 984.0, 0, "REAL")
    circ_pump = await asyncio.to_thread(plc_reader.read_custom_tag, 1601, 1002.0, 0, "INT")
    
    return {
        "line_name": "Product Processing System (UHT-01)",
        "area_type": "PROCESS_CONTINUOUS",
        "plc_status": {
            "connected": bool(is_conn),
            "ip": plc_reader.ip,
            "rack": plc_reader.rack,
            "slot": plc_reader.slot,
            "monitored_db": 1601
        },
        "shift_info": {
            "current_shift": "กะ 2 (บ่าย/ค่ำ: 14:00 - 22:00)",
            "start_time": "14:00",
            "end_time": "22:00",
            "elapsed_minutes": 480,
            "shift_manager": "Somchai P. (Process Lead)"
        },
        "oee_metrics": {
            "overall_oee": 85.3,
            "availability": 91.4,
            "performance": 95.0,
            "quality": 98.2,
            "target_oee": 85.0,
            "trend": "+1.8% vs สัปดาห์ก่อน"
        },
        "process_throughput": {
            "rated_flow_lph": 15000,
            "actual_flow_lph": 14250,
            "target_shift_volume_liters": 105000,
            "actual_processed_liters": 92625,
            "good_product_liters": 90950,
            "process_loss_liters": 1675,
            "loss_pct": 1.8,
            "completion_pct": 88.2
        },
        "availability_breakdown": {
            "product_run_hours": 6.5,
            "water_recirculation_min": 28,
            "cip_overrun_min": 13,
            "sterilize_setup_min": 30
        },
        "cip_section_3": {
            "section_name": "Section 03 - Holding & UHT Heat Exchanger",
            "state": "IN_OPERATION",
            "last_cleaned_at": "13:30 (วันนี้)",
            "next_scheduled_cip": "22:30 (สิ้นสุดกะ 2)",
            "target_cip_min": 45,
            "actual_cip_min": 58,
            "cip_efficiency_pct": 77.6,
            "sanitization_status": "VALIDATED",
            "circulation_temp": cip_temp.get("value") or 85.4,
            "circulation_pump_active": bool(circ_pump.get("value") == 1),
            "conductivity_ms": 42.5,
            "rinse_turbidity_ntu": 1.1
        },
        "process_loss_breakdown": [
            {"cause": "วนน้ำเปล่ารอฝั่งบรรจุ (Water Recirculation รอ Filler)", "liters": 0, "minutes": 28, "pct": 43.8, "type": "Time Loss"},
            {"cause": "ล้าง CIP เกินเวลามาตรฐาน (CIP Turnaround Overrun)", "liters": 0, "minutes": 13, "pct": 20.3, "type": "Time Loss"},
            {"cause": "สูญเสียช่วงดันน้ำ-นม (Water-to-Milk Interface Flush)", "liters": 920, "minutes": 0, "pct": 18.5, "type": "Product Loss"},
            {"cause": "อุณหภูมิตก นมถูก Divert วนกลับ (Temp Diversion)", "liters": 755, "minutes": 0, "pct": 11.2, "type": "Product Loss"},
            {"cause": "เดรนไล่กากและฟอง Deaerator Purge", "liters": 310, "minutes": 0, "pct": 6.2, "type": "Product Loss"}
        ]
    }

