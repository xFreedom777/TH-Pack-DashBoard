import os
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

    files = [
        ('custom_dashboard/index.html', f'{REMOTE_BASE}/custom_dashboard/index.html'),
        ('custom_dashboard/style.css', f'{REMOTE_BASE}/custom_dashboard/style.css'),
        ('custom_dashboard/app.js', f'{REMOTE_BASE}/custom_dashboard/app.js'),
    ]

    for loc, rem in files:
        full_loc = os.path.abspath(loc)
        print(f"Uploading {full_loc} -> {rem} ...")
        sftp.put(full_loc, rem)
    sftp.close()

    commands = [
        f"docker cp '{REMOTE_BASE}/custom_dashboard/index.html' thpack_custom_dashboard:/usr/share/nginx/html/index.html",
        f"docker cp '{REMOTE_BASE}/custom_dashboard/style.css' thpack_custom_dashboard:/usr/share/nginx/html/style.css",
        f"docker cp '{REMOTE_BASE}/custom_dashboard/app.js' thpack_custom_dashboard:/usr/share/nginx/html/app.js",
        "docker exec thpack_custom_dashboard nginx -s reload"
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
    print("\nCustom Dashboard deployed successfully!")

if __name__ == '__main__':
    deploy()
