from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from bson import ObjectId
import random
import string

# .env dosyasını yükle
load_dotenv()

# MongoDB bağlantısı
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client.yoklama_sistemi

# JWT ayarları
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Şifreleme ayarları
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI()

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"],
    expose_headers=["*"],
)

# Modeller
class User(BaseModel):
    email: str
    password: str
    full_name: str
    role: str  # "teacher" veya "student"

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class Course(BaseModel):
    name: str
    code: str
    schedule: str

# Yardımcı fonksiyonlar
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
        
        print(f"Token validation for email: {email}")  # Debug log
        
        # Tüm kullanıcıları kontrol et
        all_users = list(db.users.find({"email": email}))
        print(f"Found {len(all_users)} users with this email during token validation")  # Debug log
        for user in all_users:
            print(f"User details during validation: {user}")  # Debug log
        
    except JWTError:
        raise credentials_exception
    
    user = db.users.find_one({"email": token_data.email})
    if user is None:
        raise credentials_exception
        
    print(f"Validated user: {user}")  # Debug log
    return user

# Yardımcı fonksiyonlar
def generate_attendance_code(length=6):
    """Büyük harfler ve rakamlardan oluşan rastgele bir kod üretir"""
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choices(characters, k=length))

# Endpoint'ler
@app.post("/register")
async def register(user: User):
    if db.users.find_one({"email": user.email}):
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    db.users.insert_one(user_dict)
    return {"message": "User created successfully"}

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    print(f"Login attempt for email: {form_data.username}")  # Debug log
    
    # Tüm kullanıcıları kontrol et
    all_users = list(db.users.find({"email": form_data.username}))
    print(f"Found {len(all_users)} users with this email")  # Debug log
    for user in all_users:
        print(f"User details: {user}")  # Debug log
    
    user = db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["password"]):
        raise HTTPException(
            status_code=400,
            detail="Incorrect email or password"
        )
    
    print(f"Successful login for user: {user}")  # Debug log
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/courses")
async def get_courses(current_user: dict = Depends(get_current_user)):
    try:
        print("Current user:", current_user)  # Debug log
        print("Role:", current_user.get("role"))  # Debug log
        
        if current_user["role"] == "teacher":
            print("Fetching courses for teacher:", current_user["email"])  # Debug log
            try:
                courses = list(db.courses.find({"teacher_email": current_user["email"]}))
                print("Found courses:", courses)  # Debug log
            except Exception as e:
                print("MongoDB error:", str(e))  # Debug log
                raise
            
            try:
                for course in courses:
                    course["_id"] = str(course["_id"])
                    active_attendance = db.attendance.find_one({
                        "course_id": str(course["_id"]),
                        "is_active": True
                    })
                    course["has_active_attendance"] = bool(active_attendance)
                    if active_attendance:
                        course["active_attendance_code"] = active_attendance["code"]
            except Exception as e:
                print("Error processing courses:", str(e))  # Debug log
                raise
                
            return courses
        else:
            print("Fetching courses for student:", current_user["email"])  # Debug log
            try:
                courses = list(db.courses.find({"student_emails": current_user["email"]}))
                print("Found courses:", courses)  # Debug log
            except Exception as e:
                print("MongoDB error:", str(e))  # Debug log
                raise
            
            try:
                for course in courses:
                    course["_id"] = str(course["_id"])
                    active_attendance = db.attendance.find_one({
                        "course_id": str(course["_id"]),
                        "is_active": True
                    })
                    course["has_active_attendance"] = bool(active_attendance)
                    
                    if active_attendance:
                        student_attended = current_user["email"] in active_attendance["students"]
                        course["already_attended"] = student_attended
            except Exception as e:
                print("Error processing courses:", str(e))  # Debug log
                raise
                
            return courses
    except Exception as e:
        print("Error in get_courses:", str(e))  # Debug log
        print("Error type:", type(e))  # Debug log
        print("Error args:", e.args)  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/courses")
async def create_course(course_data: dict, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Only teachers can create courses"
        )
    
    course_data["teacher_email"] = current_user["email"]
    course_data["student_emails"] = []
    
    result = db.courses.insert_one(course_data)
    return {"id": str(result.inserted_id)}

@app.post("/courses/{course_id}/students")
async def add_student_to_course(
    course_id: str,
    student_email: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Only teachers can add students"
        )
    
    course = db.courses.find_one({"_id": ObjectId(course_id), "teacher_email": current_user["email"]})
    if not course:
        raise HTTPException(
            status_code=404,
            detail="Course not found"
        )
    
    student = db.users.find_one({"email": student_email, "role": "student"})
    if not student:
        raise HTTPException(
            status_code=404,
            detail="Student not found"
        )
    
    db.courses.update_one(
        {"_id": ObjectId(course_id)},
        {"$addToSet": {"student_emails": student_email}}
    )
    
    return {"message": "Student added successfully"}

@app.post("/attendance/start")
async def start_attendance(request: dict, current_user: dict = Depends(get_current_user)):
    try:
        course_id = request.get("course_id")
        if not course_id:
            raise HTTPException(
                status_code=400,
                detail="course_id is required"
            )
            
        print("Starting attendance for course:", course_id)  # Debug log
        print("Current user:", current_user)  # Debug log
        
        if current_user["role"] != "teacher":
            print("User is not a teacher")  # Debug log
            raise HTTPException(
                status_code=403,
                detail="Only teachers can start attendance"
            )
        
        try:
            course = db.courses.find_one({"_id": ObjectId(course_id), "teacher_email": current_user["email"]})
            print("Found course:", course)  # Debug log
        except Exception as e:
            print("Error finding course:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if not course:
            print("Course not found")  # Debug log
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )
        
        try:
            active_attendance = db.attendance.find_one({
                "course_id": str(course["_id"]),  # Convert ObjectId to string
                "is_active": True
            })
            print("Active attendance:", active_attendance)  # Debug log
        except Exception as e:
            print("Error checking active attendance:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if active_attendance:
            print("Active attendance already exists")  # Debug log
            raise HTTPException(
                status_code=400,
                detail="There is already an active attendance for this course"
            )
        
        # Rastgele bir yoklama kodu üret
        attendance_code = generate_attendance_code()
        print(f"Generated attendance code: {attendance_code}")  # Debug log
        
        attendance = {
            "course_id": str(course["_id"]),  # Convert ObjectId to string
            "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "code": attendance_code,
            "is_active": True,
            "students": []
        }
        
        try:
            result = db.attendance.insert_one(attendance)
            print("Created attendance:", result.inserted_id)  # Debug log
        except Exception as e:
            print("Error creating attendance:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        return {"message": "Attendance started", "code": attendance_code}
    except HTTPException:
        raise
    except Exception as e:
        print("Unexpected error in start_attendance:", str(e))  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/attendance/submit")
async def submit_attendance(request: dict, current_user: dict = Depends(get_current_user)):
    try:
        course_id = request.get("course_id")
        code = request.get("code")
        
        if not course_id or not code:
            raise HTTPException(
                status_code=400,
                detail="course_id and code are required"
            )
            
        print("Submitting attendance for course:", course_id)  # Debug log
        print("With code:", code)  # Debug log
        print("Current user:", current_user)  # Debug log
        print("Student email being submitted:", current_user["email"])  # New debug log
        
        if current_user["role"] != "student":
            print("User is not a student")  # Debug log
            raise HTTPException(
                status_code=403,
                detail="Only students can submit attendance"
            )
        
        try:
            course = db.courses.find_one({
                "_id": ObjectId(course_id),
                "student_emails": current_user["email"]
            })
            print("Found course:", course)  # Debug log
        except Exception as e:
            print("Error finding course:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if not course:
            print("Course not found or student not enrolled")  # Debug log
            raise HTTPException(
                status_code=404,
                detail="Course not found or you are not enrolled"
            )
        
        try:
            attendance = db.attendance.find_one({
                "course_id": str(course["_id"]),  # Convert ObjectId to string
                "is_active": True,
                "code": code
            })
            print("Found attendance:", attendance)  # Debug log
        except Exception as e:
            print("Error finding attendance:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if not attendance:
            print("Invalid or expired attendance code")  # Debug log
            raise HTTPException(
                status_code=400,
                detail="Invalid or expired attendance code"
            )
        
        if current_user["email"] in attendance["students"]:
            print("Student already submitted attendance")  # Debug log
            raise HTTPException(
                status_code=400,
                detail="You have already submitted attendance"
            )
        
        try:
            result = db.attendance.update_one(
                {"_id": attendance["_id"]},
                {"$push": {"students": current_user["email"]}}
            )
            print("Updated attendance:", result.modified_count)  # Debug log
        except Exception as e:
            print("Error updating attendance:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        return {"message": "Attendance submitted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print("Unexpected error in submit_attendance:", str(e))  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/attendance/end")
async def end_attendance(request: dict, current_user: dict = Depends(get_current_user)):
    try:
        course_id = request.get("course_id")
        if not course_id:
            raise HTTPException(
                status_code=400,
                detail="course_id is required"
            )
            
        print("Ending attendance for course:", course_id)  # Debug log
        print("Current user:", current_user)  # Debug log
        
        if current_user["role"] != "teacher":
            print("User is not a teacher")  # Debug log
            raise HTTPException(
                status_code=403,
                detail="Only teachers can end attendance"
            )
        
        try:
            course = db.courses.find_one({"_id": ObjectId(course_id), "teacher_email": current_user["email"]})
            print("Found course:", course)  # Debug log
        except Exception as e:
            print("Error finding course:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if not course:
            print("Course not found")  # Debug log
            raise HTTPException(
                status_code=404,
                detail="Course not found"
            )
        
        try:
            result = db.attendance.update_many(
                {"course_id": str(course["_id"]), "is_active": True},
                {"$set": {"is_active": False}}
            )
            print("Updated attendance records:", result.modified_count)  # Debug log
        except Exception as e:
            print("Error updating attendance:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if result.modified_count == 0:
            print("No active attendance found")  # Debug log
            raise HTTPException(
                status_code=400,
                detail="No active attendance found"
            )
        
        return {"message": "Attendance ended successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print("Unexpected error in end_attendance:", str(e))  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/attendance/history/{course_id}")
async def get_attendance_history(course_id: str, current_user: dict = Depends(get_current_user)):
    try:
        print("Getting attendance history for course:", course_id)  # Debug log
        print("Current user:", current_user)  # Debug log
        print("User role:", current_user["role"])  # New debug log
        
        try:
            course = None
            if current_user["role"] == "teacher":
                course = db.courses.find_one({
                    "_id": ObjectId(course_id),
                    "teacher_email": current_user["email"]
                })
            else:
                course = db.courses.find_one({
                    "_id": ObjectId(course_id),
                    "student_emails": current_user["email"]
                })
                
            print("Found course:", course)  # Debug log
        except Exception as e:
            print("Error finding course:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
        
        if not course:
            print("Course not found or no access")  # Debug log
            raise HTTPException(
                status_code=404,
                detail="Course not found or you don't have access"
            )
        
        try:
            # Tüm yoklama kayıtlarını al ve tarihe göre sırala
            attendance_records = list(db.attendance.find(
                {"course_id": str(course["_id"]), "is_active": False}
            ))

            # Tarihleri datetime objesine çevir ve sırala
            for record in attendance_records:
                try:
                    # ISO format veya normal string format kontrolü
                    try:
                        record["date"] = datetime.fromisoformat(record["date"].replace('Z', '+00:00'))
                    except:
                        record["date"] = datetime.strptime(record["date"], "%Y-%m-%d %H:%M:%S")
                except Exception as e:
                    print(f"Date parsing error for {record['date']}: {str(e)}")
                    # Hatalı tarih formatı durumunda varsayılan tarih kullan
                    record["date"] = datetime.now()

            # Tarihe göre sırala (en yeni en üstte)
            attendance_records.sort(key=lambda x: x["date"], reverse=True)

            # Tarihleri okunabilir formata çevir
            for record in attendance_records:
                record["date"] = record["date"].strftime("%d.%m.%Y %H:%M")
                record["_id"] = str(record["_id"])
                print("Processing attendance record:", record)  # Debug log
                
                if current_user["role"] == "student":
                    record["attended"] = current_user["email"] in record["students"]
                    print("Student attendance status:", record["attended"])  # Debug log
                    del record["students"]  # Öğrenci modunda diğer öğrencileri gösterme
                else:
                    # Öğretmen modunda, katılan öğrencilerin tam listesini döndür
                    student_emails = record.get("students", [])
                    print("Students in attendance:", student_emails)  # Debug log
                    student_details = []
                    for email in student_emails:
                        student = db.users.find_one({"email": email})
                        print(f"Found student details for {email}:", student)  # Debug log
                        if student:
                            student_details.append({
                                "email": email,
                                "full_name": student.get("full_name", "Unknown")
                            })
                    record["students"] = student_details
                    
            print("Processed records:", attendance_records)  # Debug log
            return attendance_records
            
        except Exception as e:
            print("Error processing attendance records:", str(e))  # Debug log
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        print("Unexpected error in get_attendance_history:", str(e))  # Debug log
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/setup-test-users")
async def setup_test_users():
    try:
        # Mevcut kullanıcıları temizle
        db.users.delete_many({})
        print("Deleted all existing users")
        
        # Test kullanıcılarını oluştur
        test_users = [
            {
                "email": "ogretmen@ogretmen.edu.tr",
                "password": get_password_hash("123456"),
                "full_name": "Test Öğretmen",
                "role": "teacher"
            },
            {
                "email": "ogrenci@ogrenci.edu.tr",
                "password": get_password_hash("123456"),
                "full_name": "Test Öğrenci",
                "role": "student"
            },
            {
                "email": "ogrenci2@ogrenci.edu.tr",
                "password": get_password_hash("123456"),
                "full_name": "Test Öğrenci 2",
                "role": "student"
            }
        ]
        
        result = db.users.insert_many(test_users)
        print(f"Created {len(result.inserted_ids)} test users")
        
        # Oluşturulan kullanıcıları kontrol et
        all_users = list(db.users.find({}))
        for user in all_users:
            print(f"Created user: {user}")
            
        return {"message": f"Created {len(result.inserted_ids)} test users successfully"}
    except Exception as e:
        print(f"Error in setup-test-users: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error setting up test users: {str(e)}"
        )

@app.post("/create-user")
async def create_user(user: User, current_user: dict = Depends(get_current_user)):
    # Sadece öğretmenler yeni kullanıcı ekleyebilir
    if current_user["role"] != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Sadece öğretmenler yeni kullanıcı ekleyebilir"
        )
    
    # E-posta kontrolü
    if user.role == "teacher" and not user.email.endswith("@ogretmen.edu.tr"):
        raise HTTPException(
            status_code=400,
            detail="Öğretmen e-postası '@ogretmen.edu.tr' ile bitmelidir"
        )
    elif user.role == "student" and not user.email.endswith("@ogrenci.edu.tr"):
        raise HTTPException(
            status_code=400,
            detail="Öğrenci e-postası '@ogrenci.edu.tr' ile bitmelidir"
        )
    
    # E-posta kullanımda mı kontrolü
    if db.users.find_one({"email": user.email}):
        raise HTTPException(
            status_code=400,
            detail="Bu e-posta adresi zaten kullanımda"
        )
    
    # Yeni kullanıcıyı ekle
    hashed_password = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict["password"] = hashed_password
    
    try:
        result = db.users.insert_one(user_dict)
        return {
            "message": "Kullanıcı başarıyla oluşturuldu",
            "user": {
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Kullanıcı oluşturulurken bir hata oluştu: {str(e)}"
        )

@app.post("/create-course")
async def create_course(course: Course, current_user: dict = Depends(get_current_user)):
    # Sadece öğretmenler ders ekleyebilir
    if current_user["role"] != "teacher":
        raise HTTPException(
            status_code=403,
            detail="Sadece öğretmenler ders ekleyebilir"
        )
    
    # Ders kodu benzersiz olmalı
    if db.courses.find_one({"code": course.code}):
        raise HTTPException(
            status_code=400,
            detail="Bu ders kodu zaten kullanımda"
        )
    
    # Yeni dersi ekle
    course_dict = course.dict()
    course_dict["teacher_email"] = current_user["email"]
    course_dict["student_emails"] = []
    
    try:
        result = db.courses.insert_one(course_dict)
        course_dict["_id"] = str(result.inserted_id)
        return {
            "message": "Ders başarıyla oluşturuldu",
            "course": course_dict
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ders oluşturulurken bir hata oluştu: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 