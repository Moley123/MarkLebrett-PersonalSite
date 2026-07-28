import requests
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sefaria_clean import clean_hebrew_plain, VALID_PREFIXES

# CONFIGURATION
MIN_WORD_LENGTH = 2 

# Canonical prefix list lives in sefaria_clean.py so the builders and the
# frontend Trend Tracker can never drift apart again.
VALID_PREFIXES = set(VALID_PREFIXES)

# 1. LOAD RACERS
script_dir = os.path.dirname(os.path.abspath(__file__))
common_path = os.path.join(script_dir, '..', 'src', 'data', 'common_gematria.json')

with open(common_path, 'r', encoding='utf-8') as f:
    common_data = json.load(f)

words_to_track = set()
for val, list_of_words in common_data.items():
    for entry in list_of_words:
        raw = entry.split('(')[0].strip()
        clean = clean_hebrew_plain(raw)
        # Use regex to strip spaces from the racer word itself
        clean = re.sub(r'\s+', '', clean)
        if clean and len(clean) >= MIN_WORD_LENGTH:
            words_to_track.add(clean)

print(f"Tracking {len(words_to_track)} words...")

# 2. SCAN TORAH
BOOKS_STRUCTURE = [
    ("Genesis", 50),
    ("Exodus", 40),
    ("Leviticus", 27),
    ("Numbers", 36),
    ("Deuteronomy", 34)
]

race_timeline = []
global_counts = {w: {'exact': 0, 'prefix': 0} for w in words_to_track}

print("Scanning Torah (Chapter by Chapter)...")

for book, total_chapters in BOOKS_STRUCTURE:
    print(f"\nProcessing {book} ({total_chapters} chapters)...")
    
    for chapter_num in range(1, total_chapters + 1):
        url = f"https://www.sefaria.org/api/texts/{book}.{chapter_num}?context=0"
        
        success = False
        for attempt in range(5):
            try:
                response = requests.get(url, timeout=30)
                if response.status_code == 200:
                    success = True
                    break
            except:
                time.sleep(2)
        
        if not success:
            print(f"  [FAILED] Could not fetch {book} Ch {chapter_num}")
            continue

        try:
            data = response.json()
            he_text = data['he']
            
            sys.stdout.write(".")
            sys.stdout.flush()

            for verse in he_text:
                clean_verse = clean_hebrew_plain(verse)
                # Split by space to get individual words
                verse_words = clean_verse.split()
                
                for w in verse_words:
                    for target in words_to_track:
                        
                        # 1. EXACT MATCH
                        if w == target:
                            global_counts[target]['exact'] += 1
                            global_counts[target]['prefix'] += 1 
                        
                        # 2. PREFIX MATCH (Strict Grammar Check)
                        elif w.endswith(target):
                            prefix = w[:-len(target)]
                            if prefix in VALID_PREFIXES:
                                global_counts[target]['prefix'] += 1

            # Snapshot for Leaderboard (Top 20)
            sorted_leaderboard = sorted(
                global_counts.items(), 
                key=lambda item: item[1]['prefix'], 
                reverse=True
            )[:20]
            
            frame_data = []
            for word, counts in sorted_leaderboard:
                if counts['prefix'] > 0:
                    frame_data.append({
                        "name": word,
                        "exact": counts['exact'],
                        "prefix": counts['prefix']
                    })

            race_timeline.append({
                "label": f"{book} Ch.{chapter_num}",
                "data": frame_data
            })
            
        except Exception as e:
            print(f"  [ERROR] {e}")

# 3. SAVE
output_path = os.path.join(script_dir, '..', 'src', 'data', 'race_data.json')
print(f"\n\nSaving to {output_path}...")
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(race_timeline, f, ensure_ascii=False)
print("[SUCCESS] Race data updated.")