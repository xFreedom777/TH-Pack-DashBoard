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
