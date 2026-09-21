from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.routes import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on application startup
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

import os
from fastapi.staticfiles import StaticFiles

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

from app.routes.rooms import room_websocket_endpoint
app.add_api_websocket_route("/ws/room/{room_id}", room_websocket_endpoint)

from fastapi.responses import FileResponse

@app.get("/download-app")
def download_mobile_app():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    apk_path = os.path.join(root_dir, "BeatSync.apk")
    if not os.path.exists(apk_path):
        apk_path = os.path.join(root_dir, "frontend", "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")
    if os.path.exists(apk_path):
        return FileResponse(
            path=apk_path,
            filename="BeatSync.apk",
            media_type="application/vnd.android.package-archive"
        )
    return {"error": "APK not found. Please build the APK first."}

# Serve built frontend static files if present (for single-service all-in-one cloud deployments)
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if os.path.exists(static_dir) and os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    @app.get("/")
    def root():
        return {
            "message": f"Welcome to {settings.PROJECT_NAME} API",
            "docs": f"{settings.API_V1_STR}/docs",
            "health": f"{settings.API_V1_STR}/health",
            "mobile_app": "/download-app",
        }

