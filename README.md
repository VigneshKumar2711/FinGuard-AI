# FinGuard AI — Explainable Transaction Fraud & Risk Monitoring

FinGuard AI is a transaction monitoring prototype that helps users review synthetic financial transaction records, understand configured risk indicators and prioritize transactions for further investigation.

Built using React, TypeScript, FastAPI, Python and Exasol.

## Problem Statement

Financial operations teams handle large volumes of transactions. Reviewing transactions manually can be time-consuming, while risk labels without understandable indicators can make further investigation difficult.

FinGuard AI aims to improve transaction review by combining centralized transaction data, rule-based risk indicators and an interactive monitoring dashboard.

## Solution

FinGuard AI provides:

- A centralized transaction monitoring dashboard.
- Transaction summaries and risk-level distribution.
- Transaction-level information and risk indicators.
- Rule-based risk analysis.
- Exasol-backed transaction data retrieval.
- A FastAPI backend connecting the database and frontend.

## Key Features

- Dashboard for transaction monitoring.
- Transaction listing and transaction details.
- High, Medium and Low risk categorization.
- Configured rule-based risk indicators.
- Summary metrics retrieved from the backend API.
- Synthetic transaction dataset for demonstration.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- Python
- FastAPI
- PyExasol

### Database
- Exasol

## System Architecture

The frontend communicates with the FastAPI backend through HTTP API requests. The backend retrieves transaction records from Exasol and provides transaction and summary information to the frontend.

The backend also applies a separate rule-based analysis to produce explanatory risk indicators.

## Dataset

The demonstration uses 500 synthetic transaction records.

The dataset includes fields such as:

- Transaction ID
- User ID
- Amount
- Merchant
- Transaction type
- Location
- Transaction timestamp
- Fraud label
- Stored risk score
- Stored risk level

The records and labels are synthetic demonstration data. They are not real customer transactions or independently verified fraud determinations.

## Risk Analysis

FinGuard AI uses transparent, configurable rule-based indicators.

The prototype considers configured conditions such as:
- Transaction amount thresholds.
- Missing or unknown merchant information.
- Other configured transaction activity indicators.

The rule-based explanation is separate from the risk score and risk level stored in Exasol.

**Disclaimer:** FinGuard AI is a demonstration prototype, not a validated fraud detection model or a production financial decision system. Its indicators support review and do not establish that a transaction is fraudulent.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Backend and database health status |
| `GET /api/transactions` | Retrieve transaction records |
| `GET /api/summary` | Retrieve transaction summary metrics |

## Project Structure

Example structure (update to match the actual repository):

```text
FinGuard-AI/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── backend/
│   ├── main.py
│   ├── risk_scoring.py
│   ├── seed_transactions.py
│   ├── requirements.txt
│   └── .env.example
├── .gitignore
├── LICENSE
└── README.md
```

## Prerequisites

- Python 3.10 or a compatible version supported by the backend dependencies.
- Node.js and npm.
- Git.
- Access to the configured Exasol database.
- Exasol connection credentials.

## Local Setup and Installation

### 1. Clone the repository

```bash
git clone https://github.com/VigneshKumar2711/FinGuard-AI.git
cd FinGuard-AI
```

### 2. Backend setup

```bash
cd backend

python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file in the backend directory and configure the required Exasol connection variables using the names expected by `main.py`.

Never publish real database credentials or access tokens.

Start the backend:

```bash
python -m uvicorn main:app --reload
```

Backend URL:

```text
http://127.0.0.1:8000
```

### 3. Frontend setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local frontend URL shown by Vite, normally:

```text
http://localhost:5173
```

Configure the frontend API base URL to point to the running backend.

## Usage

1. Start the Exasol database cluster and confirm that it is accessible.
2. Start the FastAPI backend.
3. Verify the health endpoint.
4. Start the React frontend.
5. Open the dashboard.
6. Review the transaction summary and transaction records.
7. Inspect transaction-level risk indicators.

## Deployment

The proposed deployment architecture uses:

- Vercel for the frontend.
- Render for the FastAPI backend.
- Exasol for the database.

See the deployment and run guide for configuration details.

## Data and Security

- Only synthetic demonstration data is intended for this repository.
- Do not commit `.env` files, passwords, access tokens or database credentials.
- Do not expose database credentials in frontend environment variables.
- Configure production CORS to allow only the intended frontend origin.

## Future Improvements

- More robust transaction activity analysis.
- Improved explainability and configurable risk rules.
- Expanded transaction investigation workflows.
- Additional testing and monitoring.

## Licence

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

FinGuard AI is an experimental demonstration project developed for the ExaThon challenge. It is not intended to replace professional fraud investigation, financial compliance checks or production risk management systems.

All demonstration records are synthetic.
