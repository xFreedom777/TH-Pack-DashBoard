# TH-Pack Dashboard - Docker Compose Environment

A complete containerized architecture for the **TH-Pack UHT Control & Monitoring Dashboard**, featuring a **MySQL 8.4** database server, web database tools (**phpMyAdmin** & **Adminer**), and a production-grade containerized **Frontend Web Dashboard**.

---

## 🚀 Quick Start

To launch all services, run:

```bash
docker compose up -d
```

To view live service logs:

```bash
docker compose logs -f
```

To stop all services:

```bash
docker compose down
```

---

## 🌐 Service Directory & Ports

| Service | Technology | Access URL | Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend UI** | Nginx + Vite / JS | `http://localhost:3000` | `3000` | Real-time monitoring dashboard |
| **phpMyAdmin** | phpMyAdmin Web UI | `http://localhost:8080` | `8080` | Full-featured DB administration GUI |
| **Adminer** | Adminer Web UI | `http://localhost:8081` | `8081` | Lightweight database management |
| **MySQL Server** | MySQL 8.4 LTS | `localhost:3306` | `3306` | Primary relational database engine |

---

## 🔑 Database Credentials

Default credentials configured in `.env`:

- **Host (Inside Docker Network)**: `mysql`
- **Host (From Host Machine)**: `localhost:3306`
- **Database Name**: `thpack_dashboard`
- **Root Password**: `rootpassword123`
- **User**: `thpack_user`
- **Password**: `thpack_pass123`

---

## 🛠 Project Structure

```
TH-Pack_DashBoard/
├── docker-compose.yml       # Main Docker Compose orchestration file
├── .env                     # Centralized environment variables
├── .env.example             # Template for environment variables
├── README.md                # Documentation & quick start guide
├── mysql/
│   └── init.sql             # Auto-executing SQL database seed script
└── frontend/
    ├── Dockerfile           # Multi-stage build (Node -> Nginx)
    ├── nginx.conf           # Nginx web server configuration
    ├── package.json         # Frontend dependencies
    ├── index.html           # Dashboard HTML template
    └── src/
        ├── style.css        # Modern glassmorphism dark theme
        └── main.js          # Interactive dashboard telemetry logic
```

---

## 💾 Database Auto-Initialization

When the MySQL container starts for the first time, `mysql/init.sql` automatically populates the `thpack_dashboard` database with tables and sample data:
- `production_lines` (Line status & capacity)
- `equipment_items` (Tetra Pak / UHT machinery inventory)
- `dashboard_metrics` (OEE, temperatures, pressures)
- `system_logs` (Telemetry and system audit logs)
