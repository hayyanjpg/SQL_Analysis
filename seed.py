"""
seed.py
Membaca schema.sql, membuat tabel di PostgreSQL, lalu mengisi data dummy
penjualan yang realistis (customers, products, sales).

Pemakaian:
    python seed.py            # seeding awal (gagal jika tabel sudah ada)
    python seed.py --reset    # hapus tabel lama lalu seeding ulang (DATA HILANG)
"""

import argparse
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import inspect, text

from database import SessionLocal, engine, test_connection

BASE_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = BASE_DIR / "schema.sql"

TABLE_NAMES = ("customers", "products", "sales")

# ---------------------------------------------------------------------------
# Data dummy
# ---------------------------------------------------------------------------

# (name, email, city, join_date)
CUSTOMERS = [
    ("Budi Santoso", "budi.santoso@gmail.com", "Jakarta", date(2024, 3, 12)),
    ("Siti Rahayu", "siti.rahayu@gmail.com", "Bandung", date(2024, 5, 8)),
    ("Agus Wijaya", "agus.wijaya@yahoo.com", "Surabaya", date(2024, 6, 21)),
    ("Dewi Lestari", "dewi.lestari@gmail.com", "Yogyakarta", date(2024, 8, 2)),
    ("Rizky Pratama", "rizky.pratama@gmail.com", "Medan", date(2024, 9, 17)),
    ("Putri Anjani", "putri.anjani@gmail.com", "Denpasar", date(2024, 11, 5)),
    ("Hendra Gunawan", "hendra.gunawan@yahoo.com", "Semarang", date(2025, 1, 14)),
    ("Maya Sari", "maya.sari@gmail.com", "Makassar", date(2025, 2, 27)),
    ("Fajar Nugroho", "fajar.nugroho@gmail.com", "Palembang", date(2025, 4, 9)),
    ("Nabila Zahra", "nabila.zahra@gmail.com", "Jakarta", date(2025, 7, 30)),
]

# (product_name, category, price, stock_quantity)
PRODUCTS = [
    ("Laptop Asus VivoBook 14", "Elektronik", Decimal("8999000.00"), 25),
    ("Smartphone Samsung Galaxy A54", "Elektronik", Decimal("5499000.00"), 40),
    ("Headphone Sony WH-CH720N", "Audio", Decimal("1799000.00"), 60),
    ("Keyboard Mechanical Logitech", "Aksesori", Decimal("899000.00"), 75),
    ("Mouse Wireless Logitech MX", "Aksesori", Decimal("649000.00"), 90),
    ('Monitor LG 24" Full HD', "Elektronik", Decimal("2150000.00"), 30),
    ("Printer Epson L3250", "Elektronik", Decimal("3299000.00"), 18),
    ("Smartwatch Xiaomi Redmi Watch", "Wearable", Decimal("749000.00"), 55),
    ("Power Bank Anker 20000mAh", "Aksesori", Decimal("499000.00"), 120),
    ("Speaker Bluetooth JBL Flip 6", "Audio", Decimal("1299000.00"), 45),
]

# (index customer 1-10, index produk 1-10, tanggal & jam transaksi, quantity)
SALES = [
    (1, 1, datetime(2026, 1, 8, 9, 15), 2),
    (2, 3, datetime(2026, 1, 15, 13, 40), 3),
    (3, 2, datetime(2026, 1, 22, 10, 5), 1),
    (4, 5, datetime(2026, 2, 3, 16, 25), 4),
    (5, 4, datetime(2026, 2, 11, 11, 10), 2),
    (6, 8, datetime(2026, 2, 19, 14, 55), 1),
    (7, 6, datetime(2026, 3, 2, 9, 45), 2),
    (8, 9, datetime(2026, 3, 14, 15, 30), 5),
    (9, 7, datetime(2026, 3, 27, 10, 20), 1),
    (10, 10, datetime(2026, 4, 5, 13, 5), 2),
    (1, 2, datetime(2026, 4, 18, 14, 15), 1),
    (3, 1, datetime(2026, 5, 9, 10, 50), 1),
    (2, 4, datetime(2026, 5, 21, 16, 40), 3),
    (5, 6, datetime(2026, 6, 4, 11, 25), 2),
    (7, 9, datetime(2026, 6, 16, 9, 55), 10),
    (4, 10, datetime(2026, 7, 7, 15, 10), 1),
    (6, 3, datetime(2026, 7, 25, 12, 35), 2),
    (8, 5, datetime(2026, 8, 13, 10, 45), 2),
    (9, 8, datetime(2026, 9, 9, 14, 20), 1),
    (10, 7, datetime(2026, 10, 21, 11, 5), 1),
]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def read_schema_statements() -> list[str]:
    """Baca schema.sql, buang komentar '--', lalu pecah per statement ';'."""
    raw_sql = SCHEMA_PATH.read_text(encoding="utf-8")

    without_comments = "\n".join(
        line for line in raw_sql.splitlines() if not line.strip().startswith("--")
    )

    statements = [stmt.strip() for stmt in without_comments.split(";") if stmt.strip()]
    if not statements:
        raise RuntimeError(f"Tidak ada statement SQL yang bisa dibaca dari {SCHEMA_PATH}")
    return statements


def get_existing_tables() -> list[str]:
    """Cek tabel dari schema yang sudah ada di database."""
    inspector = inspect(engine)
    return [table for table in TABLE_NAMES if inspector.has_table(table)]


def create_tables(reset: bool) -> None:
    """Jalankan schema.sql. Jika reset=True, hapus tabel lama terlebih dahulu."""
    existing = get_existing_tables()

    if existing and not reset:
        print("[ERROR] Tabel berikut sudah ada di database: " + ", ".join(existing))
        print("        Seeding dibatalkan agar data lama tidak tertimpa.")
        print("        Jalankan 'python seed.py --reset' jika ingin menghapus dan mengisi ulang.")
        sys.exit(1)

    statements = read_schema_statements()

    with engine.begin() as conn:
        if reset:
            # Urutan drop: child table (sales) lebih dulu karena punya foreign key
            conn.execute(text("DROP TABLE IF EXISTS sales, products, customers CASCADE"))
            print("[OK] Tabel lama dihapus.")

        for statement in statements:
            conn.execute(text(statement))

    print(f"[OK] {len(statements)} statement schema.sql dieksekusi (tabel dibuat).")


def seed_customers(session) -> list[int]:
    """Insert customers, kembalikan list customer_id sesuai urutan CUSTOMERS."""
    customer_ids = []
    for name, email, city, join_date in CUSTOMERS:
        customer_id = session.execute(
            text(
                """
                INSERT INTO customers (name, email, city, join_date)
                VALUES (:name, :email, :city, :join_date)
                RETURNING customer_id
                """
            ),
            {"name": name, "email": email, "city": city, "join_date": join_date},
        ).scalar_one()
        customer_ids.append(customer_id)

    print(f"[OK] {len(customer_ids)} customers dimasukkan.")
    return customer_ids


def seed_products(session) -> list[int]:
    """Insert products, kembalikan list product_id sesuai urutan PRODUCTS."""
    product_ids = []
    for product_name, category, price, stock_quantity in PRODUCTS:
        product_id = session.execute(
            text(
                """
                INSERT INTO products (product_name, category, price, stock_quantity)
                VALUES (:product_name, :category, :price, :stock_quantity)
                RETURNING product_id
                """
            ),
            {
                "product_name": product_name,
                "category": category,
                "price": price,
                "stock_quantity": stock_quantity,
            },
        ).scalar_one()
        product_ids.append(product_id)

    print(f"[OK] {len(product_ids)} products dimasukkan.")
    return product_ids


def seed_sales(session, customer_ids: list[int], product_ids: list[int]) -> Decimal:
    """
    Insert transaksi penjualan. total_amount dihitung dari harga produk x quantity
    agar konsisten dengan data products (bukan angka acak).
    """
    grand_total = Decimal("0.00")

    for customer_index, product_index, sale_date, quantity in SALES:
        product_price = PRODUCTS[product_index - 1][2]
        total_amount = (product_price * quantity).quantize(Decimal("0.01"))
        grand_total += total_amount

        session.execute(
            text(
                """
                INSERT INTO sales (customer_id, product_id, sale_date, quantity, total_amount)
                VALUES (:customer_id, :product_id, :sale_date, :quantity, :total_amount)
                """
            ),
            {
                "customer_id": customer_ids[customer_index - 1],
                "product_id": product_ids[product_index - 1],
                "sale_date": sale_date,
                "quantity": quantity,
                "total_amount": total_amount,
            },
        )

    print(f"[OK] {len(SALES)} sales dimasukkan (total {grand_total:,.2f}).")
    return grand_total


def print_summary(session) -> None:
    """Tampilkan ringkasan singkat untuk memverifikasi hasil seeding."""
    counts = session.execute(
        text(
            """
            SELECT
                (SELECT COUNT(*) FROM customers) AS customers,
                (SELECT COUNT(*) FROM products) AS products,
                (SELECT COUNT(*) FROM sales) AS sales
            """
        )
    ).one()

    print("\nRingkasan data:")
    print(f"  customers : {counts.customers}")
    print(f"  products  : {counts.products}")
    print(f"  sales     : {counts.sales}")

    top_products = session.execute(
        text(
            """
            SELECT p.product_name,
                   SUM(s.quantity) AS total_quantity,
                   SUM(s.total_amount) AS total_revenue
            FROM sales s
            JOIN products p ON p.product_id = s.product_id
            GROUP BY p.product_name
            ORDER BY total_revenue DESC
            LIMIT 3
            """
        )
    ).all()

    print("\nTop 3 produk berdasarkan pendapatan:")
    for row in top_products:
        print(f"  {row.product_name:<35} qty={row.total_quantity:>3}  revenue={row.total_revenue:>15,.2f}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed database PostgreSQL dengan data dummy penjualan."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Hapus tabel customers/products/sales yang sudah ada sebelum seeding ulang (DATA HILANG).",
    )
    args = parser.parse_args()

    if not SCHEMA_PATH.exists():
        print(f"[ERROR] File schema tidak ditemukan: {SCHEMA_PATH}")
        sys.exit(1)

    print("Menguji koneksi ke database...")
    if not test_connection():
        print("[ERROR] Seeding dibatalkan karena koneksi database gagal.")
        sys.exit(1)
    print("[OK] Koneksi database berhasil.")

    print("\nMembuat tabel dari schema.sql...")
    create_tables(reset=args.reset)

    session = SessionLocal()
    try:
        print("\nMengisi data dummy...")
        customer_ids = seed_customers(session)
        product_ids = seed_products(session)
        seed_sales(session, customer_ids, product_ids)

        session.commit()
        print_summary(session)
        print("\n[SELESAI] Database berhasil di-seed.")
    except Exception as exc:  # noqa: BLE001 - rollback semua insert jika ada satu yang gagal
        session.rollback()
        print(f"\n[ERROR] Seeding gagal, semua perubahan dibatalkan: {exc}")
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
