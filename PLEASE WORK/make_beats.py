import librosa
import json
import numpy as np
import sys
import os

def process_audio(filename, out_file="beats.json"):
    print(f"Loading {filename} ...")
    y, sr = librosa.load(filename)

    # Beat tracking
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)

    # Ensure tempo is a float (librosa can return ndarray sometimes)
    tempo = float(np.atleast_1d(tempo)[0])

    # Convert beat frames to times
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)

    print(f"Estimated tempo: {tempo:.2f} BPM, {len(beat_times)} beats found")

    # Alternate "left" and "right" for the notes
    beats_data = [
        {"time": float(bt), "side": "left" if i % 2 == 0 else "right"}
        for i, bt in enumerate(beat_times)
    ]

    with open(out_file, "w") as f:
        json.dump(beats_data, f, indent=2)

    print(f"Saved {out_file} with {len(beats_data)} beats.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_beats.py <audiofile>")
        sys.exit(1)

    audio_file = sys.argv[1]
    out_file = "beats.json"
    process_audio(audio_file, out_file)