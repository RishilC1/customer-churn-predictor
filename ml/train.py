# ml/train.py
import sys
import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
from joblib import dump

FEATURES = ["tenure_months", "contract_month_to_month", "num_support_tickets",
            "monthly_spend", "last_login_days"]
TARGET = "churn"  # expects 0/1

def prepare(df: pd.DataFrame) -> pd.DataFrame:
    # Ensure feature columns exist and are numeric
    for col in FEATURES:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    # Target
    if TARGET not in df.columns:
        raise ValueError(f"CSV must include a '{TARGET}' column with 0/1 labels.")
    y = pd.to_numeric(df[TARGET], errors="coerce").fillna(0).astype(int)
    X = df[FEATURES].copy()
    return X, y

def main():
    if len(sys.argv) < 2:
        print("Usage: python train.py /path/to/training.csv")
        sys.exit(1)
    csv_path = Path(sys.argv[1])
    if not csv_path.exists():
        print(f"File not found: {csv_path}")
        sys.exit(1)

    df = pd.read_csv(csv_path)
    X, y = prepare(df)

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = RandomForestClassifier(
        n_estimators=300, max_depth=None, min_samples_leaf=2, random_state=42, n_jobs=-1
    )
    model.fit(Xtr, ytr)

    # Evaluate
    proba = model.predict_proba(Xte)[:, 1]
    auc = roc_auc_score(yte, proba)
    print(f"AUC: {auc:.3f} on held-out test")

    # Save
    dump(model, "model.joblib")
    print("Saved model to model.joblib")

if __name__ == "__main__":
    main()
