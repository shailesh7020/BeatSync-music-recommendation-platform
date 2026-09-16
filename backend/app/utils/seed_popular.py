import requests
import json
from app.services.spotify_service import _generate_audio_features_profile

HITS = [
    ("The Weeknd", "Blinding Lights", "fHI8X4OXluQ", "pop"),
    ("Ed Sheeran", "Shape of You", "JGwWNGJdvx8", "pop"),
    ("Post Malone & Swae Lee", "Sunflower", "ApXoWvfEYVU", "hip hop"),
    ("Harry Styles", "As It Was", "H5v3kku4y6Q", "pop"),
    ("The Weeknd ft. Daft Punk", "Starboy", "34Na4j8AVgA", "pop"),
    ("The Kid LAROI & Justin Bieber", "Stay", "kTJczUoc56U", "pop"),
    ("Taylor Swift", "Cruel Summer", "ic8j13piAhQ", "pop"),
    ("Glass Animals", "Heat Waves", "mRD0-GxqHVo", "indie"),
    ("Dua Lipa", "Levitating", "TUVcZfQe-Kw", "dance"),
    ("Billie Eilish", "Bad Guy", "DyDfgMOUjCI", "pop"),
    ("Lewis Capaldi", "Someone You Loved", "zABLecsR5UE", "acoustic"),
    ("Miley Cyrus", "Flowers", "G7KNmW9a75Y", "pop"),
    ("Drake ft. Wizkid", "One Dance", "iAbnEUA0wpA", "hip hop"),
    ("Imagine Dragons", "Believer", "7wtfhZwyrcc", "rock"),
    ("Post Malone", "Circles", "wXhTHyIgQ_U", "pop"),
    ("Harry Styles", "Watermelon Sugar", "E07s5ZYygmg", "pop"),
    ("Olivia Rodrigo", "drivers license", "ZmDBbnmKpqQ", "pop"),
    ("Dua Lipa", "Don't Start Now", "oygrmJFKYZY", "dance"),
    ("Juice WRLD", "Lucid Dreams", "mzB1V93502I", "hip hop"),
    ("Queen", "Bohemian Rhapsody", "fJ9rUzIMcZQ", "rock"),
]

def generate_popular_seed():
    results = []
    for artist, title, ytid, genre in HITS:
        try:
            r = requests.get(
                "https://itunes.apple.com/search",
                params={"term": f"{artist} {title}", "entity": "song", "limit": 1},
                timeout=5,
            )
            data = r.json().get("results", [])
            if data:
                item = data[0]
                tid = f"itunes_{item.get('trackId')}"
                artwork = item.get("artworkUrl100", "").replace("100x100bb", "600x600bb")
                prev = item.get("previewUrl")
                feat = _generate_audio_features_profile(tid, genre=genre)
                results.append({
                    "spotify_id": tid,
                    "title": item.get("trackName", title),
                    "artist": item.get("artistName", artist),
                    "album": item.get("collectionName", "Top Hits"),
                    "duration_ms": item.get("trackTimeMillis", 210000),
                    "release_date": (item.get("releaseDate") or "2024-01-01")[:10],
                    "preview_url": prev,
                    "image_url": artwork,
                    "youtube_id": ytid,
                    **feat,
                })
        except Exception as e:
            print(f"Error resolving {title}: {e}")

    with open("app/utils/popular_data.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"Successfully generated {len(results)} popular tracks!")

if __name__ == "__main__":
    generate_popular_seed()
