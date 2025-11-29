
import React, { useState, useEffect } from 'react';
import { VoiceSelector } from './components/VoiceSelector';
import { ScriptEditor } from './components/ScriptEditor';
import { AudioPlayer } from './components/AudioPlayer';
import { ScriptWizard } from './components/ScriptWizard';
import { VoiceConfig, Gender, Accent, Tone, CustomVoice, VoiceSegment, ScriptWizardParams, SavedScript } from './types';
import { enhanceScript, generateVoiceover, generateScriptWithAI, generateVideoSegment } from './services/geminiService';
import { Mic2, Info, CheckCircle2, Circle, Loader2, PlayCircle, Video, Download } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<VoiceConfig>({
    gender: Gender.GIRL,
    age: 8,
    accent: Accent.INDIAN,
    pitch: 1.2, 
    tone: Tone.FRIENDLY
  });

  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  // Load saved scripts from localStorage on mount
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>(() => {
    const saved = localStorage.getItem('kidvoice_saved_scripts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [script, setScript] = useState<string>("Hi friends! Today we are learning about good habits.\n\nLet’s start with brushing our teeth.\n\nThen we will eat a healthy breakfast!");
  const [explanation, setExplanation] = useState<string | undefined>();
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  
  // Scene Segment State
  const [segments, setSegments] = useState<VoiceSegment[]>([]);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [isWizardGenerating, setIsWizardGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist scripts when changed
  useEffect(() => {
    localStorage.setItem('kidvoice_saved_scripts', JSON.stringify(savedScripts));
  }, [savedScripts]);

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setError(null);
    try {
      const result = await enhanceScript(script, config);
      setScript(result.enhancedScript);
      setExplanation(result.explanation);
    } catch (err: any) {
      setError(err.message || "Failed to enhance script. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerateAudio = async () => {
    setIsGenerating(true);
    setError(null);
    setSegments([]); // Clear segments if doing single generation
    setAudioBuffer(null);
    setActiveVideoUrl(null);
    try {
      const buffer = await generateVoiceover(script, config);
      setAudioBuffer(buffer);
    } catch (err: any) {
      setError(err.message || "Failed to generate audio. Please check your API key and try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateScenes = async () => {
    setIsGenerating(true);
    setError(null);
    setAudioBuffer(null);
    setActiveVideoUrl(null);

    const rawSegments = script.split(/\n+/).filter(s => s.trim().length > 0);
    
    if (rawSegments.length === 0) {
      setError("Script is empty!");
      setIsGenerating(false);
      return;
    }

    const newSegments: VoiceSegment[] = rawSegments.map((text, idx) => ({
      id: `seg-${Date.now()}-${idx}`,
      text: text.trim(),
      audioBuffer: null,
      videoUrl: null,
      status: 'idle',
      videoStatus: 'idle'
    }));
    
    setSegments(newSegments);

    for (let i = 0; i < newSegments.length; i++) {
        const segment = newSegments[i];
        
        setSegments(prev => prev.map(s => s.id === segment.id ? { ...s, status: 'generating' } : s));

        try {
            const buffer = await generateVoiceover(segment.text, config);
            
            setSegments(prev => prev.map(s => s.id === segment.id ? { ...s, audioBuffer: buffer, status: 'completed' } : s));
            
            if (i === 0) setAudioBuffer(buffer);

        } catch (err) {
            console.error(`Error generating segment ${i}:`, err);
            setSegments(prev => prev.map(s => s.id === segment.id ? { ...s, status: 'error' } : s));
        }
    }

    setIsGenerating(false);
  };

  const handleGenerateVideoForSegment = async (segmentId: string, text: string) => {
    // Check for Paid API Key first for Veo
    if (window.aistudio) {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
                const keyAfter = await window.aistudio.hasSelectedApiKey();
                if (!keyAfter) return; // User cancelled
            }
        } catch(e) {
            console.error("API Key check failed", e);
        }
    }

    setSegments(prev => prev.map(s => s.id === segmentId ? { ...s, videoStatus: 'generating' } : s));
    
    try {
        const videoUrl = await generateVideoSegment(text);
        
        setSegments(prev => prev.map(s => s.id === segmentId ? { ...s, videoUrl, videoStatus: 'completed' } : s));
        setActiveVideoUrl(videoUrl);
    } catch (err: any) {
        console.error("Video generation failed", err);
        setError(err.message || "Video generation failed.");
        setSegments(prev => prev.map(s => s.id === segmentId ? { ...s, videoStatus: 'error' } : s));
    }
  };

  const handleWizardGenerate = async (params: ScriptWizardParams) => {
    setIsWizardGenerating(true);
    try {
        // Pass the currently selected gender to the generator
        const newScript = await generateScriptWithAI(params, config.gender);
        setScript(newScript);
        setShowWizard(false);
    } catch (err: any) {
        setError("Failed to generate script wizard.");
    } finally {
        setIsWizardGenerating(false);
    }
  };

  const handleSaveVoice = (voice: CustomVoice) => {
    setCustomVoices([...customVoices, voice]);
  };

  const handleDeleteVoice = (id: string) => {
    setCustomVoices(customVoices.filter(v => v.id !== id));
    if (config.id === id) {
      setConfig({ ...config, id: undefined });
    }
  };

  const handlePlayScene = (segment: VoiceSegment) => {
    setAudioBuffer(segment.audioBuffer);
    if (segment.videoUrl) {
        setActiveVideoUrl(segment.videoUrl);
    }
  };

  // Saved Script Handlers
  const handleSaveScript = (name: string, content: string) => {
    const newScript: SavedScript = {
      id: Date.now().toString(),
      name,
      content,
      date: new Date().toLocaleDateString()
    };
    setSavedScripts([...savedScripts, newScript]);
  };

  const handleDeleteScript = (id: string) => {
    setSavedScripts(savedScripts.filter(s => s.id !== id));
  };

  const handleLoadScript = (content: string) => {
    setScript(content);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Mic2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
              KidVoice<span className="text-indigo-600">Pro</span>
            </h1>
          </div>
          <div className="text-xs font-semibold px-3 py-1 bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-full">
            BETA
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-2 animate-pulse">
            <Info className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Configuration */}
          <div className="lg:col-span-4 space-y-6">
            <VoiceSelector 
              config={config} 
              onChange={setConfig} 
              disabled={isEnhancing || isGenerating}
              customVoices={customVoices}
              onSaveVoice={handleSaveVoice}
              onDeleteVoice={handleDeleteVoice}
            />
            
            <div className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-xl"></div>
              <h3 className="font-bold text-lg mb-2">New: AI Script Writer ✨</h3>
              <p className="text-sm opacity-90 leading-relaxed mb-3">
                Don't know what to say? Let our AI write the perfect educational script for your channel in seconds!
              </p>
              <button 
                onClick={() => setShowWizard(true)}
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-bold py-2 rounded-lg transition-colors text-sm"
              >
                Open Script Writer
              </button>
            </div>
          </div>

          {/* Center/Right Panel: Workspace */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Script Input */}
            <div className="flex-grow min-h-[400px]">
              <ScriptEditor
                script={script}
                config={config}
                onChange={setScript}
                onEnhance={handleEnhance}
                onGenerateAudio={handleGenerateAudio}
                onGenerateScenes={handleGenerateScenes}
                onOpenWizard={() => setShowWizard(true)}
                isEnhancing={isEnhancing}
                isGeneratingAudio={isGenerating}
                explanation={explanation}
                savedScripts={savedScripts}
                onSaveScript={handleSaveScript}
                onLoadScript={handleLoadScript}
                onDeleteScript={handleDeleteScript}
              />
            </div>

            {/* Scene List with Video Gen */}
            {segments.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm animate-fade-in">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500"></div>
                    Production Studio ({segments.length} Scenes)
                  </h3>
                  <span className="text-xs text-slate-400">Generate Video for each scene using Google Veo</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {segments.map((seg, idx) => (
                    <div key={seg.id} className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                           <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                           {seg.status === 'completed' && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded flex items-center gap-1">Audio Ready</span>}
                           {seg.videoStatus === 'completed' && <span className="text-xs text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex items-center gap-1">Video Ready</span>}
                         </div>
                         <p className="text-sm text-slate-700 truncate">{seg.text}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Video Gen Button */}
                        <button 
                           onClick={() => handleGenerateVideoForSegment(seg.id, seg.text)}
                           disabled={seg.videoStatus === 'generating'}
                           className={`p-2 rounded-lg transition-colors relative group ${
                               seg.videoStatus === 'completed' ? 'text-violet-600 bg-violet-50 border border-violet-100' : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
                           }`}
                           title="Generate Video (Google Veo)"
                        >
                            {seg.videoStatus === 'generating' ? (
                                <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
                            ) : (
                                <Video className="w-5 h-5" />
                            )}
                            {!seg.videoStatus && (
                                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                    Create Video
                                </span>
                            )}
                        </button>

                        {/* Download Video Button */}
                        {seg.videoStatus === 'completed' && seg.videoUrl && (
                            <a
                              href={seg.videoUrl}
                              download={`scene-${idx + 1}-video.mp4`}
                              className="p-2 text-violet-600 hover:bg-violet-100 rounded-lg transition-colors"
                              title="Download Video MP4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-5 h-5" />
                            </a>
                        )}

                        <button 
                          onClick={() => handlePlayScene(seg)}
                          disabled={!seg.audioBuffer}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Play this scene"
                        >
                          <PlayCircle className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output Area */}
            <div className="flex flex-col gap-4">
               {/* Video Player Area */}
               {activeVideoUrl && (
                   <div className="bg-black rounded-2xl overflow-hidden aspect-video relative shadow-lg group">
                       <video 
                         src={activeVideoUrl} 
                         className="w-full h-full object-contain"
                         autoPlay 
                         loop 
                         muted // Muted because audio comes from AudioPlayer
                       />
                       
                       {/* Download Overlay */}
                       <a 
                           href={activeVideoUrl}
                           download="veo-scene.mp4"
                           className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur opacity-0 group-hover:opacity-100 transition-opacity"
                           title="Download Video"
                       >
                           <Download className="w-5 h-5" />
                       </a>

                       <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs text-white font-medium">
                           Generated by Google Veo
                       </div>
                   </div>
               )}
               
               <AudioPlayer audioBuffer={audioBuffer} pitch={config.pitch} autoPlay={true} />
            </div>
          </div>
        </div>
      </main>

      {/* Script Wizard Modal */}
      {showWizard && (
        <ScriptWizard 
          onClose={() => setShowWizard(false)} 
          onGenerate={handleWizardGenerate}
          isGenerating={isWizardGenerating}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-400 text-sm">
          <p>© 2024 KidVoice Pro. Powered by Google Gemini 2.5 Flash & Veo.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
