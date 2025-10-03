from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from joblib import load

app = FastAPI(title="ChurnGuard ML")

FEATURES = ["tenure_months","contract_month_to_month","num_support_tickets","monthly_spend","last_login_days"]
MODEL_PATH = os.environ.get("MODEL_PATH", "model.joblib")

model = None
feature_importances = None

def _train_synthetic_model():
    rng = np.random.default_rng(42)
    X_train = pd.DataFrame({
        "tenure_months": rng.integers(0, 72, 2000),
        "contract_month_to_month": rng.integers(0, 2, 2000),
        "num_support_tickets": rng.integers(0, 10, 2000),
        "monthly_spend": rng.normal(70, 25, 2000).clip(5, 200),
        "last_login_days": rng.integers(0, 60, 2000)
    })
    y_train = (0.25 * (X_train["tenure_months"] < 6).astype(int)
              +0.30 * X_train["contract_month_to_month"]
              +0.15 * (X_train["num_support_tickets"] > 5).astype(int)
              +0.10 * (X_train["monthly_spend"] > 120).astype(int)
              +0.20 * (X_train["last_login_days"] > 14).astype(int)
             ) + rng.normal(0,0.1,2000)
    y_train = (y_train > 0.5).astype(int)

    m = RandomForestClassifier(n_estimators=200, random_state=7)
    m.fit(X_train, y_train)
    return m

def _load_model():
    global model, feature_importances
    if os.path.exists(MODEL_PATH):
        model = load(MODEL_PATH)
    else:
        model = _train_synthetic_model()
    if hasattr(model, "feature_importances_"):
        feature_importances = dict(zip(FEATURES, model.feature_importances_.tolist()))
    else:
        feature_importances = {f: 1.0/len(FEATURES) for f in FEATURES}

_load_model()

class PredictPayload(BaseModel):
    rows: List[Dict[str, Any]]

@app.post("/predict")
def predict(payload: PredictPayload):
    df = pd.DataFrame(payload.rows)
    for f in FEATURES:
        if f not in df.columns:
            df[f] = 0
    df = df[FEATURES].apply(pd.to_numeric, errors="coerce").fillna(0)
    probs = model.predict_proba(df)[:,1].tolist()
    return {"probabilities": probs, "feature_importances": feature_importances}

@app.get("/")
def health():
    return {"status": "ok", "using_persisted_model": os.path.exists(MODEL_PATH)}
