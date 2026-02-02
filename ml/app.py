# ml/app.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional, Tuple
import io, os
import pandas as pd
import numpy as np
from joblib import load

app = FastAPI(title="Churn ML")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Churn ML Service is running", "status": "healthy"}


DEFAULT_FEATURES = [
    "tenure_months",
    "contract_month_to_month",
    "num_support_tickets",
    "monthly_spend",
    "last_login_days",
]

MODEL_BUNDLE: Optional[dict] = None  # {"model":..., "features":[...]}


def load_model_bundle() -> Optional[dict]:
    global MODEL_BUNDLE
    if MODEL_BUNDLE is not None:
        return MODEL_BUNDLE

    if os.path.exists("model.joblib"):
        bundle = load("model.joblib")
        # bundle might be either a raw sklearn model or a dict (we support both)
        if isinstance(bundle, dict) and "model" in bundle:
            MODEL_BUNDLE = bundle
        else:
            MODEL_BUNDLE = {"model": bundle, "features": DEFAULT_FEATURES}
        print("Loaded model.joblib")
    else:
        MODEL_BUNDLE = None
        print("No model.joblib found; using heuristic.")

    return MODEL_BUNDLE


def map_raw_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Maps the big uploaded dataset schema -> internal schema.
    Expected raw columns:
      Tenure, Support Calls, Total Spend, Last Interaction, Contract Length
    """
    df["tenure_months"] = pd.to_numeric(df.get("Tenure"), errors="coerce")
    df["num_support_tickets"] = pd.to_numeric(df.get("Support Calls"), errors="coerce")
    df["monthly_spend"] = pd.to_numeric(df.get("Total Spend"), errors="coerce")
    df["last_login_days"] = pd.to_numeric(df.get("Last Interaction"), errors="coerce")

    df["contract_month_to_month"] = (
        df.get("Contract Length", "")
        .astype(str)
        .str.strip()
        .str.lower()
        .isin(["monthly", "month-to-month", "month to month"])
        .astype(int)
    )
    return df


def prepare(df: pd.DataFrame, features: List[str]) -> pd.DataFrame:
    """
    Accepts either:
      A) already-mapped internal schema (tenure_months, etc)
      B) raw big dataset schema (Tenure, Support Calls, etc)
    Returns a dataframe with numeric columns in `features`.
    """

    # Detect raw dataset columns and map if present
    if "Tenure" in df.columns and "Support Calls" in df.columns and "Total Spend" in df.columns:
        df = map_raw_dataset(df)

    # Ensure all feature columns exist and numeric
    for col in features:
        if col not in df.columns:
            df[col] = 0
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

    bundle = load_model_bundle()

    # Decide which feature list to use (from model bundle if available)
    if bundle is None:
        features = DEFAULT_FEATURES
        df = prepare(df, features)
        probs = heuristic(df)
    else:
        model = bundle["model"]
        features = bundle.get("features", DEFAULT_FEATURES)
        df = prepare(df, features)
        probs = model.predict_proba(df[features])[:, 1]

    # Choose best customer id column available
    id_col = None
    for candidate in ["CustomerID", "customer_id", "customerId"]:
        if candidate in df.columns:
            id_col = candidate
            break

    out: List[Dict[str, Any]] = []
    for i, p in enumerate(probs):
        customer_id = df.iloc[i][id_col] if id_col else i
        out.append(
            {
                "customerId": str(customer_id),
                "probability": float(p),
                "features": {k: float(df.iloc[i][k]) for k in features},
            }
        )

    return {"predictions": out, "count": len(out)}
