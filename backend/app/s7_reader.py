import os
import time
import random

try:
    import snap7
    from snap7.util import get_real, get_int, get_bool
    HAS_SNAP7 = True
except Exception:
    HAS_SNAP7 = False

class SiemensPLCReader:
    def __init__(self, ip="192.168.0.101", rack=0, slot=1):
        self.ip = os.getenv("PLC_IP_ADDRESS", ip)
        self.rack = int(os.getenv("PLC_RACK", rack))
        self.slot = int(os.getenv("PLC_SLOT", slot))
        self.client = None
        self._connected = False

    @property
    def is_connected(self):
        if self.client and HAS_SNAP7:
            try:
                return bool(self.client.get_connected())
            except Exception:
                return False
        return bool(self._connected)

    def connect(self):
        if not HAS_SNAP7:
            print("python-snap7 not installed or libsnap7.so unavailable; running in SIMULATED Mode.")
            self._connected = False
            return False
        try:
            if self.client:
                try:
                    if self.client.get_connected():
                        self._connected = True
                        return True
                    self.client.disconnect()
                except Exception:
                    pass
            self.client = snap7.client.Client()
            self.client.connect(self.ip, self.rack, self.slot)
            self._connected = bool(self.client.get_connected())
            print(f"Siemens S7 PLC Connection State ({self.ip}): {self._connected}")
            return self._connected
        except Exception as e:
            print(f"Siemens PLC Connection Exception ({self.ip}): {e}. Using SIMULATED mode.")
            self._connected = False
            return False

    def read_datablock_tags(self, tags_map):
        """
        Reads Siemens DataBlock tags.
        tags_map: list of dicts from vw_siemens_plc_db_map
        Returns list of parsed telemetry readouts with tag_name, scaled_value, raw_value, quality.
        """
        results = []

        # Update IP if provided in db_map
        if tags_map and 'ip_address' in tags_map[0]:
            target_ip = tags_map[0]['ip_address']
            if target_ip:
                self.ip = target_ip

        if not self.is_connected or not self.client:
            self.connect()
        else:
            self._connected = self.client.get_connected()

        for tag in tags_map:
            db_num = tag['db_number']
            byte_off = float(tag['byte_offset'])
            bit_off = tag['bit_offset']
            fmt = tag['plc_data_format']
            tag_name = tag['tag_name']

            scale_eng_min = float(tag['scale_eng_min']) if tag.get('scale_eng_min') else 0.0
            scale_eng_max = float(tag['scale_eng_max']) if tag.get('scale_eng_max') else 100.0

            raw_val = 0.0
            scaled_val = 0.0
            digital_val = False
            quality = "GOOD"

            read_success = False

            if self.is_connected and self.client:
                try:
                    # Physical S7 DataBlock byte read
                    size = 4 if fmt == 'REAL' else 2
                    data = self.client.db_read(db_num, int(byte_off), size)
                    if fmt == 'REAL':
                        scaled_val = round(get_real(data, 0), 2)
                        raw_val = scaled_val
                    elif fmt == 'INT':
                        raw_val = float(get_int(data, 0))
                        scaled_val = raw_val
                    elif fmt == 'BOOL':
                        digital_val = get_bool(data, 0, bit_off)
                        scaled_val = 1.0 if digital_val else 0.0
                    read_success = True
                except Exception as err:
                    quality = "BAD"
                    # Check if connection was actually lost
                    if not self.client.get_connected():
                        self._connected = False

            if not read_success and not self.is_connected:
                # Simulated fallback only if PLC is not connected
                if fmt == 'REAL':
                    if 'FT' in tag_name:
                        scaled_val = round(random.uniform(scale_eng_max * 0.65, scale_eng_max * 0.85), 2)
                    elif 'TT' in tag_name or 'TIC' in tag_name:
                        if 'Raw Product' in tag.get('description', ''):
                            scaled_val = round(random.uniform(4.0, 10.0), 2)
                        elif 'Outlet' in tag.get('description', '') or 'Sterile' in tag.get('description', ''):
                            scaled_val = round(138.4 + random.uniform(-0.5, 0.5), 2)
                        else:
                            scaled_val = round(random.uniform(65.0, 95.0), 2)
                    elif 'PT' in tag_name:
                        scaled_val = round(random.uniform(3.5, 8.5), 2)
                    elif 'LT' in tag_name:
                        scaled_val = round(random.uniform(45.0, 75.0), 2)
                    elif 'SX' in tag_name:
                        scaled_val = round(random.uniform(48.0, 50.0), 2)
                    else:
                        scaled_val = round(random.uniform(scale_eng_min, scale_eng_max), 2)
                    raw_val = round(scaled_val * 27648.0 / max(scale_eng_max, 1.0), 2)
                else:
                    if 'HH' in tag_name or 'LL' in tag_name:
                        digital_val = False
                    else:
                        digital_val = True
                    scaled_val = 1.0 if digital_val else 0.0
                    raw_val = scaled_val

            results.append({
                "instrument_id": tag['instrument_id'],
                "tag_name": tag_name,
                "db_number": db_num,
                "byte_offset": byte_off,
                "bit_offset": bit_off,
                "plc_format": fmt,
                "scaled_value": scaled_val,
                "raw_value": raw_val,
                "digital_value": digital_val,
                "unit_of_measure": tag.get("engineering_unit", ""),
                "description": tag.get("description", ""),
                "quality_status": quality
            })

        return results

    def read_custom_tag(self, db_number: int, byte_offset: float, bit_offset: int = 0, plc_format: str = "REAL"):
        """
        Directly reads an arbitrary DB and offset from S7-1500 PLC.
        Formats: REAL, INT, DINT, BOOL, WORD, DWORD.
        """
        if not self.is_connected or not self.client:
            self.connect()

        fmt = (plc_format or "REAL").upper()
        int_byte = int(byte_offset)
        size = 4 if fmt in ('REAL', 'DWORD', 'DINT') else (2 if fmt in ('INT', 'WORD') else 1)

        result = {
            "db_number": db_number,
            "byte_offset": byte_offset,
            "bit_offset": bit_offset,
            "plc_format": fmt,
            "value": None,
            "raw_hex": None,
            "quality": "BAD",
            "error": None
        }

        if not self.is_connected or not self.client:
            result["error"] = "PLC not connected"
            return result

        try:
            data = self.client.db_read(db_number, int_byte, size)
            result["raw_hex"] = data.hex()
            if fmt == 'REAL':
                result["value"] = round(get_real(data, 0), 4)
            elif fmt == 'INT':
                result["value"] = get_int(data, 0)
            elif fmt == 'DINT':
                result["value"] = int.from_bytes(data, byteorder='big', signed=True)
            elif fmt == 'WORD':
                result["value"] = int.from_bytes(data, byteorder='big', signed=False)
            elif fmt == 'DWORD':
                result["value"] = int.from_bytes(data, byteorder='big', signed=False)
            elif fmt == 'BOOL':
                result["value"] = get_bool(data, 0, bit_offset)
            else:
                result["value"] = round(get_real(data, 0), 4)
            result["quality"] = "GOOD"
        except Exception as e:
            result["error"] = str(e)
            result["quality"] = "BAD"
        return result
