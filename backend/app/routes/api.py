from fastapi import APIRouter
from app.routes.health import router as health_router
from app.routes.music import router as music_router
from app.routes.recommender import router as recommender_router
from app.routes.interactions import router as interactions_router
from app.routes.rooms import router as rooms_router
from app.routes.download import router as download_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(music_router)
api_router.include_router(recommender_router)
api_router.include_router(interactions_router)
api_router.include_router(rooms_router)
api_router.include_router(download_router)




