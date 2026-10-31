
import os
import logging
from datetime import datetime

import pyexasol
from dotenv import load_dotenv
from risk_scoring import calculate_risk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("finguard")

app = FastAPI(
    title="FinGuard AI API",
    description="Financial transaction risk analysis API",
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


# --------------------------------------------------
# EXASOL DATABASE CONNECTION
# --------------------------------------------------

def connect_exasol():
    dsn = os.getenv("EXASOL_DSN")
    user = os.getenv("EXASOL_USER")
    token = os.getenv("EXASOL_ACCESS_TOKEN")

    if not all([dsn, user, token]):
        logger.error("Missing Exasol configuration in .env")
        raise HTTPException(
            status_code=503,
            detail="Exasol settings are missing. Check .env.",
        )

    try:
        connection = pyexasol.connect(
            dsn=dsn,
            user=user,
            password=token,
            schema="FINGUARD",
            fetch_dict=True,
            encryption=True,
        )

        logger.info("Exasol connection established")
        return connection

    except Exception as exc:
        logger.exception("Exasol connection failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not connect to Exasol. "
                "Check credentials, IP allowlist, and cluster status."
            ),
        ) from exc


# --------------------------------------------------
# HELPER: CONVERT TRANSACTION TIME
# --------------------------------------------------

def parse_transaction_time(value):
    if isinstance(value, datetime):
        return value.isoformat(), value.hour

    if value:
        time_text = str(value)

        try:
            parsed_time = datetime.fromisoformat(
                time_text.replace("Z", "+00:00")
            )
            return time_text, parsed_time.hour

        except ValueError:
            return time_text, 0

    return None, 0


# --------------------------------------------------
# HELPER: NORMALIZE FRAUD LABEL
# --------------------------------------------------

def normalize_fraud_label(value):
    if isinstance(value, bool):
        return value

    return str(value).strip().upper() in (
        "TRUE",
        "1",
        "T",
        "YES",
    )


# --------------------------------------------------
# FETCH TRANSACTIONS FROM EXASOL
# --------------------------------------------------

def fetch_transactions():
    connection = connect_exasol()

    try:
        statement = connection.execute("""
            SELECT
                TRANSACTION_ID AS "id",
                USER_ID AS "name",
                AMOUNT AS "amount",
                MERCHANT AS "merchant",
                TRANSACTION_TYPE AS "type",
                LOCATION AS "location",
                TRANSACTION_TIME AS "transaction_time",
                IS_FRAUD AS "is_fraud",
                RISK_SCORE AS "risk_score",
                RISK_LEVEL AS "risk_level",

                COUNT(*) OVER (
                    PARTITION BY USER_ID
                    ORDER BY TRANSACTION_TIME
                    ROWS BETWEEN UNBOUNDED PRECEDING
                    AND CURRENT ROW
                ) AS "recent_count"

            FROM FINGUARD.TRANSACTIONS
            ORDER BY TRANSACTION_TIME ASC
        """)

        rows = statement.fetchall()
        results = []

        for row in rows:
            amount = float(row["amount"] or 0)

            transaction_time, hour = parse_transaction_time(
                row["transaction_time"]
            )

            is_fraud = normalize_fraud_label(
                row["is_fraud"]
            )

            # Original values stored in Exasol
            stored_score = (
                float(row["risk_score"])
                if row["risk_score"] is not None
                else 0.0
            )

            stored_level = (
                str(row["risk_level"]).strip().capitalize()
                if row["risk_level"] is not None
                else "Unknown"
            )

            recent_count = int(row["recent_count"] or 1)

            # Generate separate rule-based explanations.
            # Do not overwrite the stored Exasol risk score or level.
            analysis = calculate_risk(
                amount=amount,
                merchant=row["merchant"],
                hour=hour,
                recent_count=recent_count,
            )

            results.append({
                "id": row["id"],
                "name": row["name"],
                "amount": amount,
                "merchant": row["merchant"],
                "type": row["type"],
                "location": row["location"],
                "transaction_time": transaction_time,
                "hour": hour,
                "recent_count": recent_count,
                "is_fraud": is_fraud,

                # Original Exasol risk information
                "risk_score": stored_score,
                "risk": stored_level,
                "risk_level": stored_level,

                # Rule-based explanation information
                "reasons": analysis["reasons"],
                "risk_signals": analysis["risk_signals"],
                "explanation_score": analysis["risk_score"],
                "explanation_risk": analysis["risk"],
            })

        logger.info(
            "Successfully fetched %s transactions from Exasol",
            len(results),
        )

        return results

    except HTTPException:
        raise

    except Exception as exc:
        logger.exception("Failed to fetch transactions")

        raise HTTPException(
            status_code=503,
            detail="Could not fetch transactions from Exasol.",
        ) from exc

    finally:
        connection.close()


# --------------------------------------------------
# API: HEALTH CHECK
# --------------------------------------------------

@app.get("/api/health")
def health():
    connection = connect_exasol()

    try:
        connection.execute("SELECT 1")

        return {
            "status": "ok",
            "service": "FinGuard AI API",
            "database": "connected",
        }

    except Exception as exc:
        logger.exception("Database health check failed")

        raise HTTPException(
            status_code=503,
            detail="Exasol health check failed.",
        ) from exc

    finally:
        connection.close()


# --------------------------------------------------
# API: ALL TRANSACTIONS
# --------------------------------------------------

@app.get("/api/transactions")
def get_transactions():
    return fetch_transactions()


# --------------------------------------------------
# API: DASHBOARD SUMMARY
# --------------------------------------------------

@app.get("/api/summary")
def get_summary():
    results = fetch_transactions()

    total = len(results)

    high = sum(
        item["risk_level"] == "High"
        for item in results
    )

    medium = sum(
        item["risk_level"] == "Medium"
        for item in results
    )

    low = sum(
        item["risk_level"] == "Low"
        for item in results
    )

    fraud_count = sum(
        item["is_fraud"] is True
        for item in results
    )

    total_amount = sum(
        item["amount"]
        for item in results
    )

    average_risk_score = (
        sum(item["risk_score"] for item in results) / total
        if total else 0
    )

    return {
        "total": total,
        "high": high,
        "medium": medium,
        "low": low,
        "fraud_count": fraud_count,
        "total_amount": round(total_amount, 2),
        "average_risk_score": round(average_risk_score, 2),
    }
