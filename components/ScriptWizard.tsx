import React, { useState } from 'react';
import { ScriptWizardParams } from '../types';
import { X, Sparkles, Youtube, Clock, Users, BookOpen, Loader2 } from 'lucide-react';

interface ScriptWizardProps {
  onClose: () => void;
  onGenerate: (params: ScriptWizardParams) => void;
  isGenerating: boolean;
}

export const ScriptWizard: React.FC<ScriptWizardProps> = ({ onClose, onGenerate, isGenerating }) => {
  const [step, setStep] = useState(1);
  const [params, setParams] = useState<ScriptWizardParams>({
    channelName: '',
    category: 'Moral Stories',
    topic: '',
    duration: 'short',
    targetAge: '7-10 years'
  });

  const handleChange = (field: keyof ScriptWizardParams, value: string) => {
    setParams({ ...params, [field]: value });
  };

  const handleSubmit = () => {
    onGenerate(params);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-300" />
              AI Script Writer
            </h2>
            <p className="text-violet-100 text-sm mt-1">Answer a few questions to get a pro script.</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          <div className="space-y-6">
            {/* Question 1: Channel Info */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
               <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                 <Youtube className="w-4 h-4 text-red-500" />
                 Your Channel Name
               </label>
               <input 
                 type="text" 
                 value={params.channelName}
                 onChange={(e) => handleChange('channelName', e.target.value)}
                 placeholder="e.g. Super Kids Learning"
                 className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none"
               />
            </div>

            {/* Question 2: Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  Category
                </label>
                <select 
                  value={params.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                >
                  <option>Moral Stories</option>
                  <option>Quiz / Trivia</option>
                  <option>Educational / Science</option>
                  <option>Fun Facts</option>
                  <option>Daily Habits</option>
                  <option>ABC & Numbers</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  Duration
                </label>
                <select 
                  value={params.duration}
                  onChange={(e) => handleChange('duration', e.target.value as any)}
                  className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none bg-white"
                >
                  <option value="short">Short (30-60s)</option>
                  <option value="long">Long (2-4 mins)</option>
                </select>
              </div>
            </div>

            {/* Question 3: Topic */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
               <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                 <Users className="w-4 h-4 text-amber-500" />
                 What is this video about?
               </label>
               <textarea 
                 value={params.topic}
                 onChange={(e) => handleChange('topic', e.target.value)}
                 placeholder="e.g. Animal Sounds Quiz OR Space Trivia"
                 className="w-full p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none h-24 resize-none"
               />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isGenerating || !params.channelName || !params.topic}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:transform-none"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 fill-current" />}
            Generate Script
          </button>
        </div>
      </div>
    </div>
  );
};