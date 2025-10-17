# ChurnGuard

## Run with Docker (recommended)
```bash
docker compose up --build
```
- Web: http://localhost:5173
- API: http://localhost:4000
- ML:  http://localhost:8000

## Local dev (optional, later)
See earlier instructions; Docker-first is simpler.

## Train a model
```bash
cd ml
python train.py ../sample_data/training_sample.csv
```
The ML service will load `model.joblib` automatically on restart.
