
import json
from app.database import fetch_all
rows = fetch_all("SELECT id, section, batch_id, sku_id, sku_name, step_int, step_desc, start_time, stop_time, duration_formatted FROM process_step_logs WHERE section='cip_line1' ORDER BY id DESC LIMIT 25")
for r in rows:
    print(f"{r['id']} | {r['start_time']} - {r['stop_time']} | {r['duration_formatted']} | {r['sku_id']} | {r['sku_name']} | Step {r['step_int']}: {r['step_desc']}")

routes = fetch_all("SELECT DISTINCT sku_name FROM process_step_logs WHERE section IN ('cip_line1', 'cip_line2')")
print("\n=== DISTINCT ROUTES IN DB ===")
for r in routes:
    print(r)
