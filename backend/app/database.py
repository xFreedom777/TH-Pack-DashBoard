import os
import mysql.connector
from mysql.connector import pooling

MYSQL_HOST = os.getenv("MYSQL_HOST", "mysql")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "thpack_user")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "thpack_pass123")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "thpack_dashboard")

try:
    db_pool = pooling.MySQLConnectionPool(
        pool_name="thpack_pool",
        pool_size=5,
        pool_reset_session=True,
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE
    )
    print(f"Connected to MySQL Pool at {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}")
except Exception as e:
    print(f"MySQL Pool Initialization Warning: {e}")
    db_pool = None

def get_db_connection():
    if db_pool:
        return db_pool.get_connection()
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DATABASE
    )

def fetch_all(query, params=None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query, params or ())
        result = cursor.fetchall()
        cursor.close()
        return result
    finally:
        conn.close()

def execute_insert(query, params=None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(query, params or ())
        conn.commit()
        last_id = cursor.lastrowid
        cursor.close()
        return last_id
    finally:
        conn.close()
