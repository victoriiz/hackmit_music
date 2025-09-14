import React, { useRef, useState, useEffect } from 'react';

// --- Types ---
interface BeatNote {
  time: number;
  type: 'left' | 'right';
}

interface BeatData {
  notes: BeatNote[];
}

interface Note {
  x: number;
  y: number;
  type: 'left' | 'right';
  speed: number;
}

export interface MicrobitGameProps {
  audioFile?: File;
  audioUrl?: string;
}

// --- Utility: Estimate BPM ---
function estimateBPM(audioBuffer: AudioBuffer): number {
  const data = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = 1024;
  const hopSize = 512;
  let energies: number[] = [];
  for (let i = 0; i < data.length - frameSize; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) sum += data[i + j] * data[i + j];
    energies.push(sum);
  }
  let peakTimes: number[] = [];
  for (let i = 1; i < energies.length - 1; i++) {
    if (
      energies[i] > energies[i - 1] &&
      energies[i] > energies[i + 1] &&
      energies[i] > 0.01
    ) {
      peakTimes.push((i * hopSize) / sampleRate);
    }
  }
  let intervals: number[] = [];
  for (let i = 1; i < peakTimes.length; i++) {
    intervals.push(peakTimes[i] - peakTimes[i - 1]);
  }
  if (intervals.length === 0) return 120;
  let histogram: Record<string, number> = {};
  intervals.forEach((interval) => {
    let rounded = Math.round(interval * 10) / 10;
    histogram[rounded] = (histogram[rounded] || 0) + 1;
  });
  let dominantInterval = parseFloat(
    Object.entries(histogram).sort((a, b) => b[1] - a[1])[0][0]
  );
  const estimatedBPM = 60 / dominantInterval;
  return Math.min(Math.max(estimatedBPM, 90), 140);
}

// --- Main Component ---
const MicrobitGame: React.FC<MicrobitGameProps> = ({ audioFile, audioUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [beatData, setBeatData] = useState<BeatData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [beatIndex, setBeatIndex] = useState(0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioCtx] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)());
  const [source, setSource] = useState<AudioBufferSourceNode | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [microbitPort, setMicrobitPort] = useState<any>(null);
  const [reader, setReader] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle audio file or URL
  useEffect(() => {
    async function loadAudio() {
      let arrayBuffer: ArrayBuffer | null = null;
      if (audioFile) {
        arrayBuffer = await audioFile.arrayBuffer();
      } else if (audioUrl) {
        const res = await fetch(audioUrl);
        arrayBuffer = await res.arrayBuffer();
      }
      if (!arrayBuffer) return;
      const buffer = await audioCtx.decodeAudioData(arrayBuffer);
      setAudioBuffer(buffer);
      // Estimate BPM
      const bpmVal = estimateBPM(buffer);
      setBpm(Math.round(bpmVal));
      // Generate beatData
      const secondsPerBeat = 60 / bpmVal;
      const beatSpacing = 2;
      const notesArr: BeatNote[] = [];
      for (let i = 0; i * secondsPerBeat * beatSpacing < buffer.duration; i++) {
        notesArr.push({
          time: i * secondsPerBeat * beatSpacing,
          type: Math.random() < 0.5 ? 'left' : 'right',
        });
      }
      setBeatData({ notes: notesArr });
      setBeatIndex(0);
      setNotes([]);
    }
    if (audioFile || audioUrl) {
      loadAudio();
    }
    // eslint-disable-next-line
  }, [audioFile, audioUrl]);

  // Play audio and start game
  const startGame = () => {
    if (!audioBuffer) return;
    if (source) source.disconnect();
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(audioCtx.destination);
    src.start();
    setSource(src);
    setStartTime(audioCtx.currentTime);
    setIsPlaying(true);
    setBeatIndex(0);
    setNotes([]);
    setScore(0);
  };

  // Canvas drawing and game loop
  useEffect(() => {
    let animationFrame: number;
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Score: ${score}`, 20, 30);
      ctx.fillText(`BPM: ${bpm}`, 20, 60);
      // Draw hit line
      ctx.strokeStyle = 'red';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 50);
      ctx.lineTo(canvas.width, canvas.height - 50);
      ctx.stroke();
      // Draw notes
      notes.forEach((note: Note) => {
        ctx.beginPath();
        ctx.fillStyle = note.type === 'left' ? 'blue' : 'green';
        ctx.ellipse(note.x, note.y, 15, 15, 0, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    function gameLoop() {
      if (!isPlaying || !audioBuffer || !beatData) {
        draw();
        animationFrame = requestAnimationFrame(gameLoop);
        return;
      }
      const currentTime = audioCtx.currentTime - startTime;
      // Spawn notes
      let idx = beatIndex;
      while (
        idx < beatData.notes.length &&
        currentTime >= beatData.notes[idx].time
      ) {
        const beat = beatData.notes[idx];
        const x = beat.type === 'left' ? Math.random() * 150 + 100 : Math.random() * 150 + 350;
        const speed = (canvasRef.current!.height - 50) / 2; // noteTravelTime = 2s
        setNotes((prev) => [...prev, { x, y: 0, type: beat.type, speed }]);
        idx++;
      }
      if (idx !== beatIndex) setBeatIndex(idx);
      // Move notes
      setNotes((prev) =>
        prev
          .map((note) => ({ ...note, y: note.y + note.speed * (1 / 60) }))
          .filter((note) => note.y <= canvasRef.current!.height)
      );
      draw();
      animationFrame = requestAnimationFrame(gameLoop);
    }
    animationFrame = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrame);
    // eslint-disable-next-line
  }, [isPlaying, notes, score, bpm, beatData, beatIndex, audioBuffer, startTime]);

  // Micro:bit connection (Web Serial)
  const connectMicrobit = async () => {
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      const decoder = new (window as any).TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      setMicrobitPort(port);
      setReader(reader);
      readLoop(reader);
    } catch (err) {
      alert('Micro:bit connection failed: ' + err);
    }
  };

  // Handle micro:bit input
  const readLoop = async (reader: any) => {
    while (true) {
      const { value, done }: { value: string; done: boolean } = await reader.read();
      if (done) break;
      if (value) handleInput(value.trim());
    }
  };

  // Handle micro:bit button presses
  const handleInput = (input: string) => {
    setNotes((prev) => {
      let updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (
          input === 'A' &&
          updated[i].type === 'left' &&
          Math.abs(updated[i].y - (canvasRef.current!.height - 50)) < 30
        ) {
          setScore((s) => s + 100);
          updated.splice(i, 1);
          break;
        }
        if (
          input === 'B' &&
          updated[i].type === 'right' &&
          Math.abs(updated[i].y - (canvasRef.current!.height - 50)) < 30
        ) {
          setScore((s) => s + 100);
          updated.splice(i, 1);
          break;
        }
        if (input === 'SHAKE') {
          setScore((s) => s + 50);
        }
      }
      return updated;
    });
  };

  // Keyboard controls for testing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A') handleInput('A');
      if (e.key === 'b' || e.key === 'B') handleInput('B');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ background: '#1e1e1e', color: '#fff', padding: 20 }}>
      <h2>Micro:bit Rhythm Game</h2>
      <button onClick={connectMicrobit}>Connect Micro:bit via USB</button>
      <button onClick={startGame} disabled={!audioBuffer} style={{ marginLeft: 10 }}>
        Start Game
      </button>
      <div style={{ margin: '10px 0' }}>
        <span>Estimated BPM: {bpm}</span>
        <span style={{ marginLeft: 20 }}>Score: {score}</span>
      </div>
      <canvas ref={canvasRef} width={600} height={400} style={{ background: '#222', borderRadius: 8 }} />
      {!audioFile && !audioUrl && (
        <div style={{ marginTop: 20 }}>
          <input
            type="file"
            accept="audio/*"
            onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
              if (e.target.files && e.target.files[0]) {
                // reload with new file
                window.location.reload();
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MicrobitGame;
