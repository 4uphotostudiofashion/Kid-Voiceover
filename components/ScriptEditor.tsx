
import React, { useState, useRef } from 'react';
import { Sparkles, Play, Loader2, Mic, Square, Trash2, Download, Zap, ChevronDown, Layers, Wand2, Save, Folder, FileText, X } from 'lucide-react';
import { transcribeAudio } from '../services/geminiService';
import { SavedScript, VoiceConfig, Gender } from '../types';

interface ScriptEditorProps {
  script: string;
  config: VoiceConfig;
  onChange: (script: string) => void;
  onEnhance: () => void;
  onGenerateAudio: () => void;
  onGenerateScenes: () => void;
  onOpenWizard: () => void;
  isEnhancing: boolean;
  isGeneratingAudio: boolean;
  explanation?: string;
  savedScripts: SavedScript[];
  onSaveScript: (name: string, content: string) => void;
  onLoadScript: (content: string) => void;
  onDeleteScript: (id: string) => void;
}

const TEMPLATES = [
  {
    label: "YouTube Intro (Energetic)",
    text: "Hi friends! Welcome back to my channel! Today we are going to learn something super cool. Are you ready? Let's go!"
  },
  {
    label: "Moral Story Starter",
    text: "Once upon a time, in a big green forest, there lived a little bunny named Benny. Benny loved carrots, but he didn't like to share. One day..."
  },
  {
    label: "Counting Lesson",
    text: "Can you count with me? Let's count to five! One... Two... Three... Four... Five! Great job! You are so smart."
  },
  {
    label: "Channel Outro",
    text: "Did you have fun today? Don't forget to like and subscribe for more fun videos! See you next time! Bye bye!"
  }
];

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  script,
  config,
  onChange,
  onEnhance,
  onGenerateAudio,
  onGenerateScenes,
  onOpenWizard,
  isEnhancing,
  isGeneratingAudio,
  explanation,
  savedScripts,
  onSaveScript,
  onLoadScript,
  onDeleteScript
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure you have granted permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleTranscribe = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(audioBlob);
      // Append text if script exists, otherwise replace
      onChange(script ? `${script} ${text}` : text);
    } catch (error) {
      console.error("Transcription error:", error);
      alert("Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDownload = () => {
    if (!script) return;
    const element = document.createElement("a");
    const file = new Blob([script], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "kidvoice-script.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const applyTemplate = (text: string) => {
    onChange(text);
    setShowTemplates(false);
  };

  const handleSaveClick = () => {
    if (!script.trim()) return;
    setIsSaving(true);
  };

  const confirmSave = () => {
    if (!newScriptName.trim()) return;
    onSaveScript(newScriptName, script);
    setNewScriptName("");
    setIsSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div>
           <h2 className="text-xl font-bold text-slate-800">Video Script</h2>
           {/* Visual Badge for Identity */}
           <div className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
               config.gender === Gender.GIRL ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
           }`}>
               <span>Speaking As:</span>
               <span>{config.gender === Gender.GIRL ? '👧' : '👦'}</span>
               <span>{config.gender} (Age {config.age})</span>
           </div>
        </div>
        
        <div className="flex items-center gap-2">
          
          {/* Saved Scripts Dropdown */}
          <div className="relative">
             <button 
               onClick={() => setShowSaved(!showSaved)}
               className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
               title="My Saved Scripts"
             >
               <Folder className="w-5 h-5" />
             </button>
             
             {showSaved && (
               <>
                 <div className="fixed inset-0 z-10" onClick={() => setShowSaved(false)}></div>
                 <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-fade-in">
                   <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                     <span>My Scripts</span>
                     <span className="bg-slate-200 text-slate-500 px-1.5 rounded-full">{savedScripts.length}</span>
                   </div>
                   <div className="max-h-60 overflow-y-auto">
                     {savedScripts.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 italic">No saved scripts yet</div>
                     ) : (
                        savedScripts.map((s) => (
                         <div key={s.id} className="p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 group flex justify-between items-center">
                           <button
                             onClick={() => { onLoadScript(s.content); setShowSaved(false); }}
                             className="text-left text-sm text-slate-600 hover:text-indigo-700 truncate flex-1"
                           >
                             <div className="font-bold truncate">{s.name}</div>
                             <div className="text-[10px] text-slate-400">{s.date}</div>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); onDeleteScript(s.id); }}
                             className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500"
                           >
                              <X className="w-3 h-3" />
                           </button>
                         </div>
                       ))
                     )}
                   </div>
                 </div>
               </>
             )}
          </div>

          {/* Save Button */}
          <div className="relative">
              <button 
                onClick={handleSaveClick}
                disabled={!script}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30"
                title="Save Script to Library"
              >
                <Save className="w-5 h-5" />
              </button>

              {isSaving && (
                 <>
                   <div className="fixed inset-0 z-10" onClick={() => setIsSaving(false)}></div>
                   <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-100 z-20 p-3 animate-fade-in">
                      <label className="block text-xs font-bold text-slate-500 mb-2">Name your script</label>
                      <div className="flex gap-2">
                         <input 
                           autoFocus
                           className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                           placeholder="My Awesome Story"
                           value={newScriptName}
                           onChange={(e) => setNewScriptName(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
                         />
                         <button 
                           onClick={confirmSave}
                           disabled={!newScriptName}
                           className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold disabled:opacity-50"
                         >
                           Save
                         </button>
                      </div>
                   </div>
                 </>
              )}
          </div>

          {/* Templates Dropdown */}
          <div className="relative">
             <button 
               onClick={() => setShowTemplates(!showTemplates)}
               className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-colors"
               title="Load a pre-written script"
             >
               <Zap className="w-3.5 h-3.5 fill-current" />
               Templates
               <ChevronDown className="w-3 h-3" />
             </button>
             
             {showTemplates && (
               <>
                 <div className="fixed inset-0 z-10" onClick={() => setShowTemplates(false)}></div>
                 <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-fade-in">
                   <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                     Instant Scripts
                   </div>
                   {TEMPLATES.map((t, i) => (
                     <button
                       key={i}
                       onClick={() => applyTemplate(t.text)}
                       className="w-full text-left px-4 py-3 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-50 last:border-0 transition-colors"
                     >
                       {t.label}
                     </button>
                   ))}
                 </div>
               </>
             )}
          </div>
          
          {/* Wizard Button */}
           <button 
             onClick={onOpenWizard}
             className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 rounded-lg text-xs font-bold transition-colors"
             title="Generate a full script with AI"
           >
             <Wand2 className="w-3.5 h-3.5" />
             AI Writer
           </button>

          {/* Download Button */}
          <button 
             onClick={handleDownload}
             disabled={!script}
             className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30"
             title="Download Script (.txt)"
           >
             <Download className="w-4 h-4" />
           </button>

          <div className="w-px h-4 bg-slate-200 mx-1"></div>

          {script.length > 0 && (
            <button 
              onClick={() => onChange('')}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear script"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded-full">
            {script.length} chars
          </span>
        </div>
      </div>

      <div className="relative flex-grow mb-4">
        <textarea
          value={script}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isTranscribing ? "Transcribing your voice..." : "Paste your script here...\n\nOR Click 'AI Writer' to generate one!\nOR Use the mic to dictate!"}
          disabled={isTranscribing}
          className={`w-full h-full p-4 rounded-xl border focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-slate-700 leading-relaxed font-medium transition-colors ${
             isRecording ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:bg-white'
          }`}
        />
        
        {/* Voice Input Button */}
        <div className="absolute bottom-4 right-4">
          {isTranscribing ? (
             <div className="bg-indigo-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
               <Loader2 className="w-4 h-4 animate-spin" />
               <span className="text-xs font-bold">Transcribing...</span>
             </div>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg transition-all animate-bounce"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="text-xs font-bold">Stop Recording</span>
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-105 group"
              title="Voice Dictation (Clone your voice to text)"
            >
              <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {explanation && (
        <div className="mb-4 p-3 bg-indigo-50 text-indigo-800 text-sm rounded-lg border border-indigo-100 animate-fade-in">
          <strong>Agent Note:</strong> {explanation}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
            <button
              onClick={onEnhance}
              disabled={isEnhancing || isRecording || isTranscribing || !script.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-indigo-100 text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnhancing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Enhance Script
            </button>
        </div>

        <div className="flex gap-3">
             <button
              onClick={onGenerateScenes}
              disabled={isGeneratingAudio || isRecording || isTranscribing || !script.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-violet-600 text-white rounded-xl font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 hover:shadow-violet-300 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              title="Detects parts of the script and generates them one by one"
            >
               {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
              Generate Scenes
            </button>

            <button
              onClick={onGenerateAudio}
              disabled={isGeneratingAudio || isRecording || isTranscribing || !script.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isGeneratingAudio ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
              Generate Single
            </button>
        </div>
      </div>
    </div>
  );
};
