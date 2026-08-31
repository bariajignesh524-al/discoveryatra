from fastapi import FastAPI, APIRouter, HTTPException, Query, Depends, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import random
from pymongo.errors import DuplicateKeyError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

gmail_addr = os.environ.get("GMAIL_ADDRESS")
gmail_pwd = os.environ.get("GMAIL_APP_PASSWORD")
print(f"GMAIL_ADDRESS: {'FOUND' if gmail_addr else 'MISSING'}")
print(f"GMAIL_APP_PASSWORD: {'FOUND' if gmail_pwd else 'MISSING'}")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# LLM API Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI(title="PackVote API", description="Group Travel Planning with AI & Voting")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

class Destination(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    state: str
    description: str
    short_description: str
    image_url: str
    latitude: float
    longitude: float
    best_time_to_visit: str
    popular_for: List[str]
    budget_per_day: int = 3000  # Average daily budget
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Hotel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    destination_id: str
    name: str
    description: str
    image_url: str
    rating: float
    price_per_night: int
    amenities: List[str]
    address: str
    latitude: float
    longitude: float

class Attraction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    destination_id: str
    name: str
    description: str
    image_url: str
    category: str
    entry_fee: int
    timings: str
    latitude: float
    longitude: float

class ShoppingMall(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    destination_id: str
    name: str
    description: str
    image_url: str
    address: str
    timings: str
    latitude: float
    longitude: float

class Transport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    destination_id: str
    type: str
    name: str
    description: str
    from_location: str
    to_location: str
    duration: str
    price_range: str
    frequency: str

# ============== NEW MODELS FOR PACKVOTE ==============

class TripCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    creator_name: str
    group_type: str = "friends"  # friends, family, corporate
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_per_person: Optional[int] = None

class Trip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    creator_name: str
    group_type: str
    start_date: Optional[str]
    end_date: Optional[str]
    budget_per_person: Optional[int]
    invite_code: str = Field(default_factory=lambda: ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6)))
    members: List[Dict] = []
    destination_votes: List[Dict] = []
    hotel_votes: List[Dict] = []
    status: str = "planning"  # planning, voting, finalized
    selected_destination: Optional[str] = None
    selected_hotel: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Activity(BaseModel):
    time: str
    title: str
    notes: Optional[str] = ""

class ItineraryDay(BaseModel):
    date: str
    activities: List[Activity] = []

class SaveItineraryRequest(BaseModel):
    itinerary_days: List[ItineraryDay]

class JoinTrip(BaseModel):
    invite_code: str
    member_name: str

class VoteRequest(BaseModel):
    trip_id: str
    voter_name: str
    item_type: str  # destination or hotel
    item_id: str

class CompareRequest(BaseModel):
    item_type: str  # destinations or hotels
    item_ids: List[str]
    destination_id: Optional[str] = None  # Required for hotels

class AISuggestionRequest(BaseModel):
    group_type: str
    budget_per_person: Optional[int] = None
    duration_days: Optional[int] = None
    interests: List[str] = []
    group_size: Optional[int] = None

class AIDescriptionRequest(BaseModel):
    destination_name: str
    topic: str

class ApproveMemberRequest(BaseModel):
    name: str

class RejectMemberRequest(BaseModel):
    name: str

class ReviewCreate(BaseModel):
    member_name: str
    rating: int = Field(..., ge=1, le=5)
    comment: str

class FavoriteRequest(BaseModel):
    member_name: str
    destination_id: str

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    home_city: Optional[str] = None
    preferred_interests: Optional[List[str]] = None
    default_budget_range: Optional[str] = None
    personal_emergency_contact_name: Optional[str] = None
    personal_emergency_contact_number: Optional[str] = None

# Authentication setup
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ.get("JWT_SECRET", "packvote-super-secret-key-999")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[dict]:
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    return {
        "user_id": payload.get("user_id"),
        "name": payload.get("name"),
        "email": payload.get("email")
    }

async def get_authenticated_user(current_user: Optional[dict] = Depends(get_current_user)) -> dict:
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

# ============== SEED DATA ==============

# ============== LOAD CITIES DATA FROM JSON ==============

CITIES_JSON_PATH = ROOT_DIR.parent / 'frontend' / 'src' / 'data' / 'cities.json'

try:
    with open(CITIES_JSON_PATH, 'r', encoding='utf-8') as f:
        cities_data = json.load(f)
    DESTINATIONS_DATA = cities_data['destinations']
    HOTELS_DATA = cities_data['hotels']
    ATTRACTIONS_DATA = cities_data['attractions']
    SHOPPING_DATA = cities_data['shopping']
    TRANSPORT_DATA = cities_data['transport']
    CITY_INFO_DATA = cities_data.get('city_info', {})
    HERITAGE_DATA = cities_data.get('heritage', {})
    STREET_FOOD_DATA = cities_data.get('street_food', {})
    ASHRAMS_DATA = cities_data.get('ashrams', {})
    TEXTILES_DATA = cities_data.get('textiles', {})
except Exception as e:
    # Fallback in case of path issues (e.g. running from tests inside backend)
    fallback_path = ROOT_DIR / 'cities.json'
    if not fallback_path.exists() and CITIES_JSON_PATH.exists():
        import shutil
        shutil.copy(CITIES_JSON_PATH, fallback_path)
    with open(fallback_path, 'r', encoding='utf-8') as f:
        cities_data = json.load(f)
    DESTINATIONS_DATA = cities_data['destinations']
    HOTELS_DATA = cities_data['hotels']
    ATTRACTIONS_DATA = cities_data['attractions']
    SHOPPING_DATA = cities_data['shopping']
    TRANSPORT_DATA = cities_data['transport']
    CITY_INFO_DATA = cities_data.get('city_info', {})
    HERITAGE_DATA = cities_data.get('heritage', {})
    STREET_FOOD_DATA = cities_data.get('street_food', {})
    ASHRAMS_DATA = cities_data.get('ashrams', {})
    TEXTILES_DATA = cities_data.get('textiles', {})

# ============== SEED DATABASE ==============

DATA_VERSION = "master_v56"

async def seed_database():
    """Seed the database with initial data, checking the version first to skip unnecessary writes"""
    # Check current version in db.meta
    meta = await db.meta.find_one({"key": "data_version"})
    stored_version = meta.get("value") if meta else None
    
    if stored_version == DATA_VERSION:
        # Check if database is actually populated
        dest_count = await db.destinations.count_documents({})
        if dest_count > 0:
            return
            
    logger.info(f"Database version mismatch or empty (stored: {stored_version}, current: {DATA_VERSION}). Re-seeding database...")
    
    # Completely drop existing records in these collections to ensure only new Gujarat cities exist
    await db.destinations.delete_many({})
    await db.hotels.delete_many({})
    await db.attractions.delete_many({})
    await db.shopping.delete_many({})
    await db.transport.delete_many({})
    await db.city_info.delete_many({})
    await db.heritage.delete_many({})
    await db.street_food.delete_many({})
    await db.ashrams.delete_many({})
    await db.textiles.delete_many({})
    
    for dest in DESTINATIONS_DATA:
        dest_doc = {**dest, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.destinations.insert_one(dest_doc)
    
    for dest_id, hotels in HOTELS_DATA.items():
        for hotel in hotels:
            hotel_doc = {"id": hotel.get("id", str(uuid.uuid4())), "destination_id": dest_id, **hotel}
            await db.hotels.insert_one(hotel_doc)
    
    for dest_id, attractions in ATTRACTIONS_DATA.items():
        for attraction in attractions:
            attr_doc = {"id": attraction.get("id", str(uuid.uuid4())), "destination_id": dest_id, **attraction}
            await db.attractions.insert_one(attr_doc)
    
    for dest_id, shops in SHOPPING_DATA.items():
        for shop in shops:
            shop_doc = {"id": shop.get("id", str(uuid.uuid4())), "destination_id": dest_id, **shop}
            await db.shopping.insert_one(shop_doc)
    
    for dest_id, transports in TRANSPORT_DATA.items():
        for transport in transports:
            trans_doc = {"id": transport.get("id", str(uuid.uuid4())), "destination_id": dest_id, **transport}
            await db.transport.insert_one(trans_doc)

    for dest_id, c_info in CITY_INFO_DATA.items():
        doc = {"destination_id": dest_id, **c_info}
        await db.city_info.insert_one(doc)

    for dest_id, heritage_list in HERITAGE_DATA.items():
        for item in heritage_list:
            doc = {"id": item.get("id", str(uuid.uuid4())), "destination_id": dest_id, **item}
            await db.heritage.insert_one(doc)

    for dest_id, food_list in STREET_FOOD_DATA.items():
        for item in food_list:
            doc = {"id": item.get("id", str(uuid.uuid4())), "destination_id": dest_id, **item}
            await db.street_food.insert_one(doc)

    for dest_id, ashram_list in ASHRAMS_DATA.items():
        for item in ashram_list:
            doc = {"id": item.get("id", str(uuid.uuid4())), "destination_id": dest_id, **item}
            await db.ashrams.insert_one(doc)

    for dest_id, textile_list in TEXTILES_DATA.items():
        for item in textile_list:
            doc = {"id": item.get("id", str(uuid.uuid4())), "destination_id": dest_id, **item}
            await db.textiles.insert_one(doc)
            
    # Update stored version in db.meta
    await db.meta.update_one(
        {"key": "data_version"},
        {"$set": {"value": DATA_VERSION}},
        upsert=True
    )
    
    try:
        await db.users.create_index("user_id", unique=True)
        await db.users.create_index("email", unique=True)
    except Exception:
        pass
    
    logger.info("Database seeded successfully from cities.json!")

# ============== ORIGINAL API ENDPOINTS ==============

@api_router.get("/")
async def root():
    return {"message": "PackVote API - Group Travel Planning with AI & Voting!"}

@api_router.post("/auth/register")
async def register_user(request: UserRegister):
    """Register a new user, hash password, and issue a JWT token"""
    await seed_database()
    existing_user = await db.users.find_one({"email": request.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    user_id = str(uuid.uuid4())
    hashed_pwd = hash_password(request.password)
    
    user_doc = {
        "user_id": user_id,
        "name": request.name,
        "email": request.email.lower(),
        "hashed_password": hashed_pwd,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token({
        "user_id": user_id,
        "name": request.name,
        "email": request.email.lower()
    })
    
    return {"token": token, "user_id": user_id, "name": request.name, "email": request.email.lower()}

@api_router.post("/auth/login")
async def login_user(request: UserLogin):
    """Authenticate email and password, returning JWT token if valid"""
    await seed_database()
    user = await db.users.find_one({"email": request.email.lower()})
    if not user or not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token = create_access_token({
        "user_id": user["user_id"],
        "name": user["name"],
        "email": user["email"]
    })
    
    return {"token": token, "user_id": user["user_id"], "name": user["name"], "email": user["email"]}

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Generate a random reset token, save to user document, and send reset link email"""
    await seed_database()
    user = await db.users.find_one({"email": request.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="Email address not found")
        
    import secrets
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    
    await db.users.update_one(
        {"email": request.email.lower()},
        {"$set": {
            "reset_token": token,
            "reset_expiry": expiry.isoformat()
        }}
    )
    
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    
    gmail_address = os.environ.get("GMAIL_ADDRESS")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD")
    
    if not gmail_address or not gmail_app_password:
        print("\n" + "="*80)
        print(f"[DEV MODE] Password reset requested for: {request.email.lower()}")
        print(f"Reset Link: {reset_link}")
        print("="*80 + "\n")
        return {
            "message": "Mail service not configured. Reset link logged to backend console.",
            "debug_link": reset_link
        }
        
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    msg = MIMEMultipart()
    msg['From'] = gmail_address
    msg['To'] = request.email.lower()
    msg['Subject'] = "Reset your PackVote Password"
    
    body = f"Hello,\n\nYou requested to reset your password. Please click the link below to set a new password (valid for 1 hour):\n\n{reset_link}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nPackVote Team"
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(gmail_address, gmail_app_password)
        text = msg.as_string()
        server.sendmail(gmail_address, request.email.lower(), text)
        server.quit()
        return {"message": "Password reset email sent successfully!"}
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        print("\n" + "="*80)
        print(f"[SMTP FAIL FALLBACK] Password reset requested for: {request.email.lower()}")
        print(f"Reset Link: {reset_link}")
        print("="*80 + "\n")
        return {
            "message": f"Failed to send email: {str(e)}. Reset link logged to backend console.",
            "debug_link": reset_link
        }

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Verify reset token and update user password"""
    await seed_database()
    user = await db.users.find_one({"reset_token": request.token})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    expiry_str = user.get("reset_expiry")
    if not expiry_str:
        raise HTTPException(status_code=400, detail="Invalid reset token")
        
    try:
        expiry_dt = datetime.fromisoformat(expiry_str)
        now = datetime.now(timezone.utc)
        if expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
        if now > expiry_dt:
            raise HTTPException(status_code=400, detail="Reset token has expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid token expiry format")
        
    hashed_pwd = hash_password(request.new_password)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"hashed_password": hashed_pwd}, "$unset": {"reset_token": "", "reset_expiry": ""}}
    )
    
    return {"message": "Password reset successfully!"}

@api_router.get("/users/me")
async def get_my_profile(current_user: dict = Depends(get_authenticated_user)):
    """Retrieve details for the currently logged in user"""
    await seed_database()
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "email": user["email"],
        "bio": user.get("bio", ""),
        "created_at": user.get("created_at"),
        "phone_number": user.get("phone_number", ""),
        "avatar_url": user.get("avatar_url", ""),
        "home_city": user.get("home_city", ""),
        "preferred_interests": user.get("preferred_interests", []),
        "default_budget_range": user.get("default_budget_range", ""),
        "personal_emergency_contact_name": user.get("personal_emergency_contact_name", ""),
        "personal_emergency_contact_number": user.get("personal_emergency_contact_number", "")
    }

@api_router.patch("/users/me")
async def update_my_profile(request: UserProfileUpdate, current_user: dict = Depends(get_authenticated_user)):
    """Update profile fields for the logged in user"""
    await seed_database()
    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.bio is not None:
        update_data["bio"] = request.bio
    if request.phone_number is not None:
        update_data["phone_number"] = request.phone_number
    if request.avatar_url is not None:
        update_data["avatar_url"] = request.avatar_url
    if request.home_city is not None:
        update_data["home_city"] = request.home_city
    if request.preferred_interests is not None:
        update_data["preferred_interests"] = request.preferred_interests
    if request.default_budget_range is not None:
        update_data["default_budget_range"] = request.default_budget_range
    if request.personal_emergency_contact_name is not None:
        update_data["personal_emergency_contact_name"] = request.personal_emergency_contact_name
    if request.personal_emergency_contact_number is not None:
        update_data["personal_emergency_contact_number"] = request.personal_emergency_contact_number
        
    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")
        
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    return {
        "user_id": user["user_id"],
        "name": user["name"],
        "email": user["email"],
        "bio": user.get("bio", ""),
        "created_at": user.get("created_at"),
        "phone_number": user.get("phone_number", ""),
        "avatar_url": user.get("avatar_url", ""),
        "home_city": user.get("home_city", ""),
        "preferred_interests": user.get("preferred_interests", []),
        "default_budget_range": user.get("default_budget_range", ""),
        "personal_emergency_contact_name": user.get("personal_emergency_contact_name", ""),
        "personal_emergency_contact_number": user.get("personal_emergency_contact_number", "")
    }

@api_router.get("/destinations", response_model=List[Dict])
async def get_destinations():
    await seed_database()
    destinations = await db.destinations.find({}, {"_id": 0}).to_list(1000)
    return destinations

@api_router.get("/destinations/search")
async def search_destinations(q: str = Query(..., min_length=1)):
    await seed_database()
    query = {
        "$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"state": {"$regex": q, "$options": "i"}},
            {"district": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
            {"top_attractions": {"$elemMatch": {"$regex": q, "$options": "i"}}},
            {"popular_for": {"$elemMatch": {"$regex": q, "$options": "i"}}}
        ]
    }
    destinations = await db.destinations.find(query, {"_id": 0}).to_list(1000)
    return destinations

@api_router.get("/destinations/{destination_id}")
async def get_destination(destination_id: str):
    await seed_database()
    destination = await db.destinations.find_one({"id": destination_id}, {"_id": 0})
    if not destination:
        raise HTTPException(status_code=404, detail="Destination not found")
    return destination

@api_router.get("/destinations/{destination_id}/weather")
async def get_destination_weather(destination_id: str):
    """Proxy OpenWeatherMap Current Weather API using latitude/longitude"""
    await seed_database()
    dest = await db.destinations.find_one({"id": destination_id}, {"_id": 0})
    if not dest:
        return {"error": True, "reason": "Destination not found"}
        
    lat = dest.get("latitude")
    lon = dest.get("longitude")
    print(f"Destination coordinates: lat={lat}, lon={lon}")
    
    if lat is None or lon is None:
        return {"error": True, "reason": "Destination coordinates not found"}
        
    try:
        print(f"DEBUG: OPENWEATHER_API_KEY loaded as: '{os.environ.get('OPENWEATHER_API_KEY')}'")
        api_key = os.environ.get("OPENWEATHER_API_KEY")
        if not api_key:
            from dotenv import dotenv_values
            from pathlib import Path
            current_dir = Path(__file__).parent
            env_vals = dotenv_values(current_dir.parent / ".env")
            api_key = env_vals.get("OPENWEATHER_API_KEY")
            print(f"DEBUG: OPENWEATHER_API_KEY loaded from .env as: '{api_key}'")
            if api_key:
                os.environ["OPENWEATHER_API_KEY"] = api_key
            
        if not api_key:
            return {"error": True, "reason": "OpenWeather API key not configured"}
            
        masked_key = "..." + api_key[-4:] if api_key and len(api_key) >= 4 else "..."
        masked_url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={masked_key}&units=metric"
        print(f"Calling OpenWeatherMap URL: {masked_url}")
        
        url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        
        import urllib.request
        import urllib.error
        import json
        from fastapi.concurrency import run_in_threadpool
        
        def fetch_weather():
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10.0) as r:
                return json.loads(r.read().decode('utf-8'))
                
        data = await run_in_threadpool(fetch_weather)
        main_weather = data.get("weather", [{}])[0]
        return {
            "temp": data.get("main", {}).get("temp"),
            "condition": main_weather.get("main"),
            "description": main_weather.get("description"),
            "icon": main_weather.get("icon")
        }
    except Exception as exc:
        import traceback
        import urllib.error
        traceback.print_exc()
        
        masked_key = "..." + api_key[-4:] if 'api_key' in locals() and api_key and len(api_key) >= 4 else "..."
        masked_url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={masked_key}&units=metric"
        print(f"Failed calling OpenWeatherMap URL: {masked_url}")
        
        reason_msg = str(exc)
        if isinstance(exc, urllib.error.HTTPError):
            try:
                body = exc.read().decode('utf-8')
                print(f"OpenWeather HTTPError raw response: status={exc.code}, body={body}")
                reason_msg = f"HTTP Error {exc.code}: {body}"
            except Exception as read_err:
                print(f"Failed to read error body: {str(read_err)}")
                
        return {"error": True, "reason": reason_msg}

nearby_cache = {}  # {destination_id: (timestamp, data)}

@api_router.get("/destinations/{destination_id}/nearby")
async def get_destination_nearby(destination_id: str):
    """Query Overpass API for nearby restaurants, ATMs, and pharmacies within 5km"""
    await seed_database()
    dest = await db.destinations.find_one({"id": destination_id}, {"_id": 0})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    lat = dest.get("latitude")
    lon = dest.get("longitude")
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Destination coordinates not found")
        
    import time
    now = time.time()
    if destination_id in nearby_cache:
        cached_time, cached_data = nearby_cache[destination_id]
        if now - cached_time < 10800:  # 3 hours cache
            return cached_data
            
    overpass_url = "https://overpass-api.de/api/interpreter"
    query_15 = f"""[out:json][timeout:25];
(
  node["amenity"="restaurant"](around:15000,{lat},{lon});
  node["amenity"="atm"](around:15000,{lat},{lon});
  node["amenity"="pharmacy"](around:15000,{lat},{lon});
);
out 100;"""
    
    import urllib.request
    import urllib.parse
    import json
    from fastapi.concurrency import run_in_threadpool
    import ssl
    import math
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    def fetch_url(url_to_fetch):
        req = urllib.request.Request(url_to_fetch, headers={'User-Agent': 'DiscoveryAtraApp/1.0 (contact@discoveryatra.com)'})
        with urllib.request.urlopen(req, timeout=30.0, context=ctx) as r:
            return json.loads(r.read().decode('utf-8'))
            
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0  # Earth radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c
        
    try:
        url_15 = f"{overpass_url}?data={urllib.parse.quote(query_15)}"
        res_data = await run_in_threadpool(fetch_url, url_15)
        elements = res_data.get("elements", [])
        
        restaurants = []
        atms = []
        pharmacies = []
        
        for el in elements:
            el_lat = el.get("lat")
            el_lon = el.get("lon")
            if el_lat is None or el_lon is None:
                continue
                
            dist = haversine(lat, lon, el_lat, el_lon)
            tags = el.get("tags", {})
            name = tags.get("name", tags.get("brand", "Unnamed Place"))
            amenity = tags.get("amenity")
            
            place_item = {
                "name": name,
                "distance": round(dist, 2),
                "latitude": el_lat,
                "longitude": el_lon,
                "amenity": amenity
            }
            
            if amenity == "restaurant":
                restaurants.append(place_item)
            elif amenity == "atm":
                atms.append(place_item)
            elif amenity == "pharmacy":
                pharmacies.append(place_item)
                
        # If any category is empty, retry that category with 30km radius
        missing_amenities = []
        if not restaurants:
            missing_amenities.append("restaurant")
        if not atms:
            missing_amenities.append("atm")
        if not pharmacies:
            missing_amenities.append("pharmacy")
            
        if missing_amenities:
            clauses = "\n  ".join([f'node["amenity"="{a}"](around:30000,{lat},{lon});' for a in missing_amenities])
            query_30 = f"""[out:json][timeout:25];
(
  {clauses}
);
out 100;"""
            url_30 = f"{overpass_url}?data={urllib.parse.quote(query_30)}"
            try:
                res_data_30 = await run_in_threadpool(fetch_url, url_30)
                elements_30 = res_data_30.get("elements", [])
                for el in elements_30:
                    el_lat = el.get("lat")
                    el_lon = el.get("lon")
                    if el_lat is None or el_lon is None:
                        continue
                        
                    dist = haversine(lat, lon, el_lat, el_lon)
                    tags = el.get("tags", {})
                    name = tags.get("name", tags.get("brand", "Unnamed Place"))
                    amenity = tags.get("amenity")
                    
                    place_item = {
                        "name": name,
                        "distance": round(dist, 2),
                        "latitude": el_lat,
                        "longitude": el_lon,
                        "amenity": amenity
                    }
                    
                    if amenity == "restaurant":
                        restaurants.append(place_item)
                    elif amenity == "atm":
                        atms.append(place_item)
                    elif amenity == "pharmacy":
                        pharmacies.append(place_item)
            except Exception as retry_exc:
                print(f"Fallback 30km query failed: {retry_exc}")
                
        restaurants.sort(key=lambda x: x["distance"])
        atms.sort(key=lambda x: x["distance"])
        pharmacies.sort(key=lambda x: x["distance"])
        
        parsed_result = {
            "restaurants": restaurants[:10],
            "atms": atms[:10],
            "pharmacies": pharmacies[:10]
        }
        
        nearby_cache[destination_id] = (now, parsed_result)
        return parsed_result
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {"error": True}

@api_router.get("/destinations/{destination_id}/expense-estimate")
async def get_destination_expense_estimate(destination_id: str, group_size: int = 1, duration_days: int = 1):
    """Calculate dynamic expense breakdown based on group size, duration, and destination budget per day"""
    await seed_database()
    dest = await db.destinations.find_one({"id": destination_id}, {"_id": 0})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    budget_per_day = dest.get("budget_per_day", 0)
    # Default to 2000 if not present or invalid
    if not isinstance(budget_per_day, (int, float)) or budget_per_day <= 0:
        budget_per_day = 2000
        
    total_accommodation = budget_per_day * 0.4 * duration_days * group_size
    total_food = budget_per_day * 0.3 * duration_days * group_size
    total_transport = budget_per_day * 0.2 * duration_days * group_size
    total_misc = budget_per_day * 0.1 * duration_days * group_size
    grand_total = total_accommodation + total_food + total_transport + total_misc
    
    return {
        "budget_per_day": budget_per_day,
        "total_accommodation_hotel": round(total_accommodation, 2),
        "total_food": round(total_food, 2),
        "total_transport": round(total_transport, 2),
        "total_misc": round(total_misc, 2),
        "grand_total": round(grand_total, 2)
    }

@api_router.get("/destinations/{destination_id}/hotels")
async def get_destination_hotels(destination_id: str):
    await seed_database()
    hotels = await db.hotels.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return hotels

@api_router.get("/destinations/{destination_id}/attractions")
async def get_destination_attractions(destination_id: str):
    await seed_database()
    attractions = await db.attractions.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return attractions

@api_router.get("/destinations/{destination_id}/shopping")
async def get_destination_shopping(destination_id: str):
    await seed_database()
    shopping = await db.shopping.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return shopping

@api_router.get("/destinations/{destination_id}/transport")
async def get_destination_transport(destination_id: str):
    await seed_database()
    transport = await db.transport.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return transport

@api_router.get("/destinations/{destination_id}/city-info")
async def get_destination_city_info(destination_id: str):
    await seed_database()
    city_info = await db.city_info.find_one({"destination_id": destination_id}, {"_id": 0})
    if not city_info:
        return {}
    return city_info

@api_router.get("/destinations/{destination_id}/heritage")
async def get_destination_heritage(destination_id: str):
    await seed_database()
    heritage = await db.heritage.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return heritage

@api_router.get("/destinations/{destination_id}/street-food")
async def get_destination_street_food(destination_id: str):
    await seed_database()
    street_food = await db.street_food.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return street_food

@api_router.get("/destinations/{destination_id}/ashrams")
async def get_destination_ashrams(destination_id: str):
    await seed_database()
    ashrams = await db.ashrams.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return ashrams

@api_router.get("/destinations/{destination_id}/textiles")
async def get_destination_textiles(destination_id: str):
    await seed_database()
    textiles = await db.textiles.find({"destination_id": destination_id}, {"_id": 0}).to_list(50)
    return textiles

@api_router.post("/destinations/{destination_id}/reviews")
async def create_destination_review(destination_id: str, review_data: ReviewCreate, current_user: Optional[dict] = Depends(get_current_user)):
    """Save a new review for a destination"""
    await seed_database()
    dest = await db.destinations.find_one({"id": destination_id})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    user_id = current_user["user_id"] if current_user else None
    review = {
        "id": str(uuid.uuid4()),
        "destination_id": destination_id,
        "member_name": review_data.member_name,
        "user_id": user_id,
        "rating": review_data.rating,
        "comment": review_data.comment,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    return review

@api_router.get("/destinations/{destination_id}/reviews")
async def get_destination_reviews(destination_id: str):
    """Get all reviews for a destination, sorted by created_at descending"""
    await seed_database()
    dest = await db.destinations.find_one({"id": destination_id})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    reviews = await db.reviews.find({"destination_id": destination_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return reviews

@api_router.post("/favorites")
async def add_favorite(request: FavoriteRequest, current_user: Optional[dict] = Depends(get_current_user)):
    """Add a destination to a member's favorites"""
    await seed_database()
    dest = await db.destinations.find_one({"id": request.destination_id})
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    try:
        user_id = current_user["user_id"] if current_user else None
        favorite = {
            "member_name": request.member_name,
            "destination_id": request.destination_id,
            "user_id": user_id,
            "added_at": datetime.now(timezone.utc)
        }
        await db.favorites.insert_one(favorite)
        favorite.pop("_id", None)
        return favorite
    except DuplicateKeyError:
        return {"message": "Already favorited", "member_name": request.member_name, "destination_id": request.destination_id}

@api_router.delete("/favorites")
async def remove_favorite(member_name: str = Query(...), destination_id: str = Query(...)):
    """Remove a favorite from a member's list"""
    await seed_database()
    res = await db.favorites.delete_one({"member_name": member_name, "destination_id": destination_id})
    return {"deleted": res.deleted_count > 0}

@api_router.get("/favorites/{member_name}")
async def get_member_favorites(member_name: str):
    """Get all favorited destinations for a member"""
    await seed_database()
    favs = await db.favorites.find({"member_name": member_name}).to_list(1000)
    dest_ids = [f['destination_id'] for f in favs]
    destinations = await db.destinations.find({"id": {"$in": dest_ids}}, {"_id": 0}).to_list(1000)
    return destinations

@api_router.get("/notifications/{member_name}")
async def get_member_notifications(member_name: str):
    """Get all notifications for a member, sorted by created_at descending"""
    await seed_database()
    import re
    regex = re.compile(f"^{re.escape(member_name)}$", re.IGNORECASE)
    notifications = await db.notifications.find({"member_name": regex}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return notifications

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    await seed_database()
    res = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

# ============== NEW PACKVOTE API ENDPOINTS ==============

@api_router.post("/trips")
async def create_trip(trip_data: TripCreate, current_user: Optional[dict] = Depends(get_current_user)):
    """Create a new trip for group planning"""
    user_id = current_user["user_id"] if current_user else None
    trip = Trip(
        name=trip_data.name,
        description=trip_data.description or "",
        creator_name=trip_data.creator_name,
        group_type=trip_data.group_type,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        budget_per_person=trip_data.budget_per_person,
        members=[{"name": trip_data.creator_name, "is_creator": True, "joined_at": datetime.now(timezone.utc).isoformat(), "user_id": user_id}]
    )
    
    trip_dict = trip.model_dump()
    trip_dict['created_at'] = trip_dict['created_at'].isoformat()
    
    await db.trips.insert_one(trip_dict)
    return {"trip_id": trip.id, "invite_code": trip.invite_code, "message": "Trip created successfully!"}

async def create_notification(member_name: str, trip_id: str, message: str):
    user_id = None
    trip = await db.trips.find_one({"id": trip_id})
    if trip:
        for m in trip.get("members", []):
            if m["name"].lower() == member_name.lower():
                user_id = m.get("user_id")
                break
    notification = {
        "id": str(uuid.uuid4()),
        "member_name": member_name,
        "user_id": user_id,
        "trip_id": trip_id,
        "message": message,
        "created_at": datetime.now(timezone.utc),
        "read": False
    }
    await db.notifications.insert_one(notification)

@api_router.post("/trips/join")
async def join_trip(join_data: JoinTrip, current_user: Optional[dict] = Depends(get_current_user)):
    """Join an existing trip using invite code"""
    trip = await db.trips.find_one({"invite_code": join_data.invite_code}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if already a member
    for member in trip.get('members', []):
        if member['name'].lower() == join_data.member_name.lower():
            raise HTTPException(status_code=400, detail="You're already a member of this trip")
            
    # Check if already pending approval
    for pending in trip.get('pending_members', []):
        if pending['name'].lower() == join_data.member_name.lower():
            raise HTTPException(status_code=400, detail="You have already requested to join this trip. Waiting for approval.")
    
    user_id = current_user["user_id"] if current_user else None
    pending_member = {
        "name": join_data.member_name,
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id
    }
    
    await db.trips.update_one(
        {"invite_code": join_data.invite_code},
        {"$push": {"pending_members": pending_member}}
    )
    
    await create_notification(
        member_name=trip['creator_name'],
        trip_id=trip['id'],
        message=f"{join_data.member_name} requested to join your trip {trip['name']}"
    )
    
    return {
        "trip_id": trip['id'],
        "trip_name": trip['name'],
        "message": f"Join request submitted! Waiting for approval from the trip creator.",
        "pending": True
    }

@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str):
    """Get trip details with votes"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@api_router.get("/trips/code/{invite_code}")
async def get_trip_by_code(invite_code: str):
    """Get trip details by invite code"""
    trip = await db.trips.find_one({"invite_code": invite_code}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip

@api_router.get("/trips/history/{member_name}")
async def get_member_trip_history(member_name: str):
    """Get all trips where this member is creator or member, sorted by created_at descending"""
    await seed_database()
    import re
    regex = re.compile(f"^{re.escape(member_name)}$", re.IGNORECASE)
    
    query = {
        "$or": [
            {"creator_name": regex},
            {"members.name": regex}
        ]
    }
    
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return trips

@api_router.post("/trips/{trip_id}/vote")
async def vote_on_item(trip_id: str, vote: VoteRequest):
    """Vote on a destination or hotel"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Restrict voting to approved members and creator
    is_member = trip.get("creator_name", "").lower() == vote.voter_name.lower() or any(
        m["name"].lower() == vote.voter_name.lower() for m in trip.get("members", [])
    )
    if not is_member:
        raise HTTPException(status_code=403, detail="Only approved members can vote")
    
    vote_field = f"{vote.item_type}_votes"
    existing_votes = trip.get(vote_field, [])
    
    # Remove previous vote by same voter for same type
    existing_votes = [v for v in existing_votes if v['voter_name'] != vote.voter_name]
    
    # Add new vote
    existing_votes.append({
        "voter_name": vote.voter_name,
        "item_id": vote.item_id,
        "voted_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {vote_field: existing_votes}}
    )
    
    try:
        item_name = vote.item_id
        if vote.item_type == "destination":
            dest = await db.destinations.find_one({"id": vote.item_id})
            if dest:
                item_name = dest["name"]
        elif vote.item_type == "hotel":
            hotel = await db.hotels.find_one({"id": vote.item_id})
            if hotel:
                item_name = hotel["name"]

        await create_notification(
            member_name=trip['creator_name'],
            trip_id=trip_id,
            message=f"{vote.voter_name} voted on {item_name}"
        )
    except Exception as e:
        import traceback
        logger.error(f"Failed to create notification for vote: {str(e)}")
        traceback.print_exc()
        
    try:
        tally = await get_voting_results_internal(trip_id)
        if tally:
            await manager.broadcast_to_trip(trip_id, tally)
    except Exception as ws_err:
        logger.error(f"WebSocket broadcast failed for trip {trip_id}: {str(ws_err)}")
    
    return {"message": "Vote recorded!", "total_votes": len(existing_votes)}

async def get_voting_results_internal(trip_id: str) -> Optional[dict]:
    """Helper to calculate voting results for a trip"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        return None
    
    # Count destination votes
    dest_votes = {}
    for vote in trip.get('destination_votes', []):
        item_id = vote['item_id']
        dest_votes[item_id] = dest_votes.get(item_id, 0) + 1
    
    # Count hotel votes
    hotel_votes = {}
    for vote in trip.get('hotel_votes', []):
        item_id = vote['item_id']
        hotel_votes[item_id] = hotel_votes.get(item_id, 0) + 1
    
    # Get winning items
    winning_dest = max(dest_votes, key=dest_votes.get) if dest_votes else None
    winning_hotel = max(hotel_votes, key=hotel_votes.get) if hotel_votes else None
    
    return {
        "destination_votes": dest_votes,
        "hotel_votes": hotel_votes,
        "winning_destination": winning_dest,
        "winning_hotel": winning_hotel,
        "total_members": len(trip.get('members', []))
    }

@api_router.get("/trips/{trip_id}/results")
async def get_voting_results(trip_id: str):
    """Get voting results for a trip"""
    results = await get_voting_results_internal(trip_id)
    if results is None:
        raise HTTPException(status_code=404, detail="Trip not found")
    return results

@api_router.get("/trips/{trip_id}/messages")
async def get_trip_messages(trip_id: str):
    """Retrieve message history for a trip's chat"""
    await seed_database()
    messages = await db.messages.find({"trip_id": trip_id}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    return messages

@api_router.post("/trips/{trip_id}/finalize")
async def finalize_trip(trip_id: str):
    """Finalize trip based on votes"""
    results = await get_voting_results(trip_id)
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {
            "status": "finalized",
            "selected_destination": results['winning_destination'],
            "selected_hotel": results['winning_hotel']
        }}
    )
    
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    members_to_notify = {trip['creator_name']}
    for member in trip.get('members', []):
        members_to_notify.add(member['name'])
        
    for name in members_to_notify:
        await create_notification(
            member_name=name,
            trip_id=trip_id,
            message=f"Your trip {trip['name']} has been finalized"
        )
        
    return {"message": "Trip finalized!", "destination": results['winning_destination'], "hotel": results['winning_hotel']}

@api_router.post("/trips/{trip_id}/approve-member")
async def approve_member(trip_id: str, request: ApproveMemberRequest, current_user: Optional[dict] = Depends(get_current_user)):
    """Approve a pending join request and promote to members list"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    pending = [m for m in trip.get("pending_members", []) if m["name"].lower() == request.name.lower()]
    if not pending:
        raise HTTPException(status_code=400, detail="Member not found in pending requests")
        
    pending_member = pending[0]
    
    # Remove from pending_members
    await db.trips.update_one(
        {"id": trip_id},
        {"$pull": {"pending_members": {"name": pending_member["name"]}}}
    )
    
    # Add to members
    new_member = {
        "name": pending_member["name"],
        "is_creator": False,
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "user_id": pending_member.get("user_id")
    }
    await db.trips.update_one(
        {"id": trip_id},
        {"$push": {"members": new_member}}
    )
    
    # Create notification for approved member
    await create_notification(
        member_name=pending_member["name"],
        trip_id=trip_id,
        message=f"Your request to join {trip['name']} has been approved."
    )
    
    return {"message": f"Approved {request.name} successfully!"}

@api_router.post("/trips/{trip_id}/reject-member")
async def reject_member(trip_id: str, request: RejectMemberRequest, current_user: Optional[dict] = Depends(get_current_user)):
    """Reject a pending join request"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Remove from pending_members
    await db.trips.update_one(
        {"id": trip_id},
        {"$pull": {"pending_members": {"name": request.name}}}
    )
    
    return {"message": f"Rejected {request.name} successfully!"}

@api_router.post("/trips/{trip_id}/itinerary")
async def save_trip_itinerary(trip_id: str, request: SaveItineraryRequest):
    """Save or replace the full itinerary days for a finalized trip"""
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    itinerary_dict = [day.model_dump() for day in request.itinerary_days]
    
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {"itinerary_days": itinerary_dict}}
    )
    return {"message": "Itinerary updated successfully", "itinerary_days": itinerary_dict}

@api_router.get("/trips/{trip_id}/itinerary")
async def get_trip_itinerary(trip_id: str):
    """Get the saved itinerary days for a trip"""
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    itinerary_days = trip.get("itinerary_days", [])
    return {"itinerary_days": itinerary_days}

@api_router.post("/trips/{trip_id}/generate-itinerary")
async def generate_trip_itinerary(trip_id: str):
    """Generate a day-by-day itinerary using the AI service call pattern, reading real database attractions"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
        
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    dest_id = trip.get("selected_destination")
    if not dest_id:
        raise HTTPException(status_code=400, detail="Destination not selected/finalized for this trip")
        
    # Get duration
    duration_days = 3
    if trip.get("start_date") and trip.get("end_date"):
        try:
            d1 = datetime.strptime(trip["start_date"], "%Y-%m-%d")
            d2 = datetime.strptime(trip["end_date"], "%Y-%m-%d")
            duration_days = max(1, (d2 - d1).days + 1)
        except Exception:
            pass
            
    # Generate dates list
    import datetime as dt_mod
    dates = []
    if trip.get("start_date"):
        try:
            start_dt = dt_mod.datetime.strptime(trip["start_date"], "%Y-%m-%d")
            for i in range(duration_days):
                curr_date = start_dt + dt_mod.timedelta(days=i)
                dates.append(curr_date.strftime("%Y-%m-%d"))
        except Exception:
            pass
            
    if not dates:
        today = dt_mod.date.today()
        for i in range(duration_days):
            dates.append((today + dt_mod.timedelta(days=i)).strftime("%Y-%m-%d"))

    # Fetch attractions
    attractions = await db.attractions.find({"destination_id": dest_id}).to_list(100)
    
    itinerary_days = []
    attraction_idx = 0
    
    for i, date_str in enumerate(dates):
        activities = []
        
        # Schedule morning
        if attraction_idx < len(attractions):
            attr = attractions[attraction_idx]
            attraction_idx += 1
            activities.append({
                "time": "09:00",
                "title": f"Explore {attr['name']}",
                "notes": f"Enjoy the morning sightseeing at {attr['name']}."
            })
        else:
            activities.append({
                "time": "09:00",
                "title": "Local Exploration",
                "notes": "Discover the local streets and hidden spots."
            })
            
        # Schedule afternoon
        if attraction_idx < len(attractions):
            attr = attractions[attraction_idx]
            attraction_idx += 1
            activities.append({
                "time": "14:00",
                "title": f"Visit {attr['name']}",
                "notes": f"Tour details: {attr['description'][:80]}..."
            })
        else:
            activities.append({
                "time": "14:00",
                "title": "Local Market Shopping",
                "notes": "Shop for souvenirs and traditional crafts."
            })
            
        # Schedule evening
        if attraction_idx < len(attractions):
            attr = attractions[attraction_idx]
            attraction_idx += 1
            activities.append({
                "time": "17:30",
                "title": f"Sightseeing at {attr['name']}",
                "notes": "Relax and take photographs."
            })
        else:
            activities.append({
                "time": "18:00",
                "title": "Cuisine Dinner Tour",
                "notes": "Try authentic local delicacies for dinner."
            })
            
        itinerary_days.append({
            "date": date_str,
            "activities": activities
        })
        
    await db.trips.update_one(
        {"id": trip_id},
        {"$set": {"itinerary_days": itinerary_days}}
    )
    
    return {"message": "AI Itinerary generated successfully", "itinerary_days": itinerary_days}

@api_router.post("/compare")
async def compare_items(request: CompareRequest):
    """Compare destinations or hotels"""
    await seed_database()
    
    if request.item_type == "destinations":
        items = await db.destinations.find({"id": {"$in": request.item_ids}}, {"_id": 0}).to_list(10)
        
        comparison = []
        for item in items:
            hotels = await db.hotels.find({"destination_id": item['id']}, {"_id": 0}).to_list(10)
            avg_hotel_price = sum(h['price_per_night'] for h in hotels) / len(hotels) if hotels else 0
            
            comparison.append({
                "id": item['id'],
                "name": item['name'],
                "state": item['state'],
                "image_url": item['image_url'],
                "best_time_to_visit": item['best_time_to_visit'],
                "budget_per_day": item.get('budget_per_day', 3000),
                "avg_hotel_price": int(avg_hotel_price),
                "popular_for": item['popular_for']
            })
        
        return {"type": "destinations", "items": comparison}
    
    elif request.item_type == "hotels":
        items = await db.hotels.find({"id": {"$in": request.item_ids}}, {"_id": 0}).to_list(10)
        
        return {"type": "hotels", "items": items}
    
    raise HTTPException(status_code=400, detail="Invalid item type")

@api_router.post("/ai/suggestions")
async def get_ai_suggestions(request: AISuggestionRequest):
    """Get AI-powered travel suggestions for a group"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    await seed_database()
    destinations = await db.destinations.find({}, {"_id": 0}).to_list(1000)
    
    dest_list = "\n".join([f"- {d['name']} ({d['state']}): {d['short_description']}. Budget: ₹{d.get('budget_per_day', 3000)}/day. Best for: {', '.join(d['popular_for'])}" for d in destinations])
    
    try:
        # Mock AI suggestions since emergentintegrations is unavailable
        response = f"1. Ahmedabad: Perfect for heritage walks and street food.\n2. Rann of Kutch: Great for desert landscapes and stargazing.\n3. Gir National Park: Ideal for wildlife safaris to see Asiatic Lions.\n\nTip: Plan ahead for the best experience!"
        
        return {"suggestions": response, "group_type": request.group_type}
    except Exception as e:
        logger.error(f"AI suggestion error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate AI suggestions")

@api_router.post("/ai/description")
async def get_ai_description(request: AIDescriptionRequest):
    """Generate AI-powered description for a destination"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        # Mock AI description since emergentintegrations is unavailable
        prompts = {
            "overview": f"A captivating overview of {request.destination_name}, showcasing its rich history and vibrant culture.",
            "culture": f"The local culture of {request.destination_name} is diverse and colorful, featuring traditional festivals and art.",
            "food": f"Famous for its delicious cuisine, {request.destination_name} offers a wide variety of mouth-watering dishes.",
            "tips": f"When visiting {request.destination_name}, make sure to pack appropriately and respect local customs."
        }
        response = prompts.get(request.topic, prompts["overview"])
        
        response_payload = {"description": response, "topic": request.topic, "destination": request.destination_name}
        print("Exact text/content being returned to the frontend for this endpoint:", response_payload)
        return response_payload
    except Exception as e:
        logger.error(f"AI description error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate AI description")

# Include the router
app.include_router(api_router)

# Connection Manager for Live WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, trip_id: str):
        await websocket.accept()
        if trip_id not in self.active_connections:
            self.active_connections[trip_id] = []
        self.active_connections[trip_id].append(websocket)
        logger.info(f"WebSocket client connected to trip: {trip_id}")

    def disconnect(self, websocket: WebSocket, trip_id: str):
        if trip_id in self.active_connections:
            if websocket in self.active_connections[trip_id]:
                self.active_connections[trip_id].remove(websocket)
            if not self.active_connections[trip_id]:
                del self.active_connections[trip_id]
        logger.info(f"WebSocket client disconnected from trip: {trip_id}")

    async def broadcast_to_trip(self, trip_id: str, message: dict):
        if trip_id in self.active_connections:
            connections = list(self.active_connections[trip_id])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection, trip_id)

# Connection Manager for Chat WebSockets
class ChatConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, trip_id: str):
        await websocket.accept()
        if trip_id not in self.active_connections:
            self.active_connections[trip_id] = []
        self.active_connections[trip_id].append(websocket)
        logger.info(f"Chat WebSocket client connected to trip: {trip_id}")

    def disconnect(self, websocket: WebSocket, trip_id: str):
        if trip_id in self.active_connections:
            if websocket in self.active_connections[trip_id]:
                self.active_connections[trip_id].remove(websocket)
            if not self.active_connections[trip_id]:
                del self.active_connections[trip_id]
        logger.info(f"Chat WebSocket client disconnected from trip: {trip_id}")

    async def broadcast_to_trip(self, trip_id: str, message: dict):
        if trip_id in self.active_connections:
            connections = list(self.active_connections[trip_id])
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    self.disconnect(connection, trip_id)

chat_manager = ChatConnectionManager()

@app.websocket("/ws/trips/{trip_id}/chat")
async def websocket_chat_endpoint(websocket: WebSocket, trip_id: str):
    await chat_manager.connect(websocket, trip_id)
    try:
        while True:
            # Listen for incoming text message from this client
            data = await websocket.receive_text()
            payload = json.loads(data)
            sender_name = payload.get("sender_name")
            text = payload.get("text")
            
            if not sender_name or not text:
                continue
                
            # Create message document
            message_doc = {
                "message_id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "sender_name": sender_name,
                "text": text,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            # Save message to database
            await db.messages.insert_one(message_doc)
            
            # Remove _id if motor appends it
            if "_id" in message_doc:
                del message_doc["_id"]
                
            # Broadcast to all connected clients for that trip
            await chat_manager.broadcast_to_trip(trip_id, message_doc)
            
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, trip_id)
    except Exception as e:
        logger.error(f"Chat WebSocket connection error on trip {trip_id}: {str(e)}")
        chat_manager.disconnect(websocket, trip_id)

manager = ConnectionManager()

@app.websocket("/ws/trips/{trip_id}")
async def websocket_endpoint(websocket: WebSocket, trip_id: str):
    await manager.connect(websocket, trip_id)
    try:
        while True:
            # Maintain connection open and listen for any messages or disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, trip_id)
    except Exception as e:
        logger.error(f"WebSocket connection error on trip {trip_id}: {str(e)}")
        manager.disconnect(websocket, trip_id)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    await seed_database()
    await db.favorites.create_index([("member_name", 1), ("destination_id", 1)], unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
