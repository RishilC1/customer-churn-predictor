# Customer Churn Predictor

A full-stack machine learning application for predicting customer churn. Built with TypeScript, React, FastAPI, and scikit-learn, this system uses a Random Forest classifier to identify at-risk customers and help businesses implement retention strategies.

## 🎯 Overview

The Customer Churn Predictor combines a modern web interface with a powerful ML backend to provide:
- **Intelligent Predictions**: Uses machine learning to predict customer churn probability
- **Easy Model Training**: Train custom models with your own data
- **Flexible Predictions**: Supports both batch and individual customer predictions
- **Modern UI**: Clean, responsive web interface with dark mode support

## 📊 Features

- **Machine Learning Model**: Random Forest Classifier trained on customer behavior data
- **REST API**: Express.js backend with comprehensive endpoints for predictions and data management
- **React Frontend**: Modern, responsive UI for viewing predictions and uploading data
- **Docker Support**: Containerized services for easy deployment
- **Authentication Ready**: JWT-based authentication infrastructure
- **Batch Processing**: Upload CSV files for bulk predictions
- **Flexible Schema**: Supports both raw and normalized data formats

## 🏗️ Architecture

The system consists of three main services:

### **Web Frontend** (Port 5173)
- React application with TypeScript
- Modern, accessible UI with light/dark mode
- CSV file upload for batch predictions
- Real-time prediction results display
- Built with Vite for fast development and optimized builds

### **API Backend** (Port 4000)
- Express.js REST API
- TypeScript for type safety
- JWT authentication
- CSV parsing and data handling
- Communication with ML service
- Endpoints for predictions, authentication, and data management

### **ML Service** (Port 8000)
- FastAPI Python backend
- scikit-learn Random Forest model
- Pandas for data processing
- Automatic model loading on startup
- Support for both trained models and heuristic fallback
- Batch and single prediction endpoints

## 🚀 Quick Start (Docker - Recommended)

The easiest way to get started is using Docker Compose:

```bash
docker compose up --build
```

This will start all three services:
- **Web Interface**: http://localhost:5173
- **API Server**: http://localhost:4000
- **ML Service**: http://localhost:8000

## 📋 Prerequisites

- **Docker & Docker Compose** (recommended)
- **Node.js 20+** (for local development)
- **Python 3.11+** (for local ML development)

## 🛠️ Local Development

### Setup Web Frontend

```bash
cd web
npm install
npm run dev
```

The web app will be available at http://localhost:5173

### Setup API Backend

```bash
cd api
npm install
npm run dev
```

The API will be available at http://localhost:4000

### Setup ML Service

```bash
cd ml
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

The ML service will be available at http://localhost:8000

## 🤖 Training a Model

To train a custom churn prediction model with your data:

```bash
cd ml
python train.py /path/to/your/training_data.csv
```

### Expected CSV Format

Your training data should include these columns:
- `Tenure` - Customer tenure in months (numeric)
- `Support Calls` - Number of support interactions (numeric)
- `Total Spend` - Customer lifetime spending (numeric)
- `Last Interaction` - Days since last interaction (numeric)
- `Contract Length` - Type of contract (text: "Monthly", "Yearly", etc.)
- `Churn` - Target variable (0 = retained, 1 = churned)

**Example:**
```csv
customer_id,Tenure,Support Calls,Total Spend,Last Interaction,Contract Length,Churn
C001,2,7,135,21,Monthly,1
C002,18,1,55,3,Yearly,0
```

The trained model will be saved as `ml/model.joblib` and automatically loaded on service restart.

## 📁 Project Structure

```
customer-churn-predictor/
├── web/                      # React frontend
│   ├── src/                  # React components and logic
│   ├── index.html            # Entry point
│   ├── package.json          # Dependencies
│   └── Dockerfile            # Web container config
├── api/                       # Express.js backend
│   ├── src/                  # API routes and middleware
│   ├── package.json          # Dependencies
│   └── Dockerfile            # API container config
├── ml/                        # FastAPI ML service
│   ├── app.py                # ML service endpoints
│   ├── train.py              # Model training script
│   ├── requirements.txt       # Python dependencies
│   ├── model.joblib          # Trained model (auto-generated)
│   └── Dockerfile            # ML container config
├── sample_data/               # Example datasets
│   ├── training_sample.csv   # Training data example
│   └── predict_sample.csv    # Prediction data example
└── docker-compose.yml        # Multi-container configuration
```

## 🔌 API Endpoints

### ML Service

- `GET /` - Health check
- `POST /predict` - Predict churn for customer(s)
- `POST /predict-bulk` - Batch predict from CSV file

### API Service

- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login
- `POST /predict` - Submit prediction request
- `GET /health` - API health check

## 🔐 Authentication

The system uses JWT (JSON Web Tokens) for authentication. When running locally, the authentication is configured but can be bypassed for development. For production deployment, ensure to:

1. Set secure JWT secrets
2. Enable HTTPS
3. Configure proper CORS settings
4. Use environment variables for sensitive data

## 📊 Data Format Support

The system supports flexible data formats:

### Normalized Format
```csv
customer_id,tenure_months,contract_month_to_month,num_support_tickets,monthly_spend,last_login_days
P001,2,1,7,135,21
```

### Raw Format
```csv
customer_id,Tenure,Support Calls,Total Spend,Last Interaction,Contract Length
P002,18,1,55,3,Yearly
```

Both formats are automatically detected and converted internally.

## 🧪 Model Performance

The Random Forest classifier is configured with:
- **Estimators**: 300 trees
- **Max Depth**: 10
- **Min Samples per Leaf**: 10
- **Features**: tenure_months, contract_month_to_month, num_support_tickets, monthly_spend, last_login_days

On the sample dataset, the model achieves competitive AUC-ROC scores on held-out test data.

## 📦 Dependencies

### Web
- React 18.3.1
- Vite 5.4.10
- Axios 1.7.7

### API
- Express 4.19.2
- TypeScript 5.5.4
- bcryptjs (authentication)
- multer (file uploads)

### ML
- FastAPI 0.115.0
- scikit-learn 1.5.1
- pandas 2.2.2
- numpy 1.26.4

## 🚢 Deployment

### Using Docker Compose

```bash
docker compose up -d
```

### Environment Configuration

Create a `.env` file in the root directory:

```env
NODE_ENV=production
VITE_API_URL=http://your-api-domain:4000
ML_SERVICE_URL=http://ml-service:8000
JWT_SECRET=your-secret-key
```

## 📝 Configuration

### Web (.env.local)
```
VITE_API_URL=http://localhost:4000
```

### ML Service
The ML service automatically loads `model.joblib` if it exists, otherwise falls back to a heuristic-based prediction.

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and commit them (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support & Issues

If you encounter any issues or have questions, please:
1. Check the [GitHub Issues](https://github.com/RishilC1/customer-churn-predictor/issues)
2. Create a new issue with detailed information
3. Include sample data and error messages if applicable

## 🙏 Acknowledgments

Built with:
- React for the frontend
- Express.js for the API
- FastAPI for the ML service
- scikit-learn for machine learning
