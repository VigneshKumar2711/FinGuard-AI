
import logging
import os
import random
from datetime import datetime, timedelta
from decimal import Decimal

import pyexasol
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s"
)
logger = logging.getLogger("finguard-updater")

SCHEMA = "FINGUARD"
TABLE = "TRANSACTIONS"
TOTAL = 500
RANDOM_SEED = 20261031

MERCHANTS = [
    "Amazon", "Flipkart", "Myntra", "Walmart", "Reliance Digital",
    "Reliance Retail", "DMart", "BigBasket", "Swiggy", "Zomato",
    "Uber", "Ola", "Rapido", "IRCTC", "MakeMyTrip",
    "Apollo Pharmacy", "MedPlus", "Tata 1mg", "Indian Oil",
    "Bharat Petroleum", "HP Fuel Station", "Croma",
    "Samsung Store", "Apple Store", "Jio Store", "Airtel Store",
    "Lifestyle", "Pantaloons", "Decathlon", "BookMyShow",
    "Paytm", "PhonePe", "Google Play", "Netflix",
    "Local Grocery Store", "Local Medical Store",
    "Local Electronics Store", "Unknown Merchant",
]

TRANSACTION_TYPES = ["ONLINE", "POS", "TRANSFER", "ATM"]

# All 28 Indian states.
STATE_LOCATIONS = {
    "Andhra Pradesh": ["Chittoor"],
    "Arunachal Pradesh": ["Itanagar"],
    "Assam": ["Guwahati"],
    "Bihar": ["Patna"],
    "Chhattisgarh": ["Raipur"],
    "Goa": ["Panaji"],
    "Gujarat": ["Ahmedabad"],
    "Haryana": ["Gurugram"],
    "Himachal Pradesh": ["Shimla"],
    "Jharkhand": ["Ranchi"],
    "Karnataka": ["Bengaluru Urban"],
    "Kerala": ["Thiruvananthapuram"],
    "Madhya Pradesh": ["Bhopal"],
    "Maharashtra": ["Mumbai"],
    "Manipur": ["Imphal"],
    "Meghalaya": ["Shillong"],
    "Mizoram": ["Aizawl"],
    "Nagaland": ["Kohima"],
    "Odisha": ["Bhubaneswar"],
    "Punjab": ["Ludhiana"],
    "Rajasthan": ["Jaipur"],
    "Sikkim": ["Gangtok"],
    "Tamil Nadu": ["Chennai"],
    "Telangana": ["Hyderabad"],
    "Tripura": ["Agartala"],
    "Uttar Pradesh": ["Lucknow"],
    "Uttarakhand": ["Dehradun"],
    "West Bengal": ["Kolkata"],
}

# District coverage requested for these regions.
AP_DISTRICTS = [
    "Alluri Sitharama Raju", "Anakapalli", "Anantapur",
    "Annamayya", "Bapatla", "Chittoor",
    "Dr B R Ambedkar Konaseema", "East Godavari", "Eluru",
    "Guntur", "Kakinada", "Krishna", "Kurnool", "Nandyal",
    "NTR", "Palnadu", "Parvathipuram Manyam", "Prakasam",
    "Sri Potti Sriramulu Nellore", "Sri Sathya Sai",
    "Srikakulam", "Tirupati", "Visakhapatnam",
    "Vizianagaram", "West Godavari", "YSR Kadapa",
]

KERALA_DISTRICTS = [
    "Alappuzha", "Ernakulam", "Idukki", "Kannur",
    "Kasaragod", "Kollam", "Kottayam", "Kozhikode",
    "Malappuram", "Palakkad", "Pathanamthitta",
    "Thiruvananthapuram", "Thrissur", "Wayanad",
]

KARNATAKA_DISTRICTS = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural",
    "Bengaluru Urban", "Bidar", "Chamarajanagar",
    "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad",
    "Gadag", "Hassan", "Haveri", "Kalaburagi",
    "Kodagu", "Kolar", "Koppal", "Mandya",
    "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
    "Tumakuru", "Udupi", "Uttara Kannada",
    "Vijayanagara", "Vijayapura", "Yadgir",
]


def build_locations():
    locations = []

    # Include every district in the requested states.
    locations.extend(
        (district, "Andhra Pradesh") for district in AP_DISTRICTS
    )
    locations.extend(
        (district, "Kerala") for district in KERALA_DISTRICTS
    )
    locations.extend(
        (district, "Karnataka") for district in KARNATAKA_DISTRICTS
    )

    # Include all other states and Chennai.
    for state, districts in STATE_LOCATIONS.items():
        for district in districts:
            locations.append((district, state))

    # Remove duplicate district/state pairs.
    return list(dict.fromkeys(locations))


def connect_exasol():
    required = [
        os.getenv("EXASOL_DSN"),
        os.getenv("EXASOL_USER"),
        os.getenv("EXASOL_ACCESS_TOKEN"),
    ]

    if not all(required):
        raise RuntimeError("Check Exasol environment variables in .env.")

    return pyexasol.connect(
        dsn=required[0],
        user=required[1],
        password=required[2],
        schema=SCHEMA,
        fetch_dict=True,
        encryption=True,
    )


def generate_records():
    rng = random.Random(RANDOM_SEED)

    specifications = (
        [("LOW", False)] * 250
        + [("MEDIUM", False)] * 100
        + [("HIGH", False)] * 50
        + [("HIGH", True)] * 100
    )
    rng.shuffle(specifications)

    locations = build_locations()

    # Guarantee every listed location appears at least once.
    rng.shuffle(locations)
    selected_locations = locations.copy()

    while len(selected_locations) < TOTAL:
        selected_locations.append(rng.choice(locations))

    rng.shuffle(selected_locations)

    # 50 transactions per day, spread across 10 days.
    start_time = datetime(2026, 10, 21, 0, 0, 0)
    records = []

    for index, (risk_level, is_fraud) in enumerate(specifications):
        transaction_id = f"TXN{index + 1:03d}"
        user_id = f"USR{rng.randint(1, 120):03d}"

        if risk_level == "LOW":
            score = rng.uniform(5, 29.99)
            amount = rng.uniform(100, 15000)
        elif risk_level == "MEDIUM":
            score = rng.uniform(30, 59.99)
            amount = rng.uniform(5000, 50000)
        elif is_fraud:
            score = rng.uniform(90, 99.99)
            amount = rng.uniform(20000, 200000)
        else:
            score = rng.uniform(60, 89.99)
            amount = rng.uniform(15000, 100000)

        # Exactly 500 unique timestamps, within Oct 21–30.
        transaction_time = start_time + timedelta(
            minutes=index * 28
        )

        district, state = selected_locations[index]
        location = f"{district}, {state}"

        records.append((
            transaction_id,
            user_id,
            str(round(amount, 2)),
            rng.choice(MERCHANTS),
            rng.choice(TRANSACTION_TYPES),
            location,
            transaction_time.strftime("%Y-%m-%d %H:%M:%S"),
            is_fraud,
            str(round(score, 2)),
            risk_level,
        ))

    return records, locations


def validate_records(records, required_locations):
    if len(records) != TOTAL:
        raise ValueError("Expected exactly 500 records.")

    ids = [r[0] for r in records]
    timestamps = [r[6] for r in records]
    actual_locations = {r[5] for r in records}

    expected_locations = {
        f"{district}, {state}"
        for district, state in required_locations
    }

    if len(set(ids)) != TOTAL:
        raise ValueError("Duplicate transaction IDs.")

    expected_ids = {f"TXN{i:03d}" for i in range(1, 501)}
    if set(ids) != expected_ids:
        raise ValueError("Transaction IDs are not TXN001–TXN500.")

    if len(set(timestamps)) != TOTAL:
        raise ValueError("Duplicate transaction timestamps.")

    if not all(
        "2026-10-21" <= timestamp[:10] <= "2026-10-30"
        for timestamp in timestamps
    ):
        raise ValueError("Transaction timestamp outside required dates.")

    missing = expected_locations - actual_locations
    if missing:
        raise ValueError(
            f"Missing locations: {sorted(missing)}"
        )

    fraud_count = sum(1 for r in records if r[7])
    if fraud_count != 100:
        raise ValueError("Expected exactly 100 fraud records.")

    risk_counts = {
        level: sum(1 for r in records if r[9] == level)
        for level in ["LOW", "MEDIUM", "HIGH"]
    }

    expected_risk_counts = {
        "LOW": 250,
        "MEDIUM": 100,
        "HIGH": 150,
    }

    if risk_counts != expected_risk_counts:
        raise ValueError(
            f"Incorrect risk distribution: {risk_counts}"
        )

    for record in records:
        score = Decimal(record[8])
        level = record[9]
        fraud = record[7]

        if not (Decimal("0") <= score <= Decimal("100")):
            raise ValueError("Risk score must be between 0 and 100.")

        if level == "LOW" and not score < 30:
            raise ValueError("Invalid LOW risk score.")

        if level == "MEDIUM" and not (
            Decimal("30") <= score < Decimal("60")
        ):
            raise ValueError("Invalid MEDIUM risk score.")

        if level == "HIGH" and not (
            Decimal("60") <= score <= Decimal("100")
        ):
            raise ValueError("Invalid HIGH risk score.")

        if fraud and level != "HIGH":
            raise ValueError("Fraud record must have HIGH risk.")

    logger.info("All generated data validations passed.")



def verify_existing_data(connection):
    result = connection.execute(
        f"""
        SELECT COUNT(*) AS TOTAL,
               COUNT(DISTINCT TRANSACTION_ID) AS UNIQUE_IDS
        FROM {SCHEMA}.{TABLE}
        """
    ).fetchone()

    if int(result["TOTAL"]) != TOTAL:
        raise RuntimeError(
            f"Expected 500 existing rows, found {result['TOTAL']}. "
            "Update cancelled."
        )

    if int(result["UNIQUE_IDS"]) != TOTAL:
        raise RuntimeError("Existing transaction IDs are not unique.")

    logger.info("Existing 500 records verified.")


def update_records(connection, records):
    sql = f"""
        UPDATE {SCHEMA}.{TABLE}
        SET
            USER_ID = ?,
            AMOUNT = ?,
            MERCHANT = ?,
            TRANSACTION_TYPE = ?,
            LOCATION = ?,
            TRANSACTION_TIME = ?,
            IS_FRAUD = ?,
            RISK_SCORE = ?,
            RISK_LEVEL = ?
        WHERE TRANSACTION_ID = ?
    """

    statement = connection.create_prepared_statement(sql=sql)

    try:
        values = [
            (
                r[1], r[2], r[3], r[4], r[5],
                r[6], r[7], r[8], r[9], r[0]
            )
            for r in records
        ]

        logger.info("Updating %s existing transactions...", len(values))
        statement.execute_prepared(values)
        connection.commit()
        logger.info("Update submitted.")
    except Exception:
        connection.rollback()
        raise
    finally:
        statement.close()



def verify_final_data(connection, required_locations):
    result = connection.execute(
        f"""
        SELECT
            COUNT(*) AS TOTAL,
            COUNT(DISTINCT TRANSACTION_ID) AS UNIQUE_IDS,
            COUNT(DISTINCT TRANSACTION_TIME) AS UNIQUE_TIMES,
            SUM(CASE WHEN IS_FRAUD = TRUE THEN 1 ELSE 0 END) AS FRAUD_COUNT,
            MIN(TRANSACTION_TIME) AS FIRST_TIME,
            MAX(TRANSACTION_TIME) AS LAST_TIME
        FROM {SCHEMA}.{TABLE}
        """
    ).fetchone()

    total = int(result["TOTAL"])
    unique_ids = int(result["UNIQUE_IDS"])
    unique_times = int(result["UNIQUE_TIMES"])
    fraud_count = int(result["FRAUD_COUNT"] or 0)

    logger.info("Final total: %s", total)
    logger.info("Unique IDs: %s", unique_ids)
    logger.info("Unique timestamps: %s", unique_times)
    logger.info("Fraud count: %s", fraud_count)
    logger.info(
        "Date range: %s to %s",
        result["FIRST_TIME"],
        result["LAST_TIME"],
    )

    if total != TOTAL:
        raise RuntimeError("Final total is not 500.")

    if unique_ids != TOTAL:
        raise RuntimeError("Final IDs are not unique.")

    if unique_times != TOTAL:
        raise RuntimeError("Final timestamps are not unique.")

    if fraud_count != 100:
        raise RuntimeError("Final fraud count is not 100.")

    actual = connection.execute(
        f"SELECT DISTINCT LOCATION FROM {SCHEMA}.{TABLE}"
    ).fetchall()

    actual_locations = {
        row["LOCATION"] for row in actual
    }

    expected_locations = {
        f"{district}, {state}"
        for district, state in required_locations
    }

    missing = expected_locations - actual_locations

    if missing:
        raise RuntimeError(
            f"Missing locations after update: {sorted(missing)}"
        )

    logger.info(
        "SUCCESS: Updated and verified all 500 transactions."
    )

def main():
    records, locations = generate_records()
    validate_records(records, locations)

    logger.info("Generated 500 updated records.")
    logger.info("Required location coverage: %s", len(locations))
    logger.info("Date range: 21–30 October 2026")
    logger.info("Unique timestamps: 500")

    connection = connect_exasol()

    try:
        verify_existing_data(connection)

        # Preview only; no database changes.
        print("\nPreview:")
        for record in records[:5]:
            print(record)

        answer = input(
            "\nType UPDATE500 to update all existing records: "
        ).strip()

        if answer != "UPDATE500":
            logger.info("Cancelled. No database changes made.")
            return

        update_records(connection, records)
        verify_final_data(connection, locations)

    finally:
        connection.close()


if __name__ == "__main__":
    main()
