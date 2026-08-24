-- ==========================================================================
-- SIEMENS S7 PLC DATABLOCK-AWARE SCADA DATABASE INITIALIZATION
-- Source File: UHT-InstruementList.xlsx
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
DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS sensor_hardware_catalog;
DROP TABLE IF EXISTS sensor_hardware_types;
DROP TABLE IF EXISTS instrument_groups;
DROP TABLE IF EXISTS plc_gateways;
DROP TABLE IF EXISTS process_areas;
DROP TABLE IF EXISTS process_lines;
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
    ip_address VARCHAR(50) NOT NULL DEFAULT '192.168.0.10',
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
    db_number INT NOT NULL DEFAULT 100,
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
    UNIQUE KEY uk_area_tag (area_id, tag_name),
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

INSERT INTO plc_gateways (id, area_id, gateway_name, ip_address, rack, slot, poll_interval_ms, status) VALUES (1, 1, 'Siemens S7-1500 UHT PLC', '192.168.0.10', 0, 1, 1000, 'SIMULATED');

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
INSERT INTO instrument_groups (id, area_id, group_code, group_name) VALUES (13, 1, 'LS66', 'LS66 Subsystem');

INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (1, 'Magnetic Flow meter', 'Promag 50H ISO W25.0 0-18000l/h PFA Display 20-55V AC/16-62V DC w.10m cable Pulse signal / 4-20mA HART0.5% cal.', '1218415-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (2, 'Temperature transmitter', 'TPT12 4-20mA Measuring range 0-160 deg. C', '3283902-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (3, 'Level Sensor', 'UE-VK15 L1=125 L2=925 "Resolution 15mm, pipe 12mm""PTFE cable 7m, Float type SV"', '1241312-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (4, 'Level Sensor', 'ALVTC Tri-Cl. 2.5" L=850mm 2-w. 326L/316Ti ALVTC2.5-TP43A-VK10-L850-SV52V-SR69', '1224261-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (5, 'Pressure transmitter', 'PMP55 SMS38.0 0-37.5bar(g) 4-20mA , F15 SS house Cablegland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (6, 'Pressure transmitter', 'PTP31B g1/2 0-10bar(g) PNP 4-20mA SS house display PlugM12, IP65/67 NEMA Type 4X', '3288665-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (7, 'Pressure transmitter', 'PMP55 SMS38.0 0-10bar(g) 4-20mA , F15 SS house Cablegland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (8, 'Pressure transmitter', 'PMP51 ISO228 G1/2 0-10bar(g) 4-20mA F15 SS house w/odisplay Cable gland M20x1.5 IP66/68', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (9, 'Pressure transmitter', 'PMP55 Varivent N 0-40bar(g) 4-20mA HART, F15 SS housew/o display Gland M20, IP66/68 NEMA4X/6P', '1229086-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (10, 'Conductivity meter', 'CLD132 ISO Cl51 2x4-20mA 24V AC/DC Display SS house w.5m cable Conductivity HART and temperature output', '1218800-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (11, 'Frequency converter', NULL, NULL);
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (12, 'Level switch', NULL, NULL);
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (13, 'Level switch', 'FTL33 NPT1/2 10-30V DC, 3-w PNP Compact 316L,Ra<0.76um Plug M12, IP 65/67 NEMA 4X', '3283723-0101');
INSERT INTO sensor_hardware_catalog (id, denomination, model_specification, doc_number) VALUES (14, 'Freqvency converter', NULL, NULL);

INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (1, 1, 1, 1, 1, 'FT04', 'Product Flow', TRUE, 100, 0.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 18000.0, NULL, 'LPH', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (2, 1, 1, 2, NULL, 'FT10', 'Hotwater Flow', TRUE, 100, 4.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 25000.0, NULL, 'LPH', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (3, 1, 1, 3, 2, 'TT01', 'Raw Product In Feed', TRUE, 100, 8.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (4, 1, 1, 3, 2, 'TT02', 'Product Temperature Outlet Section 01', TRUE, 100, 12.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (5, 1, 1, 3, 2, 'TT06', 'Product Pressure Outlet Section-15', TRUE, 100, 16.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (6, 1, 1, 4, 2, 'TT08', 'Cieculate Water M10 Inlet Section 11', TRUE, 100, 20.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (7, 1, 1, 5, 2, 'TT10', 'Cieculate Water M9 Inlet Section 17', TRUE, 100, 24.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (8, 1, 1, 3, 2, 'TT26', 'Product Pressure Outlet Section-15', TRUE, 100, 28.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (9, 1, 1, 3, 2, 'TT42', 'Product Temperature Outlet HC', TRUE, 100, 32.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (10, 1, 1, 3, 2, 'TT44', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 100, 36.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (11, 1, 1, 3, 2, 'TT45', 'Product Temperature Outlet HC', TRUE, 100, 40.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (12, 1, 1, 3, 2, 'TT49', 'Product Temperature Outlet Section 05', TRUE, 100, 44.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (13, 1, 1, 3, 2, 'TT50', 'Product Temperature Outlet Section 06', TRUE, 100, 48.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (14, 1, 1, 3, 2, 'TT63', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 100, 52.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (15, 1, 1, 5, 2, 'TT64', 'Cieculate Water M9 Outlet Section 20', TRUE, 100, 56.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (16, 1, 1, 3, 2, 'TT71', 'Product Temperature Return From Tank HC', TRUE, 100, 60.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (17, 1, 1, 6, 3, 'LT08', 'BTD Level', TRUE, 100, 64.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (18, 1, 1, 7, 4, 'LT10', 'CIP BTD Level', TRUE, 100, 68.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (19, 1, 1, 3, 5, 'PT01', 'Product Section 1 Outlet', TRUE, 100, 72.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 37.5, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (20, 1, 1, 8, 6, 'PT44', 'Steam Inlet', TRUE, 100, 76.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (21, 1, 1, 3, 5, 'PT60', 'Product Pressure Inllet Section-05', TRUE, 100, 80.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 37.5, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (22, 1, 1, 3, 7, 'PT61A', 'Product Pressure Outlet Section-14', TRUE, 100, 84.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (23, 1, 1, 5, 8, 'PT61B', 'Cieculate Water M9 Inlet Section 14', TRUE, 100, 88.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (24, 1, 1, 3, 7, 'PT64A', 'Product Pressure Outlet Section-15', TRUE, 100, 92.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (25, 1, 1, 9, 8, 'PT64B', 'Icewater Inlet Section 15', TRUE, 100, 96.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (26, 1, 1, 5, 6, 'PT66', 'Pressure Cieculate Water M9', TRUE, 100, 100.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (27, 1, 1, 3, 7, 'PT67A', 'Product Pressure Outlet Section-12', TRUE, 100, 104.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (28, 1, 1, 5, 8, 'PT67B', 'Cieculate Water M9 Inlet Section 12', TRUE, 100, 108.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 10.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (29, 1, 1, 3, 9, 'PT705', 'Product Pressure Outlet HC', TRUE, 100, 112.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 40.0, NULL, 'BarG', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (30, 1, 1, 3, NULL, 'TT76', 'Return Temperature', TRUE, 100, 116.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, 'DegC', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (31, 1, 1, 3, 10, 'QT76', 'Return Conductivity', TRUE, 100, 120.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 200.0, NULL, 'mSie', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (32, 1, 1, 3, NULL, 'TIC44', 'Product Temperature Outlet Section 11 HC Inlet', TRUE, 100, 124.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (33, 1, 1, 3, NULL, 'TIC49', 'Product Temperature Outlet Section 05', TRUE, 100, 128.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (34, 1, 1, 3, NULL, 'TIC50', 'Product Temperature Outlet Section 06', TRUE, 100, 132.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (35, 1, 1, 3, NULL, 'TIC50_2', 'Product Temperature Outlet Section 06', TRUE, 100, 136.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (36, 1, 1, 3, NULL, 'TIC63', 'Product//Sterile Return Temperature Outlet Section 016', TRUE, 100, 140.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 160.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (37, 1, 1, 10, 11, 'SX03', 'Pump', TRUE, 100, 144.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (38, 1, 1, 10, NULL, 'SX03_2', 'M-01 Current / Torque Feedback', TRUE, 100, 148.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (39, 1, 1, 10, NULL, 'SX03_3', 'M-01 Operating Frequency (Hz)', TRUE, 100, 152.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (40, 1, 1, 10, 11, 'SX04', 'Pump', TRUE, 100, 156.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (41, 1, 1, 10, NULL, 'SX04_2', 'M-01 Current / Torque Feedback', TRUE, 100, 160.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (42, 1, 1, 10, NULL, 'SX04_3', 'M-01 Operating Frequency (Hz)', TRUE, 100, 164.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (43, 1, 1, 11, 11, 'SX09', 'Pump', TRUE, 100, 168.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (44, 1, 1, 11, NULL, 'SX09_2', 'M-02 Current / Torque Feedback', TRUE, 100, 172.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (45, 1, 1, 11, NULL, 'SX09_3', 'M-02 Operating Frequency (Hz)', TRUE, 100, 176.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (46, 1, 1, 11, 11, 'SX10', 'Pump', TRUE, 100, 180.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (47, 1, 1, 11, NULL, 'SX10_2', 'M-02 Current / Torque Feedback', TRUE, 100, 184.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (48, 1, 1, 11, NULL, 'SX10_3', 'M-02 Operating Frequency (Hz)', TRUE, 100, 188.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (49, 1, 1, 12, 11, 'SX30', 'Pump', TRUE, 100, 192.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (50, 1, 1, 12, NULL, 'SX30_2', 'M-03 Current / Torque Feedback', TRUE, 100, 196.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (51, 1, 1, 12, NULL, 'SX30_3', 'M-03 Operating Frequency (Hz)', TRUE, 100, 200.0, 0, 'REAL', 'ENG_VALUE', 0.0, 27648.0, 0.0, 100.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (52, 1, 1, 6, 12, 'LSL-08', 'BTD Level', TRUE, 101, 0.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 10.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (52, 'DIGITAL_SWITCH', 10.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (53, 1, 1, 6, 12, 'LSH-08', 'BTD Level', TRUE, 101, 0.0, 1, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 60.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (53, 'DIGITAL_SWITCH', 60.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (54, 1, 1, 6, 12, 'LS2-08', 'BTD Level', TRUE, 101, 0.0, 2, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 30.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (54, 'DIGITAL_SWITCH', 30.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (55, 1, 1, 6, 12, 'LS1-08', 'BTD Level', TRUE, 101, 0.0, 3, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 40.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (55, 'DIGITAL_SWITCH', 40.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (56, 1, 1, 7, 12, 'LSL-10', 'CIP BTD Level', TRUE, 101, 0.0, 4, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 5.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (56, 'DIGITAL_SWITCH', 5.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (57, 1, 1, 7, 12, 'LSH-10', 'CIP BTD Level', TRUE, 101, 0.0, 5, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 60.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (57, 'DIGITAL_SWITCH', 60.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (58, 1, 1, 7, 12, 'LS2-10', 'CIP BTD Level', TRUE, 101, 0.0, 6, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 30.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (58, 'DIGITAL_SWITCH', 30.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (59, 1, 1, 7, 12, 'LS1-10', 'CIP BTD Level', TRUE, 101, 0.0, 7, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, 30.0, '%', NULL, NULL);
INSERT INTO alarm_configurations (instrument_id, alarm_type, threshold_value, is_enabled) VALUES (59, 'DIGITAL_SWITCH', 30.0, TRUE);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (60, 1, 1, 13, 13, 'LSL66', 'Hotwater Level', TRUE, 101, 1.0, 0, 'INT', 'ON_OFF', 0.0, 1.0, 0.0, 1.0, NULL, '%', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (61, 1, 1, 10, 11, 'SX03_4', 'Pump', TRUE, 101, 1.0, 1, 'INT', 'ENG_VALUE', 0.0, 1.0, 0.0, 16.0, NULL, '-', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (62, 1, 1, 10, 11, 'SX04_4', 'Pump', TRUE, 101, 1.0, 2, 'INT', 'ENG_VALUE', 0.0, 1.0, 0.0, 16.0, NULL, '-', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (63, 1, 1, 11, 14, 'SX09_4', 'Pump', TRUE, 101, 1.0, 3, 'INT', 'ENG_VALUE', 0.0, 1.0, 0.0, 16.0, NULL, '-', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (64, 1, 1, 11, 14, 'SX10_4', 'Pump', TRUE, 101, 1.0, 4, 'INT', 'ENG_VALUE', 0.0, 1.0, 0.0, 16.0, NULL, '-', NULL, NULL);
INSERT INTO process_instruments (id, area_id, plc_id, group_id, hardware_id, tag_name, description, show_on_dashboard, db_number, byte_offset, bit_offset, plc_data_format, signal_type, scale_raw_min, scale_raw_max, scale_eng_min, scale_eng_max, target_setpoint, engineering_unit, document_revision, remarks) VALUES (65, 1, 1, 12, 14, 'SX30_4', 'Pump', TRUE, 101, 1.0, 5, 'INT', 'ENG_VALUE', 0.0, 1.0, 0.0, 16.0, NULL, '-', NULL, NULL);

-- SQL Analytical Views for Siemens PLC & SCADA Dashboards

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