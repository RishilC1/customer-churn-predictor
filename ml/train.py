import argparse
import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, accuracy_score
from sklearn.ensemble import RandomForestClassifier
from joblib import dump

FEATURES = ["tenure_months","contract_month_to_month","num_support_tickets","monthly_spend","last_login_days"]
LABEL = "churn"

def main(train_csv: str, model_path: str):
    df = pd.read_csv(train_csv)
    missing = [c for c in FEATURES+[LABEL] if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing required columns: {missing}")

    X = df[FEATURES].apply(pd.to_numeric, errors="coerce").fillna(0)
    y = df[LABEL].astype(int)

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    clf = RandomForestClassifier(n_estimators=300, max_depth=None, random_state=7, class_weight="balanced")
    clf.fit(X_tr, y_tr)

    proba = clf.predict_proba(X_te)[:,1]
    pred = (proba >= 0.5).astype(int)
    auc = roc_auc_score(y_te, proba)
    acc = accuracy_score(y_te, pred)

    os.makedirs(os.path.dirname(model_path) or ".", exist_ok=True)
    dump(clf, model_path)

    print(f"Saved model to: {model_path}")
    print(f"AUC: {auc:.4f}")
    print(f"Accuracy: {acc:.4f}")
    print("Feature importances:", dict(zip(FEATURES, clf.feature_importances_.round(4))))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--train_csv", required=True, help="Path to labeled training CSV")
    ap.add_argument("--model_path", default="model.joblib", help="Where to save the trained model")
    args = ap.parse_args()
    main(args.train_csv, args.model_path)
