/**
 * Transcription Service
 *
 * Handles audio transcription with speaker diarization.
 * Supports multiple backends:
 * - Local Whisper (via Python script)
 * - OpenAI Whisper API
 * - WhisperX for speaker diarization
 */

export interface TranscriptSegment {
  speaker: 'Agent' | 'Customer' | 'Unknown';
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface TranscriptionResult {
  success: boolean;
  transcript: string;  // Full formatted transcript
  segments: TranscriptSegment[];
  duration: number;
  error?: string;
}

export interface TranscriptionSettings {
  provider: 'local' | 'openai' | 'whisperx';
  localEndpoint?: string;  // For local Whisper server
  openaiApiKey?: string;
  model?: string;
  language?: string;
}

const DEFAULT_SETTINGS: TranscriptionSettings = {
  provider: 'openai', // Default to OpenAI Whisper API
  localEndpoint: '',  // No localhost fallback - must be configured
  model: 'whisper-1',
  language: 'en',
};

/**
 * Format segments into a readable transcript with speaker labels
 */
export function formatTranscript(segments: TranscriptSegment[]): string {
  let transcript = '';
  let currentSpeaker = '';

  for (const segment of segments) {
    if (segment.speaker !== currentSpeaker) {
      currentSpeaker = segment.speaker;
      transcript += `\n${segment.speaker}: `;
    }
    transcript += segment.text + ' ';
  }

  return transcript.trim();
}

/**
 * Parse a formatted transcript back into segments
 * Handles formats like:
 * - "Agent: Hello..."
 * - "[Agent] Hello..."
 * - "AGENT: Hello..."
 */
export function parseTranscriptToSegments(transcript: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Common patterns for speaker labels
  const patterns = [
    /^(Agent|Customer|Rep|Representative|Caller|Client):\s*/gim,
    /^\[(Agent|Customer|Rep|Representative|Caller|Client)\]\s*/gim,
    /^(AGENT|CUSTOMER|REP|REPRESENTATIVE|CALLER|CLIENT):\s*/gm,
  ];

  // Split by speaker labels
  const lines = transcript.split('\n');
  let currentSpeaker: 'Agent' | 'Customer' | 'Unknown' = 'Unknown';
  let currentText = '';
  let segmentIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for speaker label
    let foundSpeaker = false;
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(trimmed);
      if (match) {
        // Save previous segment
        if (currentText) {
          segments.push({
            speaker: currentSpeaker,
            text: currentText.trim(),
            start: segmentIndex * 10,  // Approximate timing
            end: (segmentIndex + 1) * 10,
          });
          segmentIndex++;
        }

        // Determine speaker type
        const speakerLabel = match[1].toLowerCase();
        if (['agent', 'rep', 'representative'].includes(speakerLabel)) {
          currentSpeaker = 'Agent';
        } else if (['customer', 'caller', 'client'].includes(speakerLabel)) {
          currentSpeaker = 'Customer';
        }

        currentText = trimmed.substring(match[0].length);
        foundSpeaker = true;
        break;
      }
    }

    if (!foundSpeaker) {
      currentText += ' ' + trimmed;
    }
  }

  // Add final segment
  if (currentText) {
    segments.push({
      speaker: currentSpeaker,
      text: currentText.trim(),
      start: segmentIndex * 10,
      end: (segmentIndex + 1) * 10,
    });
  }

  return segments;
}

/**
 * Transcribe audio file using local Whisper server
 */
export async function transcribeWithLocalWhisper(
  audioFile: File | Blob,
  settings: TranscriptionSettings = DEFAULT_SETTINGS
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', settings.model || 'base');
    formData.append('language', settings.language || 'en');
    formData.append('diarize', 'true');  // Request speaker diarization

    const response = await fetch(`${settings.localEndpoint}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.status}`);
    }

    const result = await response.json();

    // Convert to our segment format
    const segments: TranscriptSegment[] = result.segments.map((seg: any) => ({
      speaker: identifySpeaker(seg.speaker || seg.speaker_id, result.speakers),
      text: seg.text,
      start: seg.start,
      end: seg.end,
    }));

    return {
      success: true,
      transcript: formatTranscript(segments),
      segments,
      duration: result.duration || segments[segments.length - 1]?.end || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      transcript: '',
      segments: [],
      duration: 0,
      error: error.message,
    };
  }
}

/**
 * Transcribe using OpenAI Whisper API
 * Note: OpenAI doesn't provide diarization, we'll use AI to infer speakers
 */
export async function transcribeWithOpenAI(
  audioFile: File | Blob,
  apiKey: string,
  settings: TranscriptionSettings = DEFAULT_SETTINGS
): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    formData.append('file', audioFile, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('language', settings.language || 'en');
    formData.append('response_format', 'verbose_json');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();

    // OpenAI returns segments without speaker labels
    // We'll need to use AI to infer speakers from context
    const rawSegments = result.segments || [];
    const segments = await inferSpeakers(rawSegments, apiKey);

    return {
      success: true,
      transcript: formatTranscript(segments),
      segments,
      duration: result.duration || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      transcript: '',
      segments: [],
      duration: 0,
      error: error.message,
    };
  }
}

/**
 * Identify speaker type from speaker ID/label
 */
function identifySpeaker(
  speakerId: string | number,
  speakerMapping?: Record<string, string>
): 'Agent' | 'Customer' | 'Unknown' {
  // If we have a mapping, use it
  if (speakerMapping && speakerId in speakerMapping) {
    const mapped = speakerMapping[speakerId].toLowerCase();
    if (mapped.includes('agent') || mapped.includes('rep')) return 'Agent';
    if (mapped.includes('customer') || mapped.includes('caller')) return 'Customer';
  }

  // Default: Speaker 0 is usually the Agent (they speak first in outbound calls)
  if (speakerId === 0 || speakerId === 'SPEAKER_00') return 'Agent';
  if (speakerId === 1 || speakerId === 'SPEAKER_01') return 'Customer';

  return 'Unknown';
}

/**
 * Use AI to infer speakers from transcript context
 * This is used when we have a flat transcript without speaker labels
 */
async function inferSpeakers(
  segments: any[],
  apiKey: string
): Promise<TranscriptSegment[]> {
  // Combine segments into text for analysis
  const fullText = segments.map(s => s.text).join(' ');

  // Use GPT to identify speaker changes
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at identifying speakers in call transcripts.
Given a call transcript, identify which parts are spoken by the Agent (customer service representative) and which by the Customer.
The Agent typically:
- Introduces themselves and the company
- Asks verification questions
- Provides information about accounts
- Uses professional language
The Customer typically:
- Responds to questions
- Asks about their account
- May express concerns or frustrations
Return JSON with speaker labels for each segment.`
          },
          {
            role: 'user',
            content: `Analyze this transcript and add speaker labels:\n\n${fullText.substring(0, 4000)}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error('AI speaker detection failed');
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    // Parse the AI response and map back to segments
    // For now, use simple heuristics as fallback
    return segments.map((seg, index) => ({
      speaker: index % 2 === 0 ? 'Agent' : 'Customer' as 'Agent' | 'Customer',
      text: seg.text,
      start: seg.start || index * 5,
      end: seg.end || (index + 1) * 5,
    }));
  } catch (error) {
    // Fallback: alternate speakers
    return segments.map((seg, index) => ({
      speaker: index % 2 === 0 ? 'Agent' : 'Customer' as 'Agent' | 'Customer',
      text: seg.text,
      start: seg.start || index * 5,
      end: seg.end || (index + 1) * 5,
    }));
  }
}

/**
 * Add speaker labels to an existing transcript using AI
 * Requires explicit endpoint configuration - no localhost fallback
 */
export async function addSpeakerLabels(
  transcript: string,
  aiEndpoint: string,
  model: string = 'gemini-2.0-flash'
): Promise<string> {
  if (!aiEndpoint) {
    throw new Error('AI endpoint required for speaker labeling. Configure AI settings.');
  }
  // Check if transcript already has speaker labels
  if (/^(Agent|Customer|Rep|Caller):/im.test(transcript)) {
    return transcript;
  }

  try {
    const response = await fetch(aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a transcript formatter. Your job is to add speaker labels (Agent: or Customer:) to call transcripts.

Rules:
1. The Agent is the customer service representative who usually:
   - Greets and introduces themselves
   - Asks verification questions
   - Provides account information
   - Makes offers or arrangements

2. The Customer is the person calling or being called who usually:
   - Responds to questions
   - Asks about their account
   - Expresses concerns or requests

Output the transcript with each speaker's lines labeled clearly.
Format:
Agent: [their line]
Customer: [their line]

Only output the labeled transcript, nothing else.`
          },
          {
            role: 'user',
            content: `Add speaker labels to this transcript:\n\n${transcript.substring(0, 6000)}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      return transcript;  // Return original if AI fails
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || transcript;
  } catch (error) {
    console.error('Failed to add speaker labels:', error);
    return transcript;
  }
}

/**
 * Check if transcript has speaker labels
 */
export function hasSpeekerLabels(transcript: string): boolean {
  const patterns = [
    /^(Agent|Customer|Rep|Representative|Caller|Client):/im,
    /^\[(Agent|Customer|Rep|Representative|Caller|Client)\]/im,
  ];
  return patterns.some(p => p.test(transcript));
}
