import sys
import json
import random
import librosa
import time
from pathlib import Path

# ---------- CONFIG ----------
DOWNLOADS_DIR = Path.home() / "Downloads"   # or change to a specific path
OUTPUT_DIR = Path(__file__).parent / "beats" # ensure this folder exists
OUTPUT_DIR.mkdir(exist_ok=True)
CHECK_INTERVAL = 2  # seconds

# ---------- Beat generation function ----------
def make_beats(audio_path, out_path):
    print(f"Loading {audio_path} ...")
    y, sr = librosa.load(audio_path, sr=None, mono=True)

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    tempo = float(tempo)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    print(f"Estimated tempo: {tempo:.2f} BPM, {len(beat_times)} beats found")

    notes = [{"time": float(round(t, 3)), "type": random.choice(["left", "right"])}
             for t in beat_times]

    data = {"tempo": tempo, "notes": notes}
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {out_path} with {len(notes)} notes.\n")

# ---------- Watcher ----------
def watch_downloads():
    processed_files = set()
    print(f"Watching {DOWNLOADS_DIR} for new mp3 files...")
    while True:
        for mp3_file in DOWNLOADS_DIR.glob("*.mp3"):
            if mp3_file.name in processed_files:
                continue
            print(f"New audio detected: {mp3_file.name}")
            out_file = OUTPUT_DIR / f"{mp3_file.stem}_beats.json"
            try:
                make_beats(mp3_file, out_file)
                processed_files.add(mp3_file.name)
            except Exception as e:
                print(f"Error processing {mp3_file.name}: {e}")
        time.sleep(CHECK_INTERVAL)

# ---------- Main ----------
if __name__ == "__main__":
    # If called with arguments, process a single file (legacy usage)
    if len(sys.argv) >= 2:
        audio_file = Path(sys.argv[1])
        out_file = Path(sys.argv[2]) if len(sys.argv) > 2 else OUTPUT_DIR / f"{audio_file.stem}_beats.json"
        make_beats(audio_file, out_file)
    else:
        # Otherwise, start watcher
        watch_downloads()
