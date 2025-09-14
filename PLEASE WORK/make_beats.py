import sys
import json
import random
import librosa

def process_audio(audio_path, json_path="beats.json"):
    print(f"Loading {audio_path} ...")
    # Load audio (mono, default 22050 Hz)
    y, sr = librosa.load(audio_path, sr=None)

    # Get tempo + beat frames
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    print(f"Estimated tempo: {tempo:.2f} BPM, {len(beat_times)} beats found")

    # Randomly assign left/right beats
    notes = []
    for t in beat_times:
        notes.append({
            "time": float(round(t, 3)),  # keep 3 decimals
            "type": random.choice(["left", "right"])
        })

    data = {"tempo": float(tempo), "notes": notes}

    with open(json_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {json_path} with {len(notes)} beats.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_beats.py input_audio.mp3 [output.json]")
        sys.exit(1)

    audio_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else "beats.json"
    process_audio(audio_file, out_file)
