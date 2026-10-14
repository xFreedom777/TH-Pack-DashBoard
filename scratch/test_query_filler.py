
from app.database import fetch_all
sql = """
SELECT id, step_int, step_desc, sku_id, sku_name, start_time, stop_time, duration_formatted
FROM process_step_logs
WHERE section = 'cip_line1'
  AND sku_name LIKE '%Filler Machine%'
  AND start_time BETWEEN '2026-10-14 00:00:00' AND '2026-10-14 16:50:00'
ORDER BY id ASC
"""
rows = fetch_all(sql)
print(f"Total rows found for Filler Machine today: {len(rows)}")
for r in rows:
    print(r['id'], r['step_int'], r['step_desc'], r['duration_formatted'], r['start_time'], r['stop_time'])
