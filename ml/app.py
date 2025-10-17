# ml/app.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import io, os
import pandas as pd
import numpy as np
from joblib import load

app = FastAPI(title="Churn ML")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Churn ML Service is running", "status": "healthy"}

FEATURES = ["tenure_months", "contract_month_to_month", "num_support_tickets",
            "monthly_spend", "last_login_days"]

MODEL = None  # loaded lazily

def load_model():
    global MODEL
    if MODEL is not None:
        return MODEL
    if os.path.exists("model.joblib"):
        MODEL = load("model.joblib")
        print("Loaded model.joblib")
    else:
        MODEL = None
        print("No model.joblib found; using heuristic.")
    return MODEL

def prepare(df: pd.DataFrame) -> pd.DataFrame:
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0
    for col in FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df

def heuristic(x: pd.DataFrame) -> np.ndarray:
    score = (
        0.02 * (12 - np.clip(x["tenure_months"], 0, 60)) +
        0.15 * np.clip(x["contract_month_to_month"], 0, 1) +
        0.05 * np.clip(x["num_support_tickets"], 0, 20) +
        0.01 * (150 - np.clip(x["monthly_spend"], 0, 150)) +
        0.03 * np.clip(x["last_login_days"], 0, 90)
    )
    p = 1.0 / (1.0 + np.exp(-score))
    return np.clip(p, 0, 1)

@app.post("/predict-csv")
async def predict_csv(file: UploadFile = File(...)) -> Dict[str, Any]:
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))
    df = prepare(df)

    model = load_model()
    if model is None:
        probs = heuristic(df)
    else:
        probs = model.predict_proba(df[FEATURES])[:, 1]

    out: List[Dict[str, Any]] = []
    for i, p in enumerate(probs):
        out.append({
            "customerId": df.iloc[i].get("customer_id") if "customer_id" in df.columns else i,
            "probability": float(p),
            "features": {k: float(df.iloc[i][k]) for k in FEATURES}
        })
    return {"predictions": out}
