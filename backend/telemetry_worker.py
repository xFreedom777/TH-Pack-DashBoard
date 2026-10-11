#!/usr/bin/env python3
"""
TH-PACK INDUSTRIAL TELEMETRY WORKER & AUTO-RECOVER WATCHDOG
==========================================================
Standalone background worker for S7-1500 PLC ingestion,
InfluxDB 2.7 Historian persistence, and MySQL Process Step Tracking.
Decoupled from FastAPI web server to eliminate Single Point of Failure (SPOF).
"""

import os
import sys
import time
import json
import signal
import socket
from datetime import datetime

# Add /app to sys.path so imports work seamlessly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from master_reader import master_reader
    from app.influx_writer import influx_writer
    from app.step_tracker import step_tracker
    from app.vsd_analytics import vsd_analytics
except ImportError:
    # If executed from inside backend directory
    parent_dir = os.path.abspath(os.path.join(current_dir, ".."))
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    from master_reader import master_reader
    from app.influx_writer import influx_writer
    from app.step_tracker import step_tracker
    try:
        from app.vsd_analytics import vsd_analytics
    except ImportError:
        import vsd_analytics

HEARTBEAT_FILE = "/tmp/scada_heartbeat.json"
CACHE_FILE = "/tmp/scada_live_cache.json"
LOG_FILE = "/tmp/scada_worker.log"

running = True
poll_count = 0
consecutive_errors = 0
last_error_msg = ""
start_timestamp = time.time()

def log(msg: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] [WORKER-PID-{os.getpid()}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def handle_signal(sig, frame):
    global running
    log(f"Received shutdown signal {sig}. Exiting gracefully...")
    running = False

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def write_atomic_json(filepath: str, data: dict):
    tmp_path = f"{filepath}.tmp"
    try:
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, default=str)
        os.replace(tmp_path, filepath)
    except Exception as e:
        log(f"Failed to write atomic json to {filepath}: {e}")

def update_heartbeat(status: str, duration_ms: float):
    now = time.time()
    hb = {
        "pid": os.getpid(),
        "status": status,
        "timestamp": now,
        "iso_time": datetime.now().isoformat(),
        "uptime_sec": round(now - start_timestamp, 1),
        "plc_connected": master_reader.is_connected,
        "poll_count": poll_count,
        "consecutive_errors": consecutive_errors,
        "last_duration_ms": round(duration_ms, 2),
        "last_error": last_error_msg
    }
    write_atomic_json(HEARTBEAT_FILE, hb)

def main():
    global poll_count, consecutive_errors, last_error_msg, running

    log("=====================================================")
    log("TH-PACK INDUSTRIAL TELEMETRY WORKER STARTING...")
    log("Decoupled Ingestion Engine (Siemens S7-1500 -> InfluxDB + MySQL)")
    log("=====================================================")

    # Initial connection to PLC
    try:
        master_reader.connect()
        log(f"Initial PLC connection: {'CONNECTED' if master_reader.is_connected else 'CONNECTING...'}")
    except Exception as e:
        log(f"PLC initial connect error: {e}")

    while running:
        tick_start = time.time()
        try:
            # 1. Read all DBs from PLC S7-1500
            telemetry = master_reader.read_all_telemetry()
            
            if telemetry and master_reader.is_connected:
                consecutive_errors = 0
                last_error_msg = ""
                
                # 2. Persist to InfluxDB 2.7 Time-Series Historian
                try:
                    influx_writer.write_master_telemetry(telemetry)
                except Exception as ex_inf:
                    log(f"InfluxDB ingestion warning: {ex_inf}")

                # 3. Process Step Transitions (MySQL process_step_logs)
                try:
                    step_tracker.process_telemetry_tick(telemetry)
                except Exception as ex_step:
                    log(f"Step Tracker warning: {ex_step}")

                # 4. Process VSD Energy, Preventive Maintenance & Fault Pareto
                try:
                    vsd_analytics.process_tick(telemetry)
                    telemetry["vsd_analytics"] = vsd_analytics.get_summary_snapshot(telemetry.get("vsd_fleet", {}))
                except Exception as ex_vsd:
                    log(f"VSD Analytics warning: {ex_vsd}")

                # 5. Atomic cache write for Web consumers & HMI
                write_atomic_json(CACHE_FILE, telemetry)

                poll_count += 1
                duration_ms = (time.time() - tick_start) * 1000.0
                update_heartbeat("HEALTHY", duration_ms)

                if poll_count % 60 == 0:
                    log(f"Heartbeat tick #{poll_count} - Ingestion OK (duration: {duration_ms:.1f}ms)")
            else:
                consecutive_errors += 1
                last_error_msg = "PLC disconnected or returned empty telemetry"
                log(f"Warning: PLC read failed (Attempt #{consecutive_errors})")
                
                # Auto-recovery if connection lost
                if consecutive_errors >= 3 or not master_reader.is_connected:
                    log("Executing Watchdog Auto-Recovery: Re-connecting to Siemens S7-1500...")
                    try:
                        master_reader.disconnect()
                        time.sleep(1.0)
                        master_reader.connect()
                        if master_reader.is_connected:
                            log("Watchdog Auto-Recovery SUCCESS: Re-connected to PLC.")
                            consecutive_errors = 0
                    except Exception as rex:
                        log(f"Watchdog Auto-Recovery reconnect failed: {rex}")

                duration_ms = (time.time() - tick_start) * 1000.0
                update_heartbeat("WARNING_RECONNECTING", duration_ms)

        except Exception as e:
            consecutive_errors += 1
            last_error_msg = str(e)
            log(f"Unhandled exception in telemetry worker loop: {e}")
            duration_ms = (time.time() - tick_start) * 1000.0
            update_heartbeat("FAULT_LOOP_EXCEPTION", duration_ms)

        # Precise 1.0s interval
        elapsed = time.time() - tick_start
        sleep_time = max(0.1, 1.0 - elapsed)
        time.sleep(sleep_time)

    # Clean shutdown
    try:
        master_reader.disconnect()
    except Exception:
        pass
    update_heartbeat("STOPPED", 0)
    log("Telemetry worker stopped cleanly.")

if __name__ == "__main__":
    main()
