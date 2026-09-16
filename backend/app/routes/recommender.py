from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.recommender.engine import recommendation_engine, MOOD_PRESETS

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("/similar/{song_id}")
def get_similar_recommendations(
    song_id: str,
    limit: int = Query(10, ge=1, le=50, description="Maximum number of recommendations"),
    db: Session = Depends(get_db),
):
    """
    Get acoustically similar tracks for a given seed song using cosine similarity.
    song_id can be either the numeric database ID or Spotify ID.
    """
    results = recommendation_engine.get_similar_tracks(
        song_identifier=song_id, limit=limit, db=db
    )
    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"Seed song '{song_id}' not found or no candidate tracks available.",
        )

    return {
        "seed_song_id": song_id,
        "count": len(results),
        "recommendations": results,
    }


@router.get("/user/{user_id}")
def get_personalized_recommendations(
    user_id: int,
    limit: int = Query(10, ge=1, le=50, description="Maximum recommendations"),
    db: Session = Depends(get_db),
):
    """
    Get personalized music recommendations computed from a user's dynamic taste vector
    (history and likes). Automatically handles cold-start for new users.
    """
    results = recommendation_engine.get_user_recommendations(
        user_id=user_id, limit=limit, db=db
    )
    return {
        "user_id": user_id,
        "count": len(results),
        "recommendations": results,
    }


@router.get("/mood")
def get_mood_recommendations(
    mood: str = Query(..., description="Desired mood (workout, study, chill, party, happy, melancholy)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum recommendations"),
    db: Session = Depends(get_db),
):
    """
    Get songs matching an emotional mood or activity profile.
    """
    try:
        results = recommendation_engine.get_mood_recommendations(
            mood=mood, limit=limit, db=db
        )
        return {
            "mood": mood.lower(),
            "count": len(results),
            "recommendations": results,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/moods")
def list_available_moods():
    """
    List all supported mood presets and their acoustic characteristics.
    """
    return {
        "moods": recommendation_engine.list_mood_presets()
    }


from pydantic import BaseModel, Field


class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=300, description="Natural language music prompt")
    limit: int = Field(default=12, ge=1, le=50)


@router.post("/prompt")
def generate_prompt_recommendations(
    payload: PromptRequest,
    db: Session = Depends(get_db),
):
    """
    Generate an AI-curated playlist from natural language descriptions.
    """
    return recommendation_engine.generate_prompt_playlist(
        prompt=payload.prompt,
        limit=payload.limit,
        db=db,
    )

