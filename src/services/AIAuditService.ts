/**
 * AI Audit Service
 *
 * Cloud-ready AI auditing service with:
 * - Intelligent call type detection
 * - Adaptive scoring based on call type
 * - Multiple AI provider support
 * - CRM-specific retention auditing
 */

import { supabase } from '@/integrations/supabase/client';

// Call Types that the AI will detect and handle differently
export type CallType =
  | 'live_call'           // Full conversation with customer
  | 'voicemail'           // Agent left a voicemail
  | 'voicemail_received'  // Customer voicemail received
  | 'hangup'              // Customer hung up immediately
  | 'wrong_number'        // Wrong number/disconnected
  | 'no_answer'           // No answer, no voicemail
  | 'transfer'            // Call was transferred
  | 'callback_scheduled'  // Callback was scheduled
  | 'payment_call'        // Payment-related call
  | 'retention_call'      // Retention/save attempt
  | 'inbound_inquiry'     // Inbound customer inquiry
  | 'outbound_collection' // Outbound collection call
  | 'unknown';            // Could not determine

// Call type detection results
export interface CallTypeDetection {
  callType: CallType;
  confidence: number;  // 0-100
  indicators: string[];
  duration_category: 'very_short' | 'short' | 'medium' | 'long';
  has_two_way_conversation: boolean;
  customer_engaged: boolean;
}

// Scoring adjustments based on call type
export interface ScoringAdjustment {
  callType: CallType;
  scorable: boolean;  // Whether this call type should receive a full score
  adjustments: {
    compliance_weight: number;    // 0-1 multiplier
    communication_weight: number;
    empathy_weight: number;
    resolution_weight: number;
    accuracy_weight: number;
    tone_weight: number;
  };
  minimumCriteria: string[];  // Only these criteria apply
  skipCriteria: string[];     // These criteria don't apply
  explanation: string;        // Why this call type is scored differently
}

// AI Provider configuration
export interface AIProvider {
  name: 'openai' | 'anthropic' | 'lmstudio' | 'ollama' | 'azure' | 'gemini';
  endpoint: string;
  model: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
}

// Audit result from AI
export interface AIAuditResult {
  callType: CallTypeDetection;
  scorable: boolean;
  overall_score: number;
  communication_score: number;
  compliance_score: number;
  accuracy_score: number;
  tone_score: number;
  empathy_score: number;
  resolution_score: number;
  feedback: string;
  strengths: string[];
  areas_for_improvement: string[];
  recommendations: string[];
  criteria_results: CriterionResult[];
  scoring_notes: string;  // Explains any adjustments made
  ai_provider: string;
  ai_model: string;
  processing_time_ms: number;
}

export interface CriterionResult {
  id: string;
  name: string;
  result: 'PASS' | 'PARTIAL' | 'FAIL' | 'N/A';
  score: number;
  explanation: string;
  recommendation?: string;
}

// Default scoring adjustments per call type
const CALL_TYPE_SCORING: Record<CallType, ScoringAdjustment> = {
  live_call: {
    callType: 'live_call',
    scorable: true,
    adjustments: {
      compliance_weight: 1.0,
      communication_weight: 1.0,
      empathy_weight: 1.0,
      resolution_weight: 1.0,
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Full scoring applies to live conversations',
  },
  voicemail: {
    callType: 'voicemail',
    scorable: false,  // Voicemails are not scored but still count as calls on agent profiles
    adjustments: {
      compliance_weight: 0,
      communication_weight: 0,
      empathy_weight: 0,
      resolution_weight: 0,
      accuracy_weight: 0,
      tone_weight: 0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Voicemails are not audited but are counted as calls on agent profiles',
  },
  voicemail_received: {
    callType: 'voicemail_received',
    scorable: false,
    adjustments: {
      compliance_weight: 0,
      communication_weight: 0,
      empathy_weight: 0,
      resolution_weight: 0,
      accuracy_weight: 0,
      tone_weight: 0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Inbound voicemails are not scorable - no agent interaction',
  },
  hangup: {
    callType: 'hangup',
    scorable: false,
    adjustments: {
      compliance_weight: 0,
      communication_weight: 0,
      empathy_weight: 0,
      resolution_weight: 0,
      accuracy_weight: 0,
      tone_weight: 0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Immediate hangups cannot be scored - no meaningful interaction',
  },
  wrong_number: {
    callType: 'wrong_number',
    scorable: false,
    adjustments: {
      compliance_weight: 0,
      communication_weight: 0,
      empathy_weight: 0,
      resolution_weight: 0,
      accuracy_weight: 0,
      tone_weight: 0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Wrong number calls cannot be scored fairly',
  },
  no_answer: {
    callType: 'no_answer',
    scorable: false,
    adjustments: {
      compliance_weight: 0,
      communication_weight: 0,
      empathy_weight: 0,
      resolution_weight: 0,
      accuracy_weight: 0,
      tone_weight: 0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'No answer calls have no interaction to score',
  },
  transfer: {
    callType: 'transfer',
    scorable: true,
    adjustments: {
      compliance_weight: 0.8,
      communication_weight: 1.0,
      empathy_weight: 0.7,
      resolution_weight: 0.5,
      accuracy_weight: 0.8,
      tone_weight: 1.0,
    },
    minimumCriteria: ['GREETING', 'TRANSFER_EXPLANATION', 'PROFESSIONAL_TONE'],
    skipCriteria: ['FULL_RESOLUTION', 'PAYMENT_ARRANGEMENT'],
    explanation: 'Transfer calls scored on handling before transfer',
  },
  callback_scheduled: {
    callType: 'callback_scheduled',
    scorable: true,
    adjustments: {
      compliance_weight: 0.9,
      communication_weight: 1.0,
      empathy_weight: 0.8,
      resolution_weight: 0.6,
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: ['CALLBACK_CONFIRMATION', 'CONTACT_INFO_VERIFICATION'],
    skipCriteria: ['FULL_RESOLUTION'],
    explanation: 'Callback scheduling scored on proper scheduling and communication',
  },
  payment_call: {
    callType: 'payment_call',
    scorable: true,
    adjustments: {
      compliance_weight: 1.0,
      communication_weight: 1.0,
      empathy_weight: 0.8,
      resolution_weight: 1.0,
      accuracy_weight: 1.0,
      tone_weight: 0.9,
    },
    minimumCriteria: ['PAYMENT_VERIFICATION', 'COMPLIANCE_DISCLOSURE', 'ACCURATE_AMOUNTS'],
    skipCriteria: [],
    explanation: 'Payment calls require full compliance and accuracy scoring',
  },
  retention_call: {
    callType: 'retention_call',
    scorable: true,
    adjustments: {
      compliance_weight: 1.0,
      communication_weight: 1.0,
      empathy_weight: 1.2,  // Extra weight on empathy for retention
      resolution_weight: 1.2,  // Extra weight on resolution
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: ['RETENTION_OFFER', 'CUSTOMER_CONCERNS', 'RESOLUTION_ATTEMPT'],
    skipCriteria: [],
    explanation: 'Retention calls emphasize empathy and resolution to save customer',
  },
  inbound_inquiry: {
    callType: 'inbound_inquiry',
    scorable: true,
    adjustments: {
      compliance_weight: 0.9,
      communication_weight: 1.0,
      empathy_weight: 1.0,
      resolution_weight: 1.0,
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: ['GREETING', 'INQUIRY_HANDLING', 'ACCURATE_INFO'],
    skipCriteria: [],
    explanation: 'Inbound inquiries scored on helpfulness and accuracy',
  },
  outbound_collection: {
    callType: 'outbound_collection',
    scorable: true,
    adjustments: {
      compliance_weight: 1.0,
      communication_weight: 1.0,
      empathy_weight: 0.9,
      resolution_weight: 1.0,
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: ['MINI_MIRANDA', 'PAYMENT_DISCUSSION', 'COMPLIANCE_DISCLOSURE'],
    skipCriteria: [],
    explanation: 'Collection calls require strict compliance scoring',
  },
  unknown: {
    callType: 'unknown',
    scorable: true,
    adjustments: {
      compliance_weight: 1.0,
      communication_weight: 1.0,
      empathy_weight: 1.0,
      resolution_weight: 1.0,
      accuracy_weight: 1.0,
      tone_weight: 1.0,
    },
    minimumCriteria: [],
    skipCriteria: [],
    explanation: 'Unknown call type - applying standard scoring',
  },
};

/**
 * Build the call type detection prompt
 */
function buildCallTypeDetectionPrompt(transcript: string, duration: number): string {
  return `You are an expert call classifier. Analyze this call transcript and determine the call type.

CALL DURATION: ${duration} seconds

TRANSCRIPT:
${transcript.substring(0, 5000)}

Based on the transcript content, classify this call into ONE of these types:
- live_call: Full two-way conversation with customer engagement
- voicemail: Agent left a voicemail message
- voicemail_received: Customer left a voicemail (agent listening)
- hangup: Customer hung up immediately or within seconds
- wrong_number: Wrong number or disconnected number
- no_answer: No answer, phone just rang
- transfer: Call was transferred to another department/person
- callback_scheduled: A callback was scheduled for later
- payment_call: Call focused on taking/discussing payment
- retention_call: Call focused on retaining/saving the customer
- inbound_inquiry: Customer called with a question/inquiry
- outbound_collection: Outbound call for debt collection

Return ONLY valid JSON:
{
  "call_type": "one of the types above",
  "confidence": 0-100,
  "indicators": ["indicator1", "indicator2"],
  "has_two_way_conversation": true/false,
  "customer_engaged": true/false,
  "reasoning": "brief explanation"
}`;
}

/**
 * Build the main audit prompt with call type awareness
 */
function buildAdaptiveAuditPrompt(
  transcript: string,
  callType: CallTypeDetection,
  criteria: any[],
  scoringAdjustment: ScoringAdjustment,
  isRetentionCall: boolean = false
): string {
  const applicableCriteria = criteria.filter(c => {
    if (scoringAdjustment.skipCriteria.includes(c.id)) return false;
    return true;
  });

  const criteriaText = applicableCriteria.map(c =>
    `- ${c.id}: ${c.name} (${c.dimension}) - ${c.description}`
  ).join('\n');

  const retentionContext = isRetentionCall ? `
SPECIAL CONTEXT - RETENTION CALL:
This is a retention/save call. Pay special attention to:
- Did the agent identify why the customer wants to cancel/leave?
- Did the agent offer appropriate retention solutions?
- Did the agent show genuine empathy and understanding?
- Was the agent persistent but not aggressive?
- Did the agent document the outcome properly?
` : '';

  return `You are an expert call quality auditor. This call has been classified as: ${callType.callType}
${scoringAdjustment.explanation}

CALL TYPE: ${callType.callType}
CONFIDENCE: ${callType.confidence}%
DURATION CATEGORY: ${callType.duration_category}
TWO-WAY CONVERSATION: ${callType.has_two_way_conversation}
CUSTOMER ENGAGED: ${callType.customer_engaged}
${retentionContext}
SCORING WEIGHTS FOR THIS CALL TYPE:
- Compliance: ${(scoringAdjustment.adjustments.compliance_weight * 100).toFixed(0)}%
- Communication: ${(scoringAdjustment.adjustments.communication_weight * 100).toFixed(0)}%
- Empathy: ${(scoringAdjustment.adjustments.empathy_weight * 100).toFixed(0)}%
- Resolution: ${(scoringAdjustment.adjustments.resolution_weight * 100).toFixed(0)}%
- Accuracy: ${(scoringAdjustment.adjustments.accuracy_weight * 100).toFixed(0)}%
- Tone: ${(scoringAdjustment.adjustments.tone_weight * 100).toFixed(0)}%

APPLICABLE CRITERIA FOR THIS CALL TYPE:
${criteriaText}

${scoringAdjustment.minimumCriteria.length > 0 ? `
MINIMUM REQUIRED CRITERIA (must evaluate these):
${scoringAdjustment.minimumCriteria.join(', ')}
` : ''}

TRANSCRIPT:
${transcript.substring(0, 12000)}

IMPORTANT SCORING GUIDELINES:
1. Be FAIR - consider the call type when scoring
2. ${callType.callType === 'voicemail' ? 'This is a voicemail - only score what the agent could control' : ''}
3. ${!callType.has_two_way_conversation ? 'Limited conversation detected - adjust expectations accordingly' : ''}
4. Score criteria as N/A if they genuinely don't apply to this call type
5. Be specific in feedback - cite exact transcript moments

Return ONLY valid JSON:
{
  "overall_score": 0-100,
  "summary": "2-3 sentence summary of call quality",
  "communication_score": 0-100,
  "compliance_score": 0-100,
  "accuracy_score": 0-100,
  "tone_score": 0-100,
  "empathy_score": 0-100,
  "resolution_score": 0-100,
  "strengths": ["specific strength 1", "specific strength 2"],
  "areas_for_improvement": ["specific area 1", "specific area 2"],
  "recommendations": ["actionable recommendation 1", "actionable recommendation 2"],
  "scoring_notes": "explanation of any scoring adjustments made for this call type",
  "criteria": [
    {
      "id": "CRITERION_ID",
      "result": "PASS|PARTIAL|FAIL|N/A",
      "score": 0-100,
      "explanation": "specific reason with transcript evidence",
      "recommendation": "improvement tip if applicable"
    }
  ]
}`;
}

/**
 * Detect call type from transcript
 */
export async function detectCallType(
  transcript: string,
  duration: number,
  aiProvider: AIProvider
): Promise<CallTypeDetection> {
  const startTime = Date.now();

  // Quick heuristics for obvious cases
  const durationCategory =
    duration < 15 ? 'very_short' :
    duration < 60 ? 'short' :
    duration < 300 ? 'medium' : 'long';

  // Check for obvious patterns
  const lowerTranscript = transcript.toLowerCase();

  // Voicemail indicators
  const voicemailIndicators = [
    'leave a message',
    'after the beep',
    'voicemail',
    'please leave',
    'at the tone',
    'not available',
    'mailbox',
  ];

  const isLikelyVoicemail = voicemailIndicators.some(ind => lowerTranscript.includes(ind))
    && duration < 120;

  // Hangup indicators (very short, minimal content)
  if (duration < 10 && transcript.length < 200) {
    return {
      callType: 'hangup',
      confidence: 90,
      indicators: ['Very short duration', 'Minimal transcript content'],
      duration_category: durationCategory,
      has_two_way_conversation: false,
      customer_engaged: false,
    };
  }

  // Use AI for more complex detection
  try {
    const prompt = buildCallTypeDetectionPrompt(transcript, duration);
    const response = await callAIProvider(aiProvider, prompt);

    const parsed = parseJSONResponse(response);

    return {
      callType: parsed.call_type || 'unknown',
      confidence: parsed.confidence || 50,
      indicators: parsed.indicators || [],
      duration_category: durationCategory,
      has_two_way_conversation: parsed.has_two_way_conversation ?? true,
      customer_engaged: parsed.customer_engaged ?? true,
    };
  } catch (error) {
    console.error('Call type detection error:', error);

    // Fallback based on heuristics
    return {
      callType: isLikelyVoicemail ? 'voicemail' : (duration > 60 ? 'live_call' : 'unknown'),
      confidence: 40,
      indicators: ['Fallback detection used'],
      duration_category: durationCategory,
      has_two_way_conversation: duration > 60,
      customer_engaged: duration > 60,
    };
  }
}

/**
 * Main audit function with adaptive scoring
 */
export async function auditCallWithTypeDetection(
  transcript: string,
  duration: number,
  criteria: any[],
  aiProvider: AIProvider,
  options: {
    isCRMRetentionCall?: boolean;
    forceCallType?: CallType;
    userId?: string;
  } = {}
): Promise<AIAuditResult> {
  const startTime = Date.now();

  // Step 1: Detect call type (or use forced type)
  let callType: CallTypeDetection;
  if (options.forceCallType) {
    callType = {
      callType: options.forceCallType,
      confidence: 100,
      indicators: ['Manually specified'],
      duration_category: duration < 60 ? 'short' : duration < 300 ? 'medium' : 'long',
      has_two_way_conversation: true,
      customer_engaged: true,
    };
  } else {
    callType = await detectCallType(transcript, duration, aiProvider);
  }

  // Step 2: Get scoring adjustment for this call type
  const scoringAdjustment = CALL_TYPE_SCORING[callType.callType];

  // Step 3: Check if call is scorable
  if (!scoringAdjustment.scorable) {
    return {
      callType,
      scorable: false,
      overall_score: 0,
      communication_score: 0,
      compliance_score: 0,
      accuracy_score: 0,
      tone_score: 0,
      empathy_score: 0,
      resolution_score: 0,
      feedback: scoringAdjustment.explanation,
      strengths: [],
      areas_for_improvement: [],
      recommendations: [],
      criteria_results: [],
      scoring_notes: `This ${callType.callType} call type is not scorable. ${scoringAdjustment.explanation}`,
      ai_provider: aiProvider.name,
      ai_model: aiProvider.model,
      processing_time_ms: Date.now() - startTime,
    };
  }

  // Step 4: Build and send audit prompt
  const prompt = buildAdaptiveAuditPrompt(
    transcript,
    callType,
    criteria,
    scoringAdjustment,
    options.isCRMRetentionCall || callType.callType === 'retention_call'
  );

  // Helper to clamp scores to valid 0-100 range
  const clampScore = (score: number): number => Math.min(100, Math.max(0, Math.round(score)));

  // Helper to validate score from AI response
  const validateScore = (score: unknown): number => {
    const num = typeof score === 'number' ? score : parseFloat(String(score));
    return isNaN(num) ? 0 : clampScore(num);
  };

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callAIProvider(aiProvider, prompt);
      const parsed = parseJSONResponse(response);

      // Validate that parsed response has required fields
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI response is not a valid object');
      }

      // Apply scoring weights with validation and clamping
      const adjustedScores = {
        compliance_score: clampScore(validateScore(parsed.compliance_score) * scoringAdjustment.adjustments.compliance_weight),
        communication_score: clampScore(validateScore(parsed.communication_score) * scoringAdjustment.adjustments.communication_weight),
        empathy_score: clampScore(validateScore(parsed.empathy_score) * scoringAdjustment.adjustments.empathy_weight),
        resolution_score: clampScore(validateScore(parsed.resolution_score) * scoringAdjustment.adjustments.resolution_weight),
        accuracy_score: clampScore(validateScore(parsed.accuracy_score) * scoringAdjustment.adjustments.accuracy_weight),
        tone_score: clampScore(validateScore(parsed.tone_score) * scoringAdjustment.adjustments.tone_weight),
      };

      // Calculate weighted overall score
      const weights = scoringAdjustment.adjustments;
      const totalWeight = weights.compliance_weight + weights.communication_weight +
        weights.empathy_weight + weights.resolution_weight + weights.accuracy_weight + weights.tone_weight;

      const weightedOverall = totalWeight > 0 ? (
        adjustedScores.compliance_score * weights.compliance_weight +
        adjustedScores.communication_score * weights.communication_weight +
        adjustedScores.empathy_score * weights.empathy_weight +
        adjustedScores.resolution_score * weights.resolution_weight +
        adjustedScores.accuracy_score * weights.accuracy_weight +
        adjustedScores.tone_score * weights.tone_weight
      ) / totalWeight : 0;

      return {
        callType,
        scorable: true,
        overall_score: clampScore(weightedOverall),
        ...adjustedScores,
        feedback: parsed.summary || '',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
        areas_for_improvement: Array.isArray(parsed.areas_for_improvement) ? parsed.areas_for_improvement : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        criteria_results: Array.isArray(parsed.criteria) ? parsed.criteria : [],
        scoring_notes: `${parsed.scoring_notes || ''}\n\nCall Type: ${callType.callType} (${callType.confidence}% confidence)`,
        ai_provider: aiProvider.name,
        ai_model: aiProvider.model,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Audit attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      // Don't retry on validation errors (bad AI response format)
      if (lastError.message.includes('not a valid object') || lastError.message.includes('Failed to parse')) {
        break;
      }

      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw lastError || new Error('Audit failed after all retries');
}

/**
 * Helper to add timeout to fetch requests
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 120000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generic AI provider caller
 */
async function callAIProvider(provider: AIProvider, prompt: string): Promise<string> {
  // Handle Gemini/Google AI Studio separately due to different API format
  if (provider.name === 'gemini') {
    return callGeminiProvider(provider, prompt);
  }

  const requestBody = {
    model: provider.model,
    messages: [
      { role: 'system', content: 'You are an expert call quality auditor. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: provider.temperature,
    max_tokens: provider.maxTokens,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider.apiKey) {
    if (provider.name === 'anthropic') {
      headers['x-api-key'] = provider.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }
  }

  const response = await fetchWithTimeout(provider.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  }, 120000); // 2 minute timeout

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI provider error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  // Handle different response formats
  if (provider.name === 'anthropic') {
    return data.content?.[0]?.text || '';
  }

  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Google AI Studio / Gemini API
 * Uses the generateContent endpoint with proper formatting
 */
async function callGeminiProvider(provider: AIProvider, prompt: string): Promise<string> {
  const endpoint = `${provider.endpoint}?key=${provider.apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `You are an expert call quality auditor. Always respond with valid JSON only.\n\n${prompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: provider.temperature,
      maxOutputTokens: provider.maxTokens,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }, 120000); // 2 minute timeout

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  // Check for blocked content or other issues
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    throw new Error('Gemini blocked the response due to safety filters');
  }

  // Extract text from Gemini response format
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    throw new Error('Gemini returned empty response');
  }
  return text;
}

/**
 * Parse JSON response, handling markdown wrapping
 */
function parseJSONResponse(response: string): any {
  let jsonStr = response.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to find JSON object in response
    const match = jsonStr.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Get default AI provider configuration
 */
export function getDefaultAIProvider(): AIProvider {
  // Check for LM Studio first (local/free)
  return {
    name: 'lmstudio',
    endpoint: 'http://localhost:1234/v1/chat/completions',
    model: 'local-model',
    maxTokens: 4000,
    temperature: 0.3,
  };
}

/**
 * Get OpenAI provider configuration
 */
export function getOpenAIProvider(apiKey: string): AIProvider {
  return {
    name: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey,
    maxTokens: 4000,
    temperature: 0.3,
  };
}

/**
 * Get Ollama provider configuration (for local/server deployment)
 *
 * Recommended models for call auditing:
 * - llama3.1:8b - Good balance of speed and quality
 * - llama3.1:70b - Best quality (requires more VRAM)
 * - mistral:7b - Fast, good for high volume
 * - mixtral:8x7b - High quality, moderate speed
 * - qwen2.5:14b - Excellent for structured output
 */
export function getOllamaProvider(
  host: string = 'http://localhost:11434',
  model: string = 'llama3.1:8b'
): AIProvider {
  return {
    name: 'ollama',
    endpoint: `${host}/v1/chat/completions`,
    model,
    maxTokens: 4000,
    temperature: 0.3,
  };
}

/**
 * Get provider for NVIDIA GPU server
 * Uses Ollama with optimized settings for GPU inference
 */
export function getNvidiaServerProvider(
  serverHost: string,
  model: string = 'llama3.1:8b'
): AIProvider {
  return {
    name: 'ollama',
    endpoint: `${serverHost}/v1/chat/completions`,
    model,
    maxTokens: 4000,
    temperature: 0.3,
  };
}

/**
 * Get Google AI Studio / Gemini provider configuration
 *
 * Recommended models:
 * - gemini-2.0-flash - Fast, cost-effective for high volume
 * - gemini-2.5-flash - Latest flash model with thinking capability
 * - gemini-2.5-pro - Best quality for complex auditing
 *
 * @param apiKey - Google AI Studio API key
 * @param model - Model to use (default: gemini-2.0-flash)
 */
export function getGeminiProvider(
  apiKey: string,
  model: string = 'gemini-2.0-flash'
): AIProvider {
  // Strip -latest suffix if present (no longer used in v1beta API)
  const normalizedModel = model.replace('-latest', '');

  return {
    name: 'gemini',
    endpoint: `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`,
    model: normalizedModel,
    apiKey,
    maxTokens: 4000,
    temperature: 0.3,
  };
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, message: `API Error: ${error}` };
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name).slice(0, 5) || [];
    return {
      success: true,
      message: `Connected! Available models: ${models.join(', ')}...`
    };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error}` };
  }
}

/**
 * List available Gemini models
 */
export async function listGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.models
      ?.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      ?.map((m: any) => m.name.replace('models/', '')) || [];
  } catch {
    return [];
  }
}

/**
 * Check if a provider is available
 */
export async function checkProviderAvailability(provider: AIProvider): Promise<boolean> {
  try {
    // Gemini uses different endpoint structure
    if (provider.name === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`
      );
      return response.ok;
    }

    // Ollama uses /api/tags for model list
    if (provider.name === 'ollama') {
      const baseUrl = provider.endpoint.replace('/v1/chat/completions', '');
      const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      return response.ok;
    }

    const testEndpoint = provider.endpoint.replace('/chat/completions', '/models');
    const response = await fetch(testEndpoint, {
      method: 'GET',
      headers: provider.apiKey ? { 'Authorization': `Bearer ${provider.apiKey}` } : {},
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * List available Ollama models
 */
export async function listOllamaModels(host: string = 'http://localhost:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Pull an Ollama model (download if not present)
 */
export async function pullOllamaModel(
  model: string,
  host: string = 'http://localhost:11434',
  onProgress?: (status: string) => void
): Promise<boolean> {
  try {
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    onProgress?.(`Model ${model} ready`);
    return true;
  } catch (error) {
    console.error('Failed to pull model:', error);
    return false;
  }
}

/**
 * Main entry point for performing audits
 * This is a convenience wrapper around auditCallWithTypeDetection
 */
export async function performAudit(
  transcript: string,
  aiProvider: AIProvider,
  criteria: any[],
  options: {
    callDurationSeconds?: number;
    campaignName?: string;
    callType?: string;
  } = {}
): Promise<AIAuditResult & { explanation?: string }> {
  // Estimate duration from transcript if not provided
  const wordCount = transcript.split(/\s+/).length;
  const estimatedDuration = options.callDurationSeconds || Math.ceil(wordCount / 2.5); // ~150 words per minute

  const result = await auditCallWithTypeDetection(
    transcript,
    estimatedDuration,
    criteria,
    aiProvider,
    {
      isCRMRetentionCall: options.callType === 'retention_call' || options.campaignName?.toLowerCase().includes('retention'),
    }
  );

  // Add explanation for non-scorable calls
  if (!result.scorable) {
    return {
      ...result,
      explanation: result.scoring_notes,
    };
  }

  return result;
}

// Recommended models by use case
export const RECOMMENDED_MODELS = {
  // Google AI Studio / Gemini (cloud, API key required)
  gemini: [
    { model: 'gemini-2.0-flash', description: 'Fast, cost-effective (Recommended)', provider: 'gemini' },
    { model: 'gemini-2.5-flash', description: 'Latest model with thinking', provider: 'gemini' },
    { model: 'gemini-2.5-pro', description: 'Best quality for complex audits', provider: 'gemini' },
  ],
  // For laptops/development (8GB+ VRAM)
  development: [
    { model: 'llama3.1:8b', description: 'Best balance for development', vram: '8GB' },
    { model: 'mistral:7b', description: 'Fast inference', vram: '6GB' },
    { model: 'qwen2.5:7b', description: 'Good structured output', vram: '6GB' },
  ],
  // For server with good GPU (24GB+ VRAM)
  production: [
    { model: 'llama3.1:70b', description: 'Highest quality', vram: '48GB' },
    { model: 'mixtral:8x7b', description: 'High quality, good speed', vram: '32GB' },
    { model: 'qwen2.5:32b', description: 'Excellent for JSON output', vram: '24GB' },
  ],
  // For high-volume processing
  highVolume: [
    { model: 'gemini-2.0-flash', description: 'Fast cloud API', provider: 'gemini' },
    { model: 'llama3.1:8b', description: 'Fast with good quality', vram: '8GB' },
    { model: 'mistral:7b', description: 'Fastest local option', vram: '6GB' },
  ],
};
