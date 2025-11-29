
import { GoogleGenAI } from "@google/genai";
import { VoiceConfig, Gender, Accent, ScriptResponse, VoiceAnalysisResponse, Tone, ScriptWizardParams } from "../types";

// Helper for Base64 decoding
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper for Audio Data decoding
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to float [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to convert Blob to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/wav;base64,")
      const base64 = base64String.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const enhanceScript = async (
  originalScript: string, 
  config: VoiceConfig
): Promise<ScriptResponse> => {
  const ai = getClient();
  const model = "gemini-2.5-flash";

  const prompt = `
    You are an expert scriptwriter for a popular Kids YouTube Learning Channel.
    
    TASK:
    Rewrite the following script to be spoken by a ${config.age}-year-old ${config.gender} with a ${config.accent} accent.
    
    REQUIREMENTS:
    - Tone: ${config.tone} (Make sure the wording reflects this emotion!).
    - Vocabulary: Simple, child-friendly.
    - Length: Keep it punchy and engaging.
    - Formatting: Pure text suitable for a Text-to-Speech engine. Remove scene directions like [Curtains open].
    - Accent Nuance: If the accent is Indian English, use appropriate common polite phrases or sentence structures natural to Indian English speakers, but keep it universally understandable. If American, keep it standard US kid style.
    
    INPUT SCRIPT:
    "${originalScript}"

    OUTPUT FORMAT (JSON):
    {
      "enhancedScript": "The rewritten text...",
      "explanation": "Brief explanation of changes made for tone/accent..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ScriptResponse;
  } catch (error) {
    console.error("Script enhancement failed:", error);
    throw error;
  }
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const ai = getClient();
  const model = "gemini-2.5-flash";
  
  const base64Audio = await blobToBase64(audioBlob);

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type, 
              data: base64Audio
            }
          },
          {
            text: "Transcribe the following audio exactly into English text. Do not add any conversational filler. Just the transcription."
          }
        ]
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Transcription failed:", error);
    throw error;
  }
};

export const analyzeVoiceStyle = async (audioBlob: Blob): Promise<VoiceAnalysisResponse> => {
  const ai = getClient();
  const model = "gemini-2.5-flash"; 
  
  const base64Audio = await blobToBase64(audioBlob);

  const prompt = `
    Listen to this audio clip and analyze the speaker's voice characteristics to help configure a text-to-speech engine to mimic them.
    
    Analyze for:
    1. Gender: Is it more likely a Girl or a Boy? (If adult, map to the closest child equivalent).
    2. Pitch: Estimate a playback rate modifier to match their pitch height. 
       - 0.8 is deeper/slower/older.
       - 1.0 is neutral.
       - 1.2 is child-like.
       - 1.3 to 1.5 is very young/squeaky.
    3. Tone: What is the dominant emotion? (Happy, Friendly, Angry, Excited, Calm).
    4. Age: Estimate the speaker's age (map to 7-10 range).

    Output JSON:
    {
      "gender": "Girl" or "Boy",
      "age": number (7-10),
      "pitch": number (0.8 to 1.5),
      "tone": "Happy" | "Friendly" | "Angry" | "Excited" | "Calm",
      "explanation": "Brief reason for these settings based on the audio."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type,
              data: base64Audio
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI analysis");
    
    return JSON.parse(text) as VoiceAnalysisResponse;
  } catch (error) {
    console.error("Voice analysis failed:", error);
    return {
      gender: Gender.GIRL,
      age: 8,
      pitch: 1.2,
      tone: Tone.FRIENDLY,
      explanation: "Analysis failed, using defaults."
    };
  }
};

export const generateVoiceover = async (
  text: string,
  config: VoiceConfig
): Promise<AudioBuffer> => {
  const ai = getClient();
  const model = "gemini-2.5-flash-preview-tts";

  // Sanitize text: Remove visual instructions like [Close up], notes in (), and markdown
  let cleanText = text
    .replace(/\[[\s\S]*?\]/g, '') // Remove [Visuals]
    .replace(/\([\s\S]*?\)/g, '') // Remove (Notes)
    .replace(/[*_~`]/g, '')       // Remove markdown symbols
    .trim();

  // Collapse multiple spaces
  cleanText = cleanText.replace(/\s+/g, ' ');

  if (!cleanText || cleanText.length < 1) {
    throw new Error("Text segment is empty after cleaning.");
  }

  const voiceName = config.gender === Gender.GIRL ? 'Kore' : 'Puck';

  // Strategy: 
  // 1. Try with full styled prompt (Accent + Tone)
  // 2. Fallback to "Read this text" (Good stability)
  // 3. Fallback to raw text (Maximum stability)
  const prompts = [
    `Say with a ${config.accent} accent and ${config.tone} tone: ${cleanText}`,
    `Read the following text aloud: ${cleanText}`,
    cleanText
  ];

  let lastError;

  for (const promptText of prompts) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: ['AUDIO'], 
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from API.");
      }

      const candidate = response.candidates[0];

      // Check for stop reason
      if (candidate.finishReason !== "STOP" && !candidate.content) {
         const reason = candidate.finishReason || "UNKNOWN";
         // Throw to trigger retry
         throw new Error(`Stopped. Reason: ${reason}`);
      }

      const parts = candidate.content?.parts || [];
      const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
      
      if (!audioPart || !audioPart.inlineData?.data) {
        throw new Error("No audio data received.");
      }

      const base64Audio = audioPart.inlineData.data;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1
      );

      // If successful, return immediately
      return audioBuffer;

    } catch (error: any) {
      console.warn(`Voice generation attempt failed for prompt: "${promptText.substring(0, 15)}..."`, error.message);
      lastError = error;
      // Wait a short bit before retry
      await new Promise(r => setTimeout(r, 800));
    }
  }

  throw lastError || new Error("Voice generation failed after retries.");
};

export const generateScriptWithAI = async (params: ScriptWizardParams, gender: Gender): Promise<string> => {
  const ai = getClient();
  const model = "gemini-2.5-flash";

  const lengthPrompt = params.duration === 'short' 
    ? "Length: strictly between 50 to 100 words (approx 30-45 seconds)." 
    : "Length: strictly between 300 to 500 words (approx 2-3 minutes).";

  // Specialized formatting for different categories
  let specializedPrompt = "";
  
  if (params.category === 'Quiz / Trivia') {
      specializedPrompt = `
      FORMAT: QUIZ SHOW STYLE
      1. Energetic Intro: Welcome everyone to the [Topic] Quiz!
      2. Ask 3 to 5 fun Questions about ${params.topic}.
      3. For EACH Question, follow this EXACT structure with newlines:
         - [Visual: Timer counting down or thinking face] [Question Text]
         - [Short filler like "Tick tock... thinking time..."]
         - [Visual: Celebration confetti] [The Answer]
      4. Outro: Great job friends! See you next time.
      NOTE: Keep questions simple for kids age ${params.targetAge}.
      `;
  } else if (params.category.includes('Toy Review') || params.category.includes('Unboxing')) {
      specializedPrompt = `
      FORMAT: TOY REVIEW / UNBOXING
      1. Intro: [Visual: Close up of mystery box] Super excitement! Show the box (describe it).
      2. Unboxing: "Let's open it!" Use excitement words.
      3. Features: Describe 3 cool things about the toy/item.
      4. Rating: Give it a fun score.
      5. Outro: Ask viewers if they want this toy.
      `;
  } else if (params.category.includes('Gaming')) {
      specializedPrompt = `
      FORMAT: GAMING COMMENTARY
      1. Intro: High energy! [Visual: Character waving] "Welcome back gamers!"
      2. The Goal: "Today we are building a castle / fighting a boss".
      3. Action: Describe gameplay moments with excitement ("Oh no! Run!", "Yes! We did it!").
      4. Outro: "Like and Subscribe for more gaming fun!"
      `;
  } else {
      specializedPrompt = `
      Structure it with an Intro, Body, and Outro.
      Structure it for storytelling or teaching.
      Include [Visual: ...] descriptions for key moments.
      `;
  }

  const prompt = `
    You are a professional scriptwriter for a Kids YouTube channel named "${params.channelName}".
    
    Task: Write an engaging, educational, and fun script about "${params.topic}".
    
    Target Audience: ${params.targetAge}.
    Category: ${params.category}.
    Host Persona: A ${params.targetAge} year old ${gender}.
    ${lengthPrompt}
    
    HOOK STRATEGY: "${params.hookStyle}"
    - The script MUST start with a strong Hook based on the strategy above to grab attention in the first 5 seconds.
    - If strategy is "Curiosity Question", start with "Did you know...?" or similar.
    - If strategy is "Challenge", start with "I bet you can't..."
    
    IMPORTANT:
    - Include a brief self-introduction in the Intro using a fun, generated nickname appropriate for a ${gender} (e.g., "It's me, [Name]!").
    - **CRITICAL FOR VIDEO GENERATION:** You MUST include visual scene descriptions in brackets at the start of paragraphs or sentences. 
      Example: "[Visual: A cute cartoon bunny hopping in a green field] Hi friends! Look at me hop!"
      These visuals will be used by an AI video generator. Describe camera angles (Close-up, Wide shot) and style (3D cartoon, colorful).
    
    ${specializedPrompt}

    Guidelines:
    - Use short, clear sentences suitable for a child voiceover.
    - Be energetic and interactive.
    - Add paragraph breaks for natural pauses.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    return response.text || "";
  } catch (error) {
    console.error("Script generation failed:", error);
    throw error;
  }
};

export const generateVideoSegment = async (input: string): Promise<string> => {
  const ai = getClient();
  const model = 'veo-3.1-fast-generate-preview';
  
  // Extract visual prompt from brackets if present
  const visualMatch = input.match(/\[(.*?)\]/);
  
  // Use bracket content if found, otherwise use the full text as fallback
  let textPrompt = visualMatch ? visualMatch[1] : input;
  
  // Clean up: remove newlines
  textPrompt = textPrompt.replace(/\n/g, ' ').trim();
  
  // Fallback for safety if prompt extraction failed or is empty
  if (!textPrompt || textPrompt.length < 2) {
      textPrompt = "cute cartoon character smiling, happy atmosphere, bright colors";
  }
  
  // Construct the enhanced prompt for Veo
  const enhancedPrompt = `cinematic 3d animation style, cute, colorful, for kids video, high quality, ${textPrompt}`;

  try {
    let operation = await ai.models.generateVideos({
      model,
      prompt: enhancedPrompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation completed but no URI returned.");
    
    // Fetch the actual video bytes using the API key
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Video generation failed:", error);
    throw error;
  }
};
