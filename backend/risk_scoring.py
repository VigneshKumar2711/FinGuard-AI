
def calculate_risk(amount, merchant, hour, recent_count=1):
    """
    Explainable rule-based risk scoring for the FinGuard AI demo.
    Prototype rules only — not a validated fraud detection model.
    """
    score = 0
    reasons = []
    risk_signals = []

    # Transaction amount
    if amount >= 50000:
        score += 40
        reasons.append("Transaction amount is ₹50,000 or above.")
        risk_signals.append("High transaction amount")
    elif amount >= 25000:
        score += 20
        reasons.append("Transaction amount is ₹25,000 or above.")
        risk_signals.append("Elevated transaction amount")

    # Merchant verification
    merchant_name = str(merchant or "").strip().lower()

    if not merchant_name or "unknown" in merchant_name:
        score += 20
        reasons.append(
            "Merchant information is missing or marked unknown."
        )
        risk_signals.append("Unverified merchant information")

    # Late-night activity
    if 0 <= hour < 5:
        score += 15
        reasons.append(
            "Transaction occurred between midnight and 5 AM."
        )
        risk_signals.append("Unusual transaction time")

    # Repeated activity within the available dataset.
    # This is a prototype indicator, not proof of fraud.
    if recent_count >= 3:
        score += 15
        reasons.append(
            f"This is transaction {recent_count} for this user "
            "within the available transaction history."
        )
        risk_signals.append("Repeated transaction activity")

    score = min(score, 100)

    if score >= 60:
        risk_level = "High"
    elif score >= 30:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    if not risk_signals:
        reasons.append(
            "No configured risk indicators were detected."
        )
        risk_signals.append(
            "No configured risk indicators detected"
        )

    return {
        "risk_score": score,
        "risk": risk_level,
        "reasons": reasons,
        "risk_signals": risk_signals,
    }
