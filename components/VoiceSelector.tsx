import React, { useState, useRef } from 'react';
import { Gender, Accent, Tone, VoiceConfig, CustomVoice } from '../types';
import { User, Globe, Baby, Sliders, Smile, ChevronDown, Plus, Mic, Upload, Play, Save, Trash2, Wand2, Loader2 } from 'lucide-react';
import { analyzeVoiceStyle } from '../services/geminiService';

interface VoiceSelectorProps {
  config: VoiceConfig;
  onChange: (config: VoiceConfig) => void;
  disabled?: boolean;
  customVoices: CustomVoice[];
  onSaveVoice: (voice: CustomVoice) => void;
  onDeleteVoice: (id: string) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  config, 
  onChange, 
  disabled, 
  customVoices, 
  onSaveVoice, 
  onDeleteVoice 
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'lab'>('presets');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [analysisExplanation, setAnalysisExplanation] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handlers for Standard Controls
  // When selecting a gender (child), auto-set pitch to 1.2 to ensure it sounds like a kid, not an adult.
  const handleGenderSelect = (gender: Gender) => {
    onChange({ 
      ...config, 
      gender,
      pitch: 1.2 // Auto-set pitch to kid-friendly default
    });
  };

  const handleAccentSelect = (accent: Accent) => onChange({ ...config, accent });
  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...config, age: parseInt(e.target.value, 10) });
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...config, pitch: parseFloat(e.target.value) });
  const handleToneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => onChange({ ...config, tone: e.target.value as Tone });

  // Custom Voice Logic
  const handleCustomVoiceSelect = (voice: CustomVoice) => {
    onChange({ ...voice.config, id: voice.id });
  };

  const handleSaveVoice = () => {
    if (!newVoiceName.trim()) return;
    const newVoice: CustomVoice = {
      id: Date.now().toString(),
      name: newVoiceName,
      config: { ...config, id: undefined } // strip old ID
    };
    onSaveVoice(newVoice);
    setNewVoiceName('');
    setActiveTab('lab');
  };

  const processAudioForClone = async (audioBlob: Blob) => {
    setIsAnalyzing(true);
    setAnalysisExplanation(null);
    try {
      const result = await analyzeVoiceStyle(audioBlob);
      onChange({
        ...config,
        gender: result.gender,
        age: result.age,
        pitch: result.pitch,
        tone: result.tone
      });
      setAnalysisExplanation(result.explanation);
    } catch (err) {
      console.error("Clone failed", err);
      alert("Failed to analyze voice sample.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudioForClone(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAudioForClone(file);
    }
  };

  const getToneIcon = (tone: Tone) => {
    switch(tone) {
      case Tone.HAPPY: return '😊';
      case Tone.FRIENDLY: return '🤗';
      case Tone.ANGRY: return '😠';
      case Tone.EXCITED: return '🤩';
      case Tone.CALM: return '😌';
      default: return '😐';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'presets' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          Presets
        </button>
        <button
          onClick={() => setActiveTab('lab')}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'lab' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Wand2 className="w-4 h-4" />
          Voice Lab (Clone)
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'presets' ? (
          <>
            {/* Gender Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-600 mb-3">Choose Voice</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleGenderSelect(Gender.GIRL)}
                  disabled={disabled}
                  className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    config.gender === Gender.GIRL
                      ? 'border-pink-500 bg-pink-50 text-pink-700'
                      : 'border-slate-200 hover:border-pink-200 text-slate-500'
                  }`}
                >
                  <span className="text-3xl">👧</span>
                  <span className="font-bold">Girl</span>
                  {config.gender === Gender.GIRL && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-500"></div>
                  )}
                </button>

                <button
                  onClick={() => handleGenderSelect(Gender.BOY)}
                  disabled={disabled}
                  className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    config.gender === Gender.BOY
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-blue-200 text-slate-500'
                  }`}
                >
                  <span className="text-3xl">👦</span>
                  <span className="font-bold">Boy</span>
                  {config.gender === Gender.BOY && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Age Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <Baby className="w-4 h-4" />
                  Age: {config.age}
                </label>
                <input
                  type="range"
                  min="7"
                  max="10"
                  step="1"
                  value={config.age}
                  onChange={handleAgeChange}
                  disabled={disabled}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>7</span>
                  <span>10</span>
                </div>
              </div>

              {/* Pitch Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Pitch: {config.pitch}x
                </label>
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.1"
                  value={config.pitch}
                  onChange={handlePitchChange}
                  disabled={disabled}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>

             {/* Tone Selection */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <Smile className="w-4 h-4" />
                Tone
              </label>
              <div className="relative">
                <select
                  value={config.tone}
                  onChange={handleToneSelect}
                  disabled={disabled}
                  className="w-full p-3 pl-12 pr-10 bg-white border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-700 font-medium cursor-pointer hover:border-indigo-200 transition-colors"
                >
                  {Object.values(Tone).map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-2xl">
                  {getToneIcon(config.tone)}
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

             {/* Accent Selection */}
            <div className="mb-2">
              <label className="block text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Accent
              </label>
              <div className="flex flex-col gap-2">
                {Object.values(Accent).map((accent) => (
                  <button
                    key={accent}
                    disabled={disabled}
                    onClick={() => handleAccentSelect(accent)}
                    className={`px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors border ${
                      config.accent === accent
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {accent}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="animate-fade-in">
             <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 mb-6 border border-indigo-100">
               <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                 <Wand2 className="w-5 h-5 text-indigo-600" />
                 Clone a Voice
               </h3>
               <p className="text-sm text-indigo-800/80 mb-4">
                 Upload a sample audio clip or record your own voice. Our AI will listen to it and configure the perfect voice profile to match!
               </p>
               
               <div className="flex gap-3 mb-4">
                 <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="flex-1 bg-white border border-indigo-200 text-indigo-700 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Sample
                 </button>
                 <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileUpload} 
                   accept="audio/*" 
                   className="hidden" 
                 />
                 
                 <button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isAnalyzing}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                      isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    {isRecording ? 'Stop' : 'Record'}
                 </button>
               </div>

               {isAnalyzing && (
                 <div className="bg-white/80 backdrop-blur rounded-lg p-3 flex items-center justify-center gap-3 text-sm text-indigo-600 font-semibold">
                   <Loader2 className="w-4 h-4 animate-spin" />
                   AI is analyzing voice characteristics...
                 </div>
               )}

               {analysisExplanation && !isAnalyzing && (
                  <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs text-green-800">
                    <strong>Analysis Complete:</strong> {analysisExplanation}
                  </div>
               )}
             </div>

             {/* Save Current Settings */}
             <div className="flex gap-2 mb-6">
               <input 
                 type="text" 
                 value={newVoiceName}
                 onChange={(e) => setNewVoiceName(e.target.value)}
                 placeholder="Name this voice (e.g. My Narrator)"
                 className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
               />
               <button 
                 onClick={handleSaveVoice}
                 disabled={!newVoiceName.trim()}
                 className="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Save className="w-4 h-4" />
               </button>
             </div>

             {/* Saved Voices List */}
             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">My Custom Voices</h4>
             <div className="space-y-2 max-h-60 overflow-y-auto">
               {customVoices.length === 0 ? (
                 <div className="text-center py-8 text-slate-400 text-sm italic">
                   No custom voices saved yet.
                 </div>
               ) : (
                 customVoices.map(voice => (
                   <div 
                    key={voice.id}
                    onClick={() => handleCustomVoiceSelect(voice)}
                    className={`group p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      config.id === voice.id 
                      ? 'bg-indigo-50 border-indigo-500 shadow-sm' 
                      : 'bg-white border-slate-100 hover:border-indigo-200'
                    }`}
                   >
                     <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                         voice.config.gender === Gender.GIRL ? 'bg-pink-100' : 'bg-blue-100'
                       }`}>
                         {voice.config.gender === Gender.GIRL ? '👧' : '👦'}
                       </div>
                       <div>
                         <p className={`font-bold text-sm ${config.id === voice.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                           {voice.name}
                         </p>
                         <p className="text-xs text-slate-500">
                           {voice.config.tone} • {voice.config.pitch}x
                         </p>
                       </div>
                     </div>
                     <button 
                       onClick={(e) => { e.stopPropagation(); onDeleteVoice(voice.id); }}
                       className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-opacity"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 ))
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
