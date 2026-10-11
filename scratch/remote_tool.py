import sys
import paramiko

def run_remote(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect('192.168.1.2', username='xroot', password='aDmin100!')
    print(f"--- Running: {cmd} ---")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    print("STDOUT:\n" + out)
    if err:
        print("STDERR:\n" + err)
    ssh.close()

if __name__ == '__main__':
    command = sys.argv[1] if len(sys.argv) > 1 else 'docker ps --format "{{.Names}}: {{.Status}}"'
    run_remote(command)
