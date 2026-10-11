import os
import sys
import paramiko

HOST = '192.168.1.2'
USER = 'xroot'
PASS = 'aDmin100!'
REMOTE_BASE = '/home/xroot/Desktop/Git hub'

def deploy():
    print(f"Connecting to {HOST} via SSH/SFTP...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASS)
    sftp = ssh.open_sftp()

    files_to_sync = [
        ('backend/app/main.py', f'{REMOTE_BASE}/backend/app/main.py'),
        ('backend/telemetry_worker.py', f'{REMOTE_BASE}/backend/telemetry_worker.py'),
        ('backend/app/telemetry_worker.py', f'{REMOTE_BASE}/backend/app/telemetry_worker.py'),
    ]

    for local_rel, remote_path in files_to_sync:
        local_path = os.path.abspath(local_rel)
        print(f"Uploading {local_path} -> {remote_path} ...")
        sftp.put(local_path, remote_path)
    sftp.close()

    commands = [
        # Copy telemetry_worker to root /app inside container
        f"docker cp '{REMOTE_BASE}/backend/telemetry_worker.py' thpack_backend:/app/telemetry_worker.py",
        f"docker cp '{REMOTE_BASE}/backend/app/main.py' thpack_backend:/app/app/main.py",
        # Restart backend container to pick up supervisor & decoupled architecture
        "docker restart thpack_backend",
        # Wait a moment for container to start
        "sleep 3",
        # Check docker logs
        "docker logs --tail 30 thpack_backend",
        # Check if worker process is running inside container
        "docker exec thpack_backend ps aux"
    ]

    for cmd in commands:
        print(f"\n>>> Running: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out:
            print(out.strip())
        if err:
            print("[ERR]", err.strip())

    ssh.close()
    print("\nDeploy completed!")

if __name__ == '__main__':
    deploy()
