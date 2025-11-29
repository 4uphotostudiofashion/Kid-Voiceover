
export enum Gender {
  GIRL = 'Girl',
  BOY = 'Boy'
}

export enum Accent {
  AMERICAN = 'American English',
  INDIAN = 'Indian English'
}

export enum Tone {
  HAPPY = 'Happy',
  FRIENDLY = 'Friendly',
  ANGRY = 'Angry',
  EXCITED = 'Excited',
  CALM = 'Calm'
}

export interface VoiceConfig {
  id?: string; // Optional ID for custom voices
  gender: Gender;
  age: number; // 7-10
  accent: Accent;
  pitch: number; // 0.8 to 1.5
  tone: Tone;
}

export interface CustomVoice {
  id: string;
  name: string;
  config: VoiceConfig;
}

export interface GeneratedAudio {
  buffer: AudioBuffer;
  duration: number;
}

export interface ScriptResponse {
  enhancedScript: string;
  explanation: string;
}

export interface VoiceAnalysisResponse {
  gender: Gender;
  age: number;
  pitch: number;
  tone: Tone;
  explanation: string;
}

export interface VoiceSegment {
  id: string;
  text: string;
  audioBuffer: AudioBuffer | null;
  videoUrl: string | null;
  status: 'idle' | 'generating' | 'completed' | 'error';
  videoStatus: 'idle' | 'generating' | 'completed' | 'error';
}

export interface SavedScript {
  id: string;
  name: string;
  content: string;
  date: string;
}

export interface ScriptWizardParams {
  channelName: string;
  category: string; // e.g., 'Moral Stories', 'Science', 'Fun Facts'
  topic: string;
  duration: 'short' | 'long'; // 'short' (30-60s) or 'long' (2-4m)
  targetAge: string;
  hookStyle: string; // 'Question', 'Fact', 'Teaser', 'Challenge'
}
