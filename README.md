# 🌍 PackVote (DiscoverYatra) - Group Travel Planning Platform

PackVote is a modern, collaborative group travel planning web application built with **React**, **FastAPI**, **MongoDB**, and **WebSockets**. It features real-time destination & hotel voting, AI-powered itinerary generation, live group text chat, Jitsi video calling, user authentication, profile management, interactive maps, weather forecasts, and expense estimation.

---

## ✨ Features Overview

### 1. 🏛️ Comprehensive Destinations & Exploration
* **149+ Curated Destinations**: High-quality Indian travel spots with categorized hotels, attractions, shopping markets, and transport hubs.
* **Instant Smart Search**: Filter by state, category, keywords, or popularity.
* **City Insights & Highlights**: Heritage walks, street food guides, famous textiles, and spiritual ashrams.
* **Live Weather & Nearby Spots**: OpenWeatherMap live conditions and OpenStreetMap amenities.
* **Expense Breakdown**: Dynamic budget calculator per person and duration.
* **Community Reviews & Ratings**: User-submitted ratings and feedback.

### 2. 👥 Collaborative Trip Planning & Voting
* **Trip Creation**: Generate unique shareable 6-character invite codes.
* **Pending Join Approval**: Creators can review, approve, or reject join requests.
* **Live Real-Time Voting**: Instant synchronized voting for destinations and hotels via WebSockets.
* **Trip Finalization**: Automatic resolution of winning destinations and hotels.
* **Smart Day-by-Day Itineraries**: Manual drag-and-drop itinerary creation + AI-assisted itinerary generation.

### 3. 💬 Real-Time Group Communication
* **Live Group Text Chat**: Real-time group messaging powered by dedicated WebSockets with persistent chat history.
* **Built-in Voice & Video Calling**: One-click Jitsi Meet video conferencing embedded directly inside the Discuss tab.

### 4. 🔐 Authentication & User Profiles
* **Secure JWT Authentication**: User registration, login with bcrypt password hashing.
* **Password Reset**: Token-based secure password recovery flow.
* **Personalized Profiles**: Travel interests tags, home city, preferred budget, and personal emergency contacts.
* **Favorites & Notifications**: Real-time notification feed and one-click bookmarking.

### 5. 🤖 AI-Powered Travel Insights
* **Destination Travel Guide**: Multi-topic insights (overview, culture, food, tips).
* **Group Travel Recommendations**: Tailored destination suggestions based on group preferences and budget.

---

## 🚀 Quick Start (Localhost Development)

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm
* MongoDB running locally on localhost:27017

### Running the Application (Windows)
Double-click 
un.bat or execute in terminal:
`ash
# Terminal 1: Backend
cd backend
.venv\Scripts\uvicorn server:app --host 127.0.0.1 --port 8000

# Terminal 2: Frontend
cd frontend
npm start
`

### Accessing the Services
* **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
* **Backend API Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **API Root**: [http://127.0.0.1:8000/api](http://127.0.0.1:8000/api)

---

## 🐳 Production Deployment

### Option 1: Docker Compose (Single-Command Deployment)
`ash
docker compose up -d --build
`
This boots up:
* mongodb: Database storage container on port 27017
* ackend: FastAPI app on port 8000
* rontend: Production Nginx SPA with reverse proxy on port 3000 (or 80)

### Option 2: Cloud Platform Deployment (e.g. Render / Vercel / Railway / Heroku)

#### Backend (FastAPI on Render / Railway / Heroku):
1. Use Procfile or ackend/Dockerfile.
2. Configure Environment Variables in the platform dashboard:
   * MONGO_URL: Your MongoDB Atlas URI
   * DB_NAME: discoveryatra
   * JWT_SECRET: A strong secret key
   * CORS_ORIGINS: https://your-frontend-domain.com
   * OPENWEATHER_API_KEY: Your OpenWeather key

#### Frontend (React on Vercel / Netlify):
1. Set Root Directory to rontend.
2. Configure Environment Variables:
   * REACT_APP_API_URL: https://your-backend-api.com/api
   * REACT_APP_WS_URL: wss://your-backend-api.com
3. Deploy!

---

## 🧪 Testing & Quality Assurance

### Run Complete End-to-End Feature Audit
`ash
python -Xutf8 backend_test.py
`
`ash
python -Xutf8 scratch/test_all_features_e2e.py
`

### Build Static Production Assets
`ash
npm --prefix frontend run build
`
