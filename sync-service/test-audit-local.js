/**
 * Test LM Studio Audit - No OpenAI Required
 *
 * Tests the audit flow with a sample transcript to verify
 * LM Studio is working correctly before connecting to Whisper.
 *
 * Usage:
 *   node test-audit-local.js
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  lmstudio: {
    url: process.env.LMSTUDIO_URL || 'http://localhost:1234',
  },
};

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Sample call transcript for testing
const SAMPLE_TRANSCRIPT = `
Agent: Thank you for calling Boost Credit Line, this is Sarah speaking. This call may be recorded for quality assurance. How can I help you today?

Customer: Hi, yeah I got a notice about my account being past due and I wanted to talk about it.

Agent: I'd be happy to help you with that. For verification purposes, can you please confirm your full name and the last four digits of your social security number?

Customer: Sure, it's John Smith, and the last four are 5678.

Agent: Thank you, Mr. Smith. I can see your account here. I do see that your account is currently 45 days past due with a balance of $1,247. I understand that can be stressful. Is everything okay?

Customer: Yeah, I lost my job a couple months ago and I'm just now getting back on my feet. I want to pay but I can't do the full amount right now.

Agent: I completely understand, and I appreciate you reaching out to us. We definitely want to work with you on this. Let me see what options we have available. Would you be able to make a partial payment today to show good faith?

Customer: I could probably do like $200 today if that helps.

Agent: That would be great, Mr. Smith. A $200 payment today would help bring your account closer to current status. I can also set up a payment plan for the remaining balance. Would you prefer weekly or bi-weekly payments?

Customer: Bi-weekly would work better with my pay schedule.

Agent: Perfect. So we'll process $200 today, and then I can set up bi-weekly payments of $175 starting in two weeks. That would have your account paid off in about 6 payments. Does that work for you?

Customer: Yeah, that sounds manageable. Let's do it.

Agent: Excellent. Let me get that payment processed for you. Can you confirm the card ending in 4532 is still valid?

Customer: Yes, that's correct.

Agent: Great, I've processed the $200 payment and set up your payment plan. You'll receive a confirmation email shortly with all the details. Is there anything else I can help you with today?

Customer: No, that's everything. Thank you for working with me on this.

Agent: You're very welcome, Mr. Smith. Thank you for calling Boost Credit Line and have a great day.

Customer: You too, bye.

Agent: Goodbye.
`;

/**
 * Check if LM Studio is available
 */
async function checkLMStudio() {
  try {
    const response = await fetch(`${config.lmstudio.url}/v1/models`, {
      method: 'GET',
    });
    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map(m => m.id) || [];
      return { available: true, models };
    }
    return { available: false, models: [] };
  } catch (err) {
    return { available: false, error: err.message };
  }
}

/**
 * Get default audit criteria
 */
function getDefaultCriteria() {
  return [
    { code: 'GREETING', name: 'Professional Greeting', description: 'Proper introduction, company name, agent identification, and recording disclosure' },
    { code: 'VERIFICATION', name: 'Identity Verification', description: 'Verified customer identity before discussing account details' },
    { code: 'COMPLIANCE', name: 'Regulatory Compliance', description: 'Made required disclosures (Mini-Miranda for collections if applicable)' },
    { code: 'TONE', name: 'Professional Tone', description: 'Maintained professional, courteous, and respectful tone throughout' },
    { code: 'EMPATHY', name: 'Empathy & Understanding', description: 'Showed understanding of customer situation and concerns' },
    { code: 'LISTENING', name: 'Active Listening', description: 'Listened to customer without interrupting, addressed their concerns' },
    { code: 'ACCURACY', name: 'Information Accuracy', description: 'Provided accurate information about account, options, and next steps' },
    { code: 'RESOLUTION', name: 'Issue Resolution', description: 'Worked toward resolution or established clear next steps' },
    { code: 'CLOSING', name: 'Professional Closing', description: 'Summarized call, confirmed next steps, professional goodbye' },
  ];
}

/**
 * Build the audit prompt
 */
function buildAuditPrompt(transcript, criteria) {
  const criteriaList = criteria.map(c =>
    `- ${c.code}: ${c.name} - ${c.description}`
  ).join('\n');

  return `You are an expert call quality auditor for a financial services company. Analyze this call transcript and provide a detailed quality assessment.

AUDIT CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript}

Respond with ONLY this JSON structure (no markdown, no explanation, just the raw JSON):
{
  "overall_score": <number 0-100>,
  "summary": "<2-3 sentence summary of call quality>",
  "communication_score": <number 0-100>,
  "compliance_score": <number 0-100>,
  "tone_score": <number 0-100>,
  "empathy_score": <number 0-100>,
  "resolution_score": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "areas_for_improvement": ["<area 1>", "<area 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"],
  "criteria": [
    {
      "id": "<criteria code>",
      "result": "PASS",
      "explanation": "<why this score>",
      "recommendation": "<specific improvement suggestion>"
    }
  ]
}

Scoring:
- PASS = Fully met criteria (100 points)
- PARTIAL = Partially met (50 points)
- FAIL = Did not meet criteria (0 points)
- Compliance issues should heavily impact overall_score

Return ONLY the JSON object, no other text.`;
}

/**
 * Parse LM Studio response
 */
function parseAuditResponse(content) {
  try {
    // Remove markdown code blocks if present
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    return {
      success: true,
      data: {
        overall_score: parsed.overall_score || 50,
        summary: parsed.summary || 'No summary provided',
        communication_score: parsed.communication_score,
        compliance_score: parsed.compliance_score,
        tone_score: parsed.tone_score,
        empathy_score: parsed.empathy_score,
        resolution_score: parsed.resolution_score,
        strengths: parsed.strengths || [],
        areas_for_improvement: parsed.areas_for_improvement || [],
        recommendations: parsed.recommendations || [],
        criteria: parsed.criteria || [],
      }
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
      raw: content.slice(0, 500),
    };
  }
}

/**
 * Run audit with LM Studio
 */
async function auditWithLMStudio(transcript) {
  const criteria = getDefaultCriteria();
  const prompt = buildAuditPrompt(transcript, criteria);

  console.log('Sending to LM Studio...');
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.lmstudio.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          {
            role: 'system',
            content: 'You are an expert call quality auditor. Analyze transcripts and return ONLY valid JSON. No markdown, no explanation, just the JSON object.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`Response received in ${processingTime}s`);

    if (!content) {
      throw new Error('No response content from LM Studio');
    }

    return {
      ...parseAuditResponse(content),
      processingTime,
      rawResponse: content,
    };

  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('LM Studio Audit Test (No OpenAI Required)');
  console.log('='.repeat(60));
  console.log('');

  // Check LM Studio
  console.log('Checking LM Studio...');
  const lmStatus = await checkLMStudio();

  if (!lmStatus.available) {
    console.log('');
    console.log('❌ LM Studio is not available!');
    console.log('');
    console.log('Please:');
    console.log('  1. Open LM Studio');
    console.log('  2. Load a model (recommend: Qwen 2.5 7B Instruct)');
    console.log('  3. Start the server (should run on port 1234)');
    console.log('  4. Run this test again');
    console.log('');
    if (lmStatus.error) {
      console.log(`Error: ${lmStatus.error}`);
    }
    process.exit(1);
  }

  console.log(`✓ LM Studio connected`);
  console.log(`  Models loaded: ${lmStatus.models.join(', ')}`);
  console.log('');

  // Run audit on sample transcript
  console.log('Running audit on sample transcript...');
  console.log(`  Transcript length: ${SAMPLE_TRANSCRIPT.length} characters`);
  console.log('');

  const result = await auditWithLMStudio(SAMPLE_TRANSCRIPT);

  if (!result.success) {
    console.log('');
    console.log('❌ Audit failed!');
    console.log(`  Error: ${result.error}`);
    if (result.raw) {
      console.log('');
      console.log('Raw response (first 500 chars):');
      console.log(result.raw);
    }
    process.exit(1);
  }

  // Display results
  console.log('');
  console.log('='.repeat(60));
  console.log('✅ AUDIT RESULTS');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Overall Score: ${result.data.overall_score}/100`);
  console.log(`Processing Time: ${result.processingTime}s`);
  console.log('');
  console.log('Dimensional Scores:');
  console.log(`  Communication: ${result.data.communication_score || 'N/A'}`);
  console.log(`  Compliance:    ${result.data.compliance_score || 'N/A'}`);
  console.log(`  Tone:          ${result.data.tone_score || 'N/A'}`);
  console.log(`  Empathy:       ${result.data.empathy_score || 'N/A'}`);
  console.log(`  Resolution:    ${result.data.resolution_score || 'N/A'}`);
  console.log('');
  console.log('Summary:');
  console.log(`  ${result.data.summary}`);
  console.log('');
  console.log('Strengths:');
  result.data.strengths.forEach(s => console.log(`  ✓ ${s}`));
  console.log('');
  console.log('Areas for Improvement:');
  result.data.areas_for_improvement.forEach(a => console.log(`  • ${a}`));
  console.log('');
  console.log('Criteria Results:');
  result.data.criteria.forEach(c => {
    const icon = c.result === 'PASS' ? '✓' : c.result === 'PARTIAL' ? '◐' : '✗';
    console.log(`  ${icon} ${c.id}: ${c.result}`);
    console.log(`      ${c.explanation}`);
  });
  console.log('');
  console.log('='.repeat(60));
  console.log('Test complete! LM Studio is working correctly.');
  console.log('='.repeat(60));

  // Ask if user wants to save to database
  console.log('');
  console.log('To test saving to database, run with --save flag:');
  console.log('  node test-audit-local.js --save');

  if (process.argv.includes('--save')) {
    console.log('');
    console.log('Saving test result to database...');

    // Get a random pending call to attach this to
    const { data: calls } = await supabase
      .from('calls')
      .select('id, call_id, user_id')
      .eq('status', 'pending')
      .limit(1);

    if (calls && calls.length > 0) {
      const call = calls[0];

      const { data: reportCard, error } = await supabase
        .from('report_cards')
        .insert({
          user_id: call.user_id,
          call_id: call.id,
          source_file: `test_${call.call_id}`,
          source_type: 'call',
          overall_score: result.data.overall_score,
          communication_score: result.data.communication_score,
          compliance_score: result.data.compliance_score,
          tone_score: result.data.tone_score,
          empathy_score: result.data.empathy_score,
          resolution_score: result.data.resolution_score,
          feedback: result.data.summary,
          strengths: result.data.strengths,
          areas_for_improvement: result.data.areas_for_improvement,
          recommendations: result.data.recommendations,
          criteria_results: result.data.criteria,
          ai_model: 'lm-studio-local',
          ai_provider: 'lmstudio',
          processing_time_ms: parseFloat(result.processingTime) * 1000,
        })
        .select()
        .single();

      if (error) {
        console.log(`❌ Failed to save: ${error.message}`);
      } else {
        console.log(`✓ Report card saved! ID: ${reportCard.id}`);

        // Update call status
        await supabase
          .from('calls')
          .update({
            status: 'audited',
            transcript_text: SAMPLE_TRANSCRIPT,
          })
          .eq('id', call.id);

        console.log(`✓ Call ${call.call_id} marked as audited`);
      }
    } else {
      console.log('No pending calls found to attach test result to');
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
