-- ==========================================================================
-- SIEMENS S7 PLC DATABLOCK-AWARE SCADA DATABASE INITIALIZATION
-- Source File: UHT-InstruementList.xlsx (Updated 80 Instruments)
-- Target PLC IP: 192.168.0.101
-- ==========================================================================

CREATE DATABASE IF NOT EXISTS thpack_dashboard DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE thpack_dashboard;

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS vw_siemens_plc_db_map;
DROP VIEW IF EXISTS vw_scada_live_metrics;
DROP VIEW IF EXISTS vw_instrument_alarms;
DROP VIEW IF EXISTS vw_instruments_full_spec;
DROP VIEW IF EXISTS vw_scada_dashboard_tags;
DROP TABLE IF EXISTS telemetry_readings;
DROP TABLE IF EXISTS alarm_configurations;
DROP TABLE IF EXISTS process_instruments;
DROP TABLE IF EXISTS sensor_hardware_catalog;
DROP TABLE IF EXISTS instrument_groups;
DROP TABLE IF EXISTS plc_gateways;
DROP TABLE IF EXISTS process_areas;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE process_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_code VARCHAR(50) NOT NULL UNIQUE,
    area_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE plc_gateways (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    gateway_name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50) NOT NULL DEFAULT '192.168.0.101',
    rack INT NOT NULL DEFAULT 0,
    slot INT NOT NULL DEFAULT 1,
    poll_interval_ms INT NOT NULL DEFAULT 1000,
    status ENUM('CONNECTED', 'DISCONNECTED', 'ERROR', 'SIMULATED') DEFAULT 'SIMULATED',
    last_connected_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES process_areas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE instrument_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    group_code VARCHAR(50) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_area_group (area_id, group_code),
    FOREIGN KEY (area_id) REFERENCES process_areas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sensor_hardware_catalog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    denomination VARCHAR(255) NOT NULL,
    model_specification TEXT,
    doc_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE process_instruments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_id INT NOT NULL,
    plc_id INT NOT NULL,
    group_id INT NOT NULL,
    hardware_id INT,
    tag_name VARCHAR(100) NOT NULL,
    description TEXT,
    show_on_dashboard BOOLEAN DEFAULT TRUE,
    db_number INT NOT NULL DEFAULT 1601,
    byte_offset DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    bit_offset INT NOT NULL DEFAULT 0,
    plc_data_format ENUM('REAL', 'INT', 'BOOL', 'WORD', 'DWORD') NOT NULL DEFAULT 'REAL',
    signal_type ENUM('ENG_VALUE', 'ON_OFF', 'ALARM', 'CONTROL') NOT NULL DEFAULT 'ENG_VALUE',
    scale_raw_min DECIMAL(10,2) DEFAULT 0.00,
    scale_raw_max DECIMAL(10,2) DEFAULT 27648.00,
    scale_eng_min DECIMAL(10,2) DEFAULT 0.00,
    scale_eng_max DECIMAL(10,2) DEFAULT 100.00,
    target_setpoint DECIMAL(10,2),
    engineering_unit VARCHAR(50),
    document_revision VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (area_id) REFERENCES process_areas(id) ON DELETE CASCADE,
    FOREIGN KEY (plc_id) REFERENCES plc_gateways(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES instrument_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (hardware_id) REFERENCES sensor_hardware_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE alarm_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instrument_id INT NOT NULL,
    alarm_type ENUM('HIGH_HIGH', 'HIGH', 'LOW', 'LOW_LOW', 'DIGITAL_SWITCH') NOT NULL,
    threshold_value DECIMAL(10,2),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES process_instruments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE telemetry_readings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instrument_id INT NOT NULL,
    value_scaled DECIMAL(12,4),
    value_raw DECIMAL(12,4),
    value_digital BOOLEAN,
    quality_status ENUM('GOOD', 'BAD', 'UNCERTAIN') DEFAULT 'GOOD',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instrument_id) REFERENCES process_instruments(id) ON DELETE CASCADE,
    INDEX idx_inst_time (instrument_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO process_areas (id, area_code, area_name, description) VALUES (1, 'UHT-01', 'UHT Processing Area UHT-01', 'Aseptic Processing Plant Area UHT-01');
INSERT INTO plc_gateways (id, area_id, gateway_name, ip_address, rack, slot, poll_interval_ms, status) VALUES (1, 1, 'Siemens S7-1500 UHT PLC', '192.168.0.101', 0, 1, 1000, 'SIMULATED');

INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (1, 1, 'FT04', 'FT04 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (2, 1, 'FT10', 'FT10 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (3, 1, 'Product', 'Product Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (4, 1, 'Circulate Hotwater M10', 'Circulate Hotwater M10 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (5, 1, 'Circulate Hotwater M9', 'Circulate Hotwater M9 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (6, 1, 'LT08', 'LT08 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (7, 1, 'LT10', 'LT10 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (8, 1, 'Steam', 'Steam Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (9, 1, 'Ice Water', 'Ice Water Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (10, 1, 'M-01', 'M-01 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (11, 1, 'M-02', 'M-02 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (12, 1, 'M-03', 'M-03 Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (13, 1, 'General', 'General Subsystem');
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (14, 1, 'LS66', 'LS66 Subsystem');

INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (1, 'Magnetic Flow meter', 'Promag 50H ISO W25.0 0-18000l/h PFA Display 20-55V AC/16-62V DC w.10m cable Pulse signal / 4-20mA HART0.5% cal.', '1218415-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (2, 'Pressure transmitter', 'PMP55 SMS38.0 0-37.5bar(g) 4-20mA , F15 SS house Cablegland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (3, 'Pressure transmitter', 'PMP55 Varivent N 0-40bar(g) 4-20mA HART, F15 SS housew/o display Gland M20, IP66/68 NEMA4X/6P', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (4, 'Pressure transmitter', 'PMP55 SMS38.0 0-10bar(g) 4-20mA , F15 SS house Cablegland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (5, 'Temperature transmitter', 'TPT12 4-20mA Measuring range 0-160 deg. C', '3283902-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (6, 'Level Sensor', 'UE-VK15 L1=125 L2=925 "Resolution 15mm, pipe 12mm""PTFE cable 7m, Float type SV"', '1241312-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (7, 'Level switch', NULL, NULL);
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (8, 'Level Sensor', 'ALVTC Tri-Cl. 2.5" L=850mm 2-w. 326L/316Ti ALVTC2.5-TP43A-VK10-L850-SV52V-SR69', '1224261-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (9, 'Pressure transmitter', 'PTP31B g1/2 0-10bar(g) PNP 4-20mA SS house display PlugM12, IP65/67 NEMA Type 4X', '3288665-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (10, 'Pressure transmitter', 'PMP51 ISO228 G1/2 0-10bar(g) 4-20mA F15 SS house w/odisplay Cable gland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (11, 'Conductivity meter', 'CLD132 ISO Cl51 2x4-20mA 24V AC/DC Display SS house w.5m cable Conductivity HART and temperature output', '1218800-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (12, 'Frequency converter', NULL, NULL);
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (13, 'Freqvency converter', NULL, NULL);
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (14, 'Level switch', 'FTL33 NPT1/2 10-30V DC, 3-w PNP Compact 316L,Ra<0.76um Plug M12, IP 65/67 NEMA 4X', '3283723-0101');

INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (1, 1, 1, 1, 1, 'FT04', 'Product Flow', TRUE, 1601, 0.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 18000.00, NULL, 'LPH');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (2, 1, 1, 2, NULL, 'FT10', 'Hotwater Flow', TRUE, 1601, 6.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 25000.00, NULL, 'LPH');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (3, 1, 1, 3, 2, 'PT60', 'Product Pressure Inllet Section-05', TRUE, 1601, 12.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 37.50, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (4, 1, 1, 3, 3, 'PT705', 'Product Pressure Outlet HC', TRUE, 1601, 18.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 40.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (5, 1, 1, 3, 4, 'PT67A', 'Product Pressure Outlet Section-12', TRUE, 1601, 24.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (6, 1, 1, 4, 5, 'TT08', 'Cieculate Water M10 Inlet Section 11', TRUE, 1601, 30.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (7, 1, 1, 5, 5, 'TT10', 'Cieculate Water M9 Inlet Section 17', TRUE, 1601, 36.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (8, 1, 1, 3, 4, 'PT61A', 'Product Pressure Outlet Section-14', TRUE, 1601, 42.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (9, 1, 1, 3, 5, 'TT06', 'Product Pressure Outlet Section-15', TRUE, 1601, 48.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (10, 1, 1, 3, 5, 'TT26', 'Product Pressure Outlet Section-15', TRUE, 1601, 54.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (11, 1, 1, 3, 4, 'PT64A', 'Product Pressure Outlet Section-15', TRUE, 1601, 60.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (12, 1, 1, 3, 2, 'PT01', 'Product Section 1 Outlet', TRUE, 1601, 66.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 37.50, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (13, 1, 1, 3, 5, 'TT42', 'Product Temperature Outlet HC', TRUE, 1601, 72.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (14, 1, 1, 3, 5, 'TT45', 'Product Temperature Outlet HC', TRUE, 1601, 78.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (15, 1, 1, 5, 5, 'TT64', 'Cieculate Water M9 Outlet Section 20', TRUE, 1601, 84.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (16, 1, 1, 3, 5, 'TT02', 'Product Temperature Outlet Section 01', TRUE, 1601, 90.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (17, 1, 1, 6, 6, 'LT08', 'BTD Level', TRUE, 1601, 96.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (18, 1, 1, 6, 7, 'LT08_HH', 'BTD Level', TRUE, 1601, 100.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 40.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (19, 1, 1, 6, 7, 'LT08_H', 'BTD Level', TRUE, 1601, 100.0, 1, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 30.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (20, 1, 1, 6, 7, 'LT08_L', 'BTD Level', TRUE, 1601, 100.0, 2, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 60.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (21, 1, 1, 6, 7, 'LT08_LL', 'BTD Level', TRUE, 1601, 100.0, 3, 'BOOL', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 10.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (22, 1, 1, 7, 8, 'LT10', 'CIP BTD Level', TRUE, 1601, 102.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (23, 1, 1, 7, 7, 'LT10_HH', 'CIP BTD Level', TRUE, 1601, 106.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 30.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (24, 1, 1, 7, 7, 'LT10_H', 'CIP BTD Level', TRUE, 1601, 106.0, 1, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 30.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (25, 1, 1, 7, 7, 'LT10_L', 'CIP BTD Level', TRUE, 1601, 106.0, 2, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 60.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (26, 1, 1, 7, 7, 'LT10_LL', 'CIP BTD Level', TRUE, 1601, 106.0, 3, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, 5.00, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (27, 1, 1, 3, 5, 'TT49', 'Product Temperature Outlet Section 05', TRUE, 1601, 108.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (28, 1, 1, 8, 9, 'PT44', 'Steam Inlet', TRUE, 1601, 114.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (29, 1, 1, 3, 5, 'TT50', 'Product Temperature Outlet Section 06', TRUE, 1601, 120.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (30, 1, 1, 5, 10, 'PT61B', 'Cieculate Water M9 Inlet Section 14', TRUE, 1601, 126.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (31, 1, 1, 9, 10, 'PT64B', 'Icewater Inlet Section 15', TRUE, 1601, 132.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (32, 1, 1, 5, 9, 'PT66', 'Pressure Cieculate Water M9', TRUE, 1601, 138.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (33, 1, 1, 5, 10, 'PT67B', 'Cieculate Water M9 Inlet Section 12', TRUE, 1601, 144.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 10.00, NULL, 'Bar');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (34, 1, 1, 3, 5, 'TT44', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 150.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (35, 1, 1, 3, NULL, 'TT76', 'Return Temperature', TRUE, 1601, 156.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (36, 1, 1, 3, 11, 'QT76', 'Return Conductivity', TRUE, 1601, 162.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 200.00, NULL, 'mSie');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (37, 1, 1, 3, 5, 'TT71', 'Product Temperature Return From Tank HC', TRUE, 1601, 168.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (38, 1, 1, 3, 5, 'TT63', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1601, 174.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (39, 1, 1, 3, 5, 'TT01', 'Raw Product In Feed', TRUE, 1601, 180.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, 'DegC');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (40, 1, 1, 10, 12, 'SX03', 'Pump', TRUE, 1601, 962.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (41, 1, 1, 10, NULL, 'SX03', '', TRUE, 1601, 966.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (42, 1, 1, 10, 12, 'SX03', 'Pump', TRUE, 1601, 970.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 16.00, NULL, '-');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (43, 1, 1, 10, NULL, 'SX03', '', TRUE, 1601, 960.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (44, 1, 1, 10, 12, 'SX04', 'Pump', TRUE, 1601, 976.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (45, 1, 1, 10, NULL, 'SX04', '', TRUE, 1601, 980.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (46, 1, 1, 10, 12, 'SX04', 'Pump', TRUE, 1601, 984.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 16.00, NULL, '-');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (47, 1, 1, 10, NULL, 'SX04', '', TRUE, 1601, 974.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (48, 1, 1, 11, 12, 'SX09', 'Pump', TRUE, 1601, 990.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (49, 1, 1, 11, NULL, 'SX09', '', TRUE, 1601, 994.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (50, 1, 1, 11, 13, 'SX09', 'Pump', TRUE, 1601, 998.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 16.00, NULL, '-');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (51, 1, 1, 11, NULL, 'SX09', '', TRUE, 1601, 988.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (52, 1, 1, 11, 12, 'SX10', 'Pump', TRUE, 1601, 1004.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (53, 1, 1, 11, NULL, 'SX10', '', TRUE, 1601, 1008.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (54, 1, 1, 11, 13, 'SX10', 'Pump', TRUE, 1601, 1012.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 16.00, NULL, '-');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (55, 1, 1, 11, NULL, 'SX10', '', TRUE, 1601, 1002.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (56, 1, 1, 12, 12, 'SX30', 'Pump', TRUE, 1601, 1018.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (57, 1, 1, 12, NULL, 'SX30', '', TRUE, 1601, 1022.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (58, 1, 1, 12, 13, 'SX30', 'Pump', TRUE, 1601, 1026.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 16.00, NULL, '-');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (59, 1, 1, 12, NULL, 'SX30', '', TRUE, 1601, 1016.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (60, 1, 1, 3, NULL, 'TIC44_sp', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 384.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (61, 1, 1, 3, NULL, 'TIC44_pv', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 388.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (62, 1, 1, 3, NULL, 'TIC44_ov', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 392.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (63, 1, 1, 3, NULL, 'TIC44_mv', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 396.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (64, 1, 1, 3, NULL, 'TIC44_mode', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 400.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (65, 1, 1, 3, NULL, 'TIC49_sp', 'Product Temperature Outlet Section 05', TRUE, 1601, 120.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (66, 1, 1, 3, NULL, 'TIC49_pv', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 388.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (67, 1, 1, 3, NULL, 'TIC49_ov', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 392.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (68, 1, 1, 3, NULL, 'TIC49_mv', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 396.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (69, 1, 1, 3, NULL, 'TIC49_mode', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 1601, 400.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (70, 1, 1, 3, NULL, 'TIC50_sp', 'Product Temperature Outlet Section 06', TRUE, 1601, 138.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (71, 1, 1, 13, NULL, 'TIC50_pv', '', FALSE, 1601, 388.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (72, 1, 1, 13, NULL, 'TIC50_ov', '', FALSE, 1601, 392.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (73, 1, 1, 13, NULL, 'TIC50_mv', '', FALSE, 1601, 396.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (74, 1, 1, 13, NULL, 'TIC50_mode', '', FALSE, 1601, 400.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 100.00, NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (75, 1, 1, 14, 14, 'LSL66', 'Hotwater Level', TRUE, 1601, 16.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.00, 1.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (76, 1, 1, 3, NULL, 'TIC6_sp', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1600, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (77, 1, 1, 3, NULL, 'TIC63_pv', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1600, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (78, 1, 1, 3, NULL, 'TIC63_ov', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1600, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (79, 1, 1, 3, NULL, 'TIC63_mv', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1600, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit) VALUES (80, 1, 1, 3, NULL, 'TIC63_mode', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 1600, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.00, 160.00, NULL, '%');

INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (1, 17, 'LOW', 20.0, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (2, 18, 'HIGH_HIGH', 40.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (3, 19, 'HIGH', 30.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (4, 20, 'LOW', 60.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (5, 21, 'LOW_LOW', 10.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (6, 22, 'LOW', 20.0, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (7, 23, 'HIGH_HIGH', 30.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (8, 24, 'HIGH', 30.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (9, 25, 'LOW', 60.00, TRUE);
INSERT INTO alarm_configurations (id, instrument_id, alarm_type, threshold_value, is_enabled) VALUES (10, 26, 'LOW_LOW', 5.00, TRUE);

-- Analytical Views
CREATE VIEW vw_siemens_plc_db_map AS
SELECT 
    i.id AS instrument_id,
    g.gateway_name,
    g.ip_address,
    i.tag_name,
    i.db_number,
    i.byte_offset,
    i.bit_offset,
    i.plc_data_format,
    i.scale_raw_min,
    i.scale_raw_max,
    i.scale_eng_min,
    i.scale_eng_max,
    i.engineering_unit,
    i.description
FROM process_instruments i
JOIN plc_gateways g ON i.plc_id = g.id
ORDER BY i.db_number, i.byte_offset, i.bit_offset;

CREATE VIEW vw_scada_live_metrics AS
SELECT 
    i.id AS instrument_id,
    a.area_code,
    ig.group_code,
    i.tag_name,
    i.description,
    i.plc_data_format,
    i.signal_type,
    i.scale_eng_min,
    i.scale_eng_max,
    i.target_setpoint,
    i.engineering_unit,
    h.denomination AS hardware_type
FROM process_instruments i
JOIN process_areas a ON i.area_id = a.id
JOIN instrument_groups ig ON i.group_id = ig.id
LEFT JOIN sensor_hardware_catalog h ON i.hardware_id = h.id
WHERE i.show_on_dashboard = TRUE;

CREATE VIEW vw_instrument_alarms AS
SELECT 
    ac.id AS alarm_id,
    i.tag_name,
    a.area_code,
    i.description,
    ac.alarm_type,
    ac.threshold_value,
    i.engineering_unit,
    ac.is_enabled
FROM alarm_configurations ac
JOIN process_instruments i ON ac.instrument_id = i.id
JOIN process_areas a ON i.area_id = a.id;
