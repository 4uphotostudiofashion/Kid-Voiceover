import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Volume2, Copy, Check } from 'lucide-react';

interface AudioPlayerProps {
  audioBuffer: AudioBuffer | null;
  pitch: number;
  autoPlay?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBuffer, pitch, autoPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize Audio Context on mount
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
  }, []);

  // Draw Waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    
    // Draw simple bars for visualization
    const barWidth = 2;
    const gap = 1;
    
    for (let i = 0; i < width; i += (barWidth + gap)) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      // Simple RMS-ish visualization
      const val = Math.max(Math.abs(min), Math.abs(max));
      const barHeight = Math.max(val * height, 2); 
      
      // Gradient color based on height
      ctx.fillStyle = val > 0.5 ? '#ec4899' : '#6366f1'; // Pink if loud, Indigo if soft
      
      ctx.fillRect(i, (height - barHeight) / 2, barWidth, barHeight);
    }
  }, [audioBuffer]);

  const play = () => {
    if (!audioBuffer || !audioContextRef.current) return;

    // Resume context if suspended (browser policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = pitch; // Apply Pitch (Speed) change
    source.connect(audioContextRef.current.destination);
    
    // Determine start time in buffer coordinates (not wall time)
    const offset = pausedAtRef.current; 
    
    startTimeRef.current = audioContextRef.current.currentTime;
    
    source.start(0, offset);
    sourceRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
       // Check if it ended naturally. 
       const playbackDuration = audioBuffer.duration / pitch;
       const elapsed = audioContextRef.current!.currentTime - startTimeRef.current;
       
       // Allow a small margin of error for timing
       if (elapsed + 0.1 >= playbackDuration - (offset / pitch)) {
          setIsPlaying(false);
          pausedAtRef.current = 0;
          setProgress(0);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
       }
    };

    // Animation loop for progress
    const updateProgress = () => {
      if (!audioContextRef.current) return;
      const elapsedRealTime = audioContextRef.current.currentTime - startTimeRef.current;
      
      // Calculate position in the buffer: offset + (elapsedRealTime * pitch)
      const bufferPosition = offset + (elapsedRealTime * pitch);
      
      const p = Math.min(bufferPosition / audioBuffer.duration, 1);
      setProgress(p * 100);
      
      if (p < 1 && isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const pause = () => {
    if (sourceRef.current && audioContextRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      
      // Calculate where we are in the buffer to resume later
      const elapsedRealTime = audioContextRef.current.currentTime - startTimeRef.current;
      pausedAtRef.current = pausedAtRef.current + (elapsedRealTime * pitch);
      
      setIsPlaying(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleToggle = () => {
    if (isPlaying) pause();
    else play();
  };

  // Autoplay Effect
  useEffect(() => {
    if (autoPlay && audioBuffer) {
        // Reset state for new buffer
        pausedAtRef.current = 0; 
        setProgress(0);
        if (sourceRef.current) {
            try { sourceRef.current.stop(); } catch(e){}
        }
        
        play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  // Helper to get WAV blob
  const getWavBlob = () => {
    if (!audioBuffer) return null;
    const buffer = audioBuffer;
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;

    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // write interleaved data
    for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
      for(i = 0; i < numOfChan; i++) {
        // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }

    return new Blob([view], { type: "audio/wav" });

    function setUint16(data: any) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data: any) { view.setUint32(pos, data, true); pos += 4; }
  };

  const handleDownload = () => {
    const blob = getWavBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `voiceover-${pitch}x-speed.wav`;
    link.click();
  };

  const handleCopy = async () => {
    const blob = getWavBlob();
    if (!blob) return;
    
    try {
        // Try to write to clipboard
        // Note: Clipboard API support for audio/wav is limited in some browsers
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
        console.warn("Clipboard write failed, falling back to download alert or just ignoring", err);
        // Fallback for user awareness
        alert("Clipboard copy for audio is not fully supported in this browser. Please use the Download button instead.");
    }
  };

  if (!audioBuffer) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl h-32 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">Audio will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center justify-between">
        Generated Voiceover
        <div className="flex items-center gap-2">
           <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-1 rounded">
            Pitch: {pitch}x
          </span>
          <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
            {(audioBuffer.duration / pitch).toFixed(1)}s
          </span>
        </div>
      </h2>
      
      {/* Waveform Visualization */}
      <div className="relative h-24 bg-slate-50 rounded-lg mb-4 overflow-hidden border border-slate-100">
        <canvas ref={canvasRef} className="w-full h-full object-cover" />
        {/* Progress Overlay */}
        <div 
          className="absolute top-0 left-0 h-full bg-indigo-500/10 border-r border-indigo-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleToggle}
          className="flex-grow flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={handleCopy}
          className={`flex items-center justify-center p-3 border-2 rounded-xl transition-colors min-w-[50px] ${
            isCopied ? 'border-green-500 bg-green-50 text-green-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Copy Audio to Clipboard"
        >
          {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center justify-center p-3 border-2 border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors"
          title="Download WAV (Original Speed)"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Note: The download button saves the original high-quality audio file.
      </p>
    </div>
  );
};