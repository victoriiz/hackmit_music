import sys
import json
import random
import librosa

def make_beats(audio_path, out_path="beats.json"):
    print(f"Loading {audio_path} ...")
    y, sr = librosa.load(audio_path, sr=None, mono=True)

    # Beat tracking
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

    # Force tempo into a Python float (handles numpy scalar/array cases)
    tempo = float(tempo)

    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    print(f"Estimated tempo: {tempo:.2f} BPM, {len(beat_times)} beats found")

    notes = []
    for t in beat_times:
        notes.append({
            "time": float(round(t, 3)),
            "type": random.choice(["left", "right"])
        })

    data = {"tempo": tempo, "notes": notes}

    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {out_path} with {len(notes)} notes.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_beats.py input_audio.mp3 [output.json]")
        sys.exit(1)

    audio_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else "beats.json"
    make_beats(audio_file, out_file)
