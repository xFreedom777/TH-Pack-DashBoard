import sys
import os
import json

sys.path.append(r'e:\x01-git\xDashBoard\backend')

from app.s7_reader import SiemensPLCReader

# Load parsed_instruments.json to build simulated tags map
with open(r'e:\x01-git\xDashBoard\parsed_instruments.json', 'r', encoding='utf-8') as f:
    instruments = json.load(f)

print(f"Loaded {len(instruments)} instruments from parsed_instruments.json.")

# Construct tags_map matching vw_siemens_plc_db_map structure
tags_map = []
for idx, item in enumerate(instruments, start=1):
    db_str = item.get("Database", "DB1601.DBD0000")
    # Parse DB
    import re
    m = re.match(r'DB(\d+)\.(DBD|DBW|DBX)(\d+)(?:\.(\d+))?', db_str)
    if m:
        db_num = int(m.group(1))
        byte_off = float(int(m.group(3)))
        bit_off = int(m.group(4)) if m.group(4) else 0
    else:
        db_num = 1601
        byte_off = 0.0
        bit_off = 0

    t_type = item.get("Type", "Real")
    fmt = "REAL" if t_type.lower() == "real" else ("BOOL" if t_type.lower() == "bool" else "INT")

    tags_map.append({
        "instrument_id": idx,
        "gateway_name": "Siemens S7-1500 UHT PLC",
        "ip_address": item.get("PLC", "192.168.0.101"),
        "tag_name": item.get("Label", f"TAG_{idx}"),
        "db_number": db_num,
        "byte_offset": byte_off,
        "bit_offset": bit_off,
        "plc_data_format": fmt,
        "scale_raw_min": 0.0,
        "scale_raw_max": 27648.0,
        "scale_eng_min": float(item.get("Min", 0) or 0),
        "scale_eng_max": float(item.get("Max", 100) or 100),
        "engineering_unit": item.get("UOM", ""),
        "description": item.get("Description", "")
    })

reader = SiemensPLCReader(ip="192.168.0.101", rack=0, slot=1)
connected = reader.connect()
print(f"PLC Connection Attempt (192.168.0.101): Connected={connected}")

readings = reader.read_datablock_tags(tags_map)
print(f"\nSuccessfully read/processed telemetry for {len(readings)} instrument tags.")
print("\n--- First 10 Live Readings Sample ---")
for r in readings[:10]:
    print(f"Tag: {r['tag_name']:<10} | DB{r['db_number']}.DBD{r['byte_offset']:<5} | Val: {r['scaled_value']:<8} {r['unit_of_measure']:<5} | Desc: {r['description']}")
