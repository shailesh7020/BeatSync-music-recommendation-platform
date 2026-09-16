import logging
from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models.song import Song
from app.services.spotify_service import _generate_audio_features_profile

logger = logging.getLogger("app.seed")

# Diverse seed tracks across genres (Rock, Electronic, Pop, Classical, Hip-Hop, Jazz, Acoustic)
SEED_TRACKS = [
    # Rock / Classic Rock
    {
        "spotify_id": "seed_rock_01",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "album": "A Night at the Opera",
        "release_date": "1975-10-31",
        "duration_ms": 354000,
        "genre": "rock",
        "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/31/53/78/31537873-c820-22c7-013a-59b3a0e676ea/mzaf_11306346453664324220.plus.aac.p.m4a",
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/4b/33/c2/4b33c2a3-f09b-6380-03fb-0fa4dbca8eb9/00602527718385.rgb.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_rock_02",
        "title": "Stairway to Heaven",
        "artist": "Led Zeppelin",
        "album": "Led Zeppelin IV",
        "release_date": "1971-11-08",
        "duration_ms": 482000,
        "genre": "rock",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/c3/0f/23/c30f235b-d0e5-7798-755d-3d4926685ce0/603497893928.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_rock_03",
        "title": "Hotel California",
        "artist": "Eagles",
        "album": "Hotel California",
        "release_date": "1976-12-08",
        "duration_ms": 391000,
        "genre": "rock",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/10/d4/0e/10d40e1b-7a32-9cb9-4f7f-27fca240f90e/075596050920.jpg/600x600bb.jpg",
    },

    # Electronic / Dance
    {
        "spotify_id": "seed_edm_01",
        "title": "One More Time",
        "artist": "Daft Punk",
        "album": "Discovery",
        "release_date": "2001-03-12",
        "duration_ms": 320000,
        "genre": "electronic",
        "preview_url": "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/44/e9/8f/44e98f09-322c-a2f0-1c39-44820bc0d099/mzaf_10339906103138861214.plus.aac.p.m4a",
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e5/22/e4/e522e430-8a4f-5060-e41c-fbca8b68832c/724384960650.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_edm_02",
        "title": "Get Lucky",
        "artist": "Daft Punk ft. Pharrell Williams",
        "album": "Random Access Memories",
        "release_date": "2013-04-19",
        "duration_ms": 248000,
        "genre": "electronic",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/9a/c0/a49ac06f-1294-87cf-49e0-82736183e8fa/886443927087.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_edm_03",
        "title": "Midnight City",
        "artist": "M83",
        "album": "Hurry Up, We're Dreaming",
        "release_date": "2011-10-18",
        "duration_ms": 243000,
        "genre": "electronic",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/58/01/fa/5801fa81-1979-50eb-044f-d652d8816828/724596951054.jpg/600x600bb.jpg",
    },

    # Pop / Modern Hits
    {
        "spotify_id": "seed_pop_01",
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "release_date": "2019-11-29",
        "duration_ms": 200000,
        "genre": "pop",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/e0/75/a9/e075a9e8-4682-13b3-8c46-caea2b35a630/20UMGIM08611.rgb.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_pop_02",
        "title": "Levitating",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "release_date": "2020-03-27",
        "duration_ms": 203000,
        "genre": "pop",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/cb/7b/72/cb7b72ff-9d04-1ba6-99cf-d0e5ea4e414c/190295286101.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_pop_03",
        "title": "Shape of You",
        "artist": "Ed Sheeran",
        "album": "÷ (Divide)",
        "release_date": "2017-01-06",
        "duration_ms": 233000,
        "genre": "pop",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/44/2c/80/442c8091-662a-0a77-9fc6-9ee800030588/190295851286.jpg/600x600bb.jpg",
    },

    # Hip-Hop / Rap
    {
        "spotify_id": "seed_hiphop_01",
        "title": "HUMBLE.",
        "artist": "Kendrick Lamar",
        "album": "DAMN.",
        "release_date": "2017-03-30",
        "duration_ms": 177000,
        "genre": "hip hop",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/58/b0/a2/58b0a218-0a06-531e-450f-e28e1837e3d8/17UMGIM86066.rgb.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_hiphop_02",
        "title": "Sicko Mode",
        "artist": "Travis Scott",
        "album": "ASTROWORLD",
        "release_date": "2018-08-03",
        "duration_ms": 312000,
        "genre": "hip hop",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/47/9b/6c/479b6c03-5184-a16f-df3e-7b7da61bb080/886447265932.jpg/600x600bb.jpg",
    },

    # Classical / Ambient / Chill
    {
        "spotify_id": "seed_classical_01",
        "title": "Clair de Lune",
        "artist": "Claude Debussy",
        "album": "Suite Bergamasque",
        "release_date": "1905-01-01",
        "duration_ms": 302000,
        "genre": "classical",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/64/a0/0c/64a00c6d-5a21-c423-bbdb-874b830d1d25/00028947822554.rgb.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_classical_02",
        "title": "Experience",
        "artist": "Ludovico Einaudi",
        "album": "In a Time Lapse",
        "release_date": "2013-01-21",
        "duration_ms": 315000,
        "genre": "classical",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/ca/87/42/ca8742d4-0eb7-8be6-57c5-55ff678e718c/00028947913382.rgb.jpg/600x600bb.jpg",
    },

    # Jazz / Soul / Blues
    {
        "spotify_id": "seed_jazz_01",
        "title": "So What",
        "artist": "Miles Davis",
        "album": "Kind of Blue",
        "release_date": "1959-08-17",
        "duration_ms": 562000,
        "genre": "jazz",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/df/aa/a4/dfaaa4ca-7efb-fa3d-8f24-2c0ff00192e1/886443494794.jpg/600x600bb.jpg",
    },
    {
        "spotify_id": "seed_jazz_02",
        "title": "Feeling Good",
        "artist": "Nina Simone",
        "album": "I Put a Spell on You",
        "release_date": "1965-06-01",
        "duration_ms": 173000,
        "genre": "jazz",
        "preview_url": None,
        "image_url": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/44/2c/3f/442c3f87-578d-9a99-035f-1498b79b9cf9/00602537449552.rgb.jpg/600x600bb.jpg",
    },
]


def seed_database(db: Session) -> int:
    """
    Populate database with starter tracks across multiple genres with complete audio features.
    """
    count = 0
    for track in SEED_TRACKS:
        existing = db.query(Song).filter(Song.spotify_id == track["spotify_id"]).first()
        if not existing:
            feat = _generate_audio_features_profile(track["spotify_id"], genre=track.get("genre"))
            song = Song(
                spotify_id=track["spotify_id"],
                title=track["title"],
                artist=track["artist"],
                album=track.get("album"),
                duration_ms=track.get("duration_ms"),
                release_date=track.get("release_date"),
                preview_url=track.get("preview_url"),
                image_url=track.get("image_url"),
                danceability=feat["danceability"],
                energy=feat["energy"],
                key=feat["key"],
                loudness=feat["loudness"],
                mode=feat["mode"],
                speechiness=feat["speechiness"],
                acousticness=feat["acousticness"],
                instrumentalness=feat["instrumentalness"],
                liveness=feat["liveness"],
                valence=feat["valence"],
                tempo=feat["tempo"],
            )
            db.add(song)
            count += 1

    db.commit()
    return count


if __name__ == "__main__":
    init_db()
    db = SessionLocal()
    try:
        added = seed_database(db)
        print(f"Successfully seeded {added} diverse tracks into the database!")
        total = db.query(Song).count()
        print(f"Total tracks in catalog: {total}")
    finally:
        db.close()
