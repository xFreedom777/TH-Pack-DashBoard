import paramiko

HOST = '192.168.1.2'
USER = 'xroot'
PASS = 'aDmin100!'

sql = """
CREATE TABLE IF NOT EXISTS vsd_energy_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL DEFAULT 'Daily',
    vsd_tag VARCHAR(20) NOT NULL,
    vsd_name VARCHAR(100) NOT NULL,
    section VARCHAR(50) NOT NULL,
    energy_kwh DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    cost_thb DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cost_per_liter DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    peak_power_kw DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    avg_power_kw DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_date_shift_vsd (record_date, shift, vsd_tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vsd_maintenance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vsd_tag VARCHAR(20) NOT NULL UNIQUE,
    vsd_name VARCHAR(100) NOT NULL,
    section VARCHAR(50) NOT NULL,
    rated_kw DECIMAL(6, 2) NOT NULL,
    total_running_seconds BIGINT NOT NULL DEFAULT 0,
    total_running_hours DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_pm_hours DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    next_pm_hours DECIMAL(10, 2) NOT NULL DEFAULT 2000.00,
    pm_interval_hours DECIMAL(10, 2) NOT NULL DEFAULT 2000.00,
    pm_task_desc VARCHAR(255) NOT NULL DEFAULT 'Level 2: Grease Motor Bearings and Check Coupling',
    health_pct DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    status VARCHAR(30) NOT NULL DEFAULT 'GOOD',
    last_run_timestamp DATETIME NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vsd_fault_incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vsd_tag VARCHAR(20) NOT NULL,
    vsd_name VARCHAR(100) NOT NULL,
    section VARCHAR(50) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NULL,
    duration_seconds INT DEFAULT 0,
    duration_minutes DECIMAL(8, 2) DEFAULT 0.00,
    fault_type VARCHAR(100) DEFAULT 'VSD Inverter Trip',
    speed_at_fault DECIMAL(6, 2) DEFAULT 0.00,
    current_at_fault DECIMAL(6, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    resolution_note TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default maintenance records for all 8 VSDs if not exists
INSERT INTO vsd_maintenance_records (vsd_tag, vsd_name, section, rated_kw, total_running_seconds, total_running_hours, last_pm_hours, next_pm_hours, pm_interval_hours, pm_task_desc, health_pct, status)
VALUES
('VSD01', 'UHT PUMP_BOOST', 'UHT', 15.0, 52380, 14.55, 0.0, 2000.0, 2000.0, 'Level 2: Grease Bearings & Check Alignment', 99.27, 'GOOD'),
('VSD02', 'UHT PUMP_FEED', 'UHT', 11.0, 48600, 13.50, 0.0, 2000.0, 2000.0, 'Level 2: Grease Bearings & Check Alignment', 99.32, 'GOOD'),
('VSD03', 'UHT PUMP_SUPPLY (PID)', 'UHT', 5.5, 36000, 10.00, 0.0, 2000.0, 2000.0, 'Level 2: Inspect Mechanical Seal & Coupling', 99.50, 'GOOD'),
('VSD04', 'CIP L1 P_S Supply', 'CIP 1', 7.5, 21600, 6.00, 0.0, 2000.0, 2000.0, 'Level 2: Grease Bearings & Check Impeller', 99.70, 'GOOD'),
('VSD05', 'CIP L2 P_S Supply', 'CIP 2', 7.5, 14400, 4.00, 0.0, 2000.0, 2000.0, 'Level 2: Grease Bearings & Check Impeller', 99.80, 'GOOD'),
('VSD06', 'UHT PUMP_RETURN', 'UHT', 5.5, 43200, 12.00, 0.0, 2000.0, 2000.0, 'Level 2: Inspect Mechanical Seal & Coupling', 99.40, 'GOOD'),
('VSD08', 'Prod Supply P101', 'Prod Supply', 4.0, 18000, 5.00, 0.0, 2000.0, 2000.0, 'Level 2: Grease Motor Bearings & Seals', 99.75, 'GOOD'),
('VSD09', 'ATANK Agitator', 'ATANK', 4.0, 57600, 16.00, 0.0, 2000.0, 2000.0, 'Level 2: Inspect Agitator Gearbox & Oil', 99.20, 'GOOD')
ON DUPLICATE KEY UPDATE vsd_name=VALUES(vsd_name);
"""

def migrate():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS)

    # Write sql to remote /tmp/migrate.sql
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/migrate_vsd.sql', 'w') as f:
        f.write(sql)
    sftp.close()

    cmd = "docker exec -i thpack_mysql mysql -u thpack_user -pthpack_pass123 thpack_dashboard < /tmp/migrate_vsd.sql"
    print(f"Executing migration: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    print("STDOUT:", out)
    if err:
        print("STDERR:", err)

    # Verify tables
    stdin, stdout, stderr = ssh.exec_command("docker exec thpack_mysql mysql -u thpack_user -pthpack_pass123 thpack_dashboard -e 'SHOW TABLES LIKE \"vsd_%\";'")
    print(stdout.read().decode('utf-8', errors='ignore'))
    ssh.close()

if __name__ == '__main__':
    migrate()
