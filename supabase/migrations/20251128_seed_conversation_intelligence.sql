-- Seed default keyword libraries for Conversation Intelligence
-- Run this after the main conversation_intelligence migration

-- ============================================
-- Compliance Keywords Library
-- ============================================
INSERT INTO keyword_libraries (name, description, category, keywords, is_active)
VALUES (
  'FDCPA Compliance',
  'Required disclosures and compliance phrases for debt collection',
  'compliance',
  '[
    {"phrase": "this is an attempt to collect a debt", "weight": 1.0, "exact_match": false},
    {"phrase": "any information obtained will be used for that purpose", "weight": 1.0, "exact_match": false},
    {"phrase": "mini miranda", "weight": 1.0, "exact_match": false},
    {"phrase": "this call may be recorded", "weight": 0.8, "exact_match": false},
    {"phrase": "for quality assurance", "weight": 0.6, "exact_match": false},
    {"phrase": "debt collector", "weight": 0.8, "exact_match": false},
    {"phrase": "verify your identity", "weight": 0.7, "exact_match": false},
    {"phrase": "confirm your information", "weight": 0.6, "exact_match": false},
    {"phrase": "authorization", "weight": 0.5, "exact_match": false},
    {"phrase": "payment arrangement", "weight": 0.6, "exact_match": false}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Prohibited Keywords Library
-- ============================================
INSERT INTO keyword_libraries (name, description, category, keywords, is_active)
VALUES (
  'Prohibited Language',
  'Words and phrases that should never be used on calls',
  'prohibited',
  '[
    {"phrase": "arrest", "weight": 1.0, "exact_match": false},
    {"phrase": "jail", "weight": 1.0, "exact_match": false},
    {"phrase": "garnish your wages", "weight": 1.0, "exact_match": false},
    {"phrase": "sue you", "weight": 1.0, "exact_match": false},
    {"phrase": "take legal action", "weight": 0.9, "exact_match": false},
    {"phrase": "report to credit", "weight": 0.8, "exact_match": false},
    {"phrase": "threaten", "weight": 1.0, "exact_match": false},
    {"phrase": "stupid", "weight": 1.0, "exact_match": true},
    {"phrase": "idiot", "weight": 1.0, "exact_match": true},
    {"phrase": "liar", "weight": 1.0, "exact_match": true},
    {"phrase": "deadbeat", "weight": 1.0, "exact_match": true},
    {"phrase": "shut up", "weight": 1.0, "exact_match": false},
    {"phrase": "hang up on you", "weight": 0.9, "exact_match": false},
    {"phrase": "you have to", "weight": 0.6, "exact_match": false},
    {"phrase": "you must", "weight": 0.5, "exact_match": false}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Empathy Keywords Library
-- ============================================
INSERT INTO keyword_libraries (name, description, category, keywords, is_active)
VALUES (
  'Empathy Phrases',
  'Positive customer service and empathy expressions',
  'empathy',
  '[
    {"phrase": "I understand", "weight": 1.0, "exact_match": false},
    {"phrase": "I appreciate", "weight": 0.9, "exact_match": false},
    {"phrase": "thank you for", "weight": 0.8, "exact_match": false},
    {"phrase": "I can help", "weight": 0.9, "exact_match": false},
    {"phrase": "let me help", "weight": 0.9, "exact_match": false},
    {"phrase": "happy to assist", "weight": 0.8, "exact_match": false},
    {"phrase": "I apologize", "weight": 0.7, "exact_match": false},
    {"phrase": "sorry to hear", "weight": 0.8, "exact_match": false},
    {"phrase": "how can I help", "weight": 0.9, "exact_match": false},
    {"phrase": "is there anything else", "weight": 0.7, "exact_match": false},
    {"phrase": "I hear you", "weight": 0.8, "exact_match": false},
    {"phrase": "that must be frustrating", "weight": 1.0, "exact_match": false},
    {"phrase": "I completely understand", "weight": 1.0, "exact_match": false},
    {"phrase": "absolutely", "weight": 0.5, "exact_match": true},
    {"phrase": "certainly", "weight": 0.5, "exact_match": true}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Escalation Triggers Library
-- ============================================
INSERT INTO keyword_libraries (name, description, category, keywords, is_active)
VALUES (
  'Escalation Triggers',
  'Keywords that indicate potential escalation or supervisor request',
  'escalation',
  '[
    {"phrase": "supervisor", "weight": 1.0, "exact_match": false},
    {"phrase": "manager", "weight": 1.0, "exact_match": false},
    {"phrase": "speak to someone else", "weight": 0.9, "exact_match": false},
    {"phrase": "complaint", "weight": 0.8, "exact_match": false},
    {"phrase": "attorney", "weight": 1.0, "exact_match": false},
    {"phrase": "lawyer", "weight": 1.0, "exact_match": false},
    {"phrase": "sue", "weight": 0.9, "exact_match": true},
    {"phrase": "report you", "weight": 0.9, "exact_match": false},
    {"phrase": "bbb", "weight": 0.8, "exact_match": true},
    {"phrase": "better business bureau", "weight": 0.8, "exact_match": false},
    {"phrase": "cfpb", "weight": 1.0, "exact_match": true},
    {"phrase": "consumer financial", "weight": 0.9, "exact_match": false},
    {"phrase": "harassment", "weight": 1.0, "exact_match": false},
    {"phrase": "stop calling", "weight": 0.8, "exact_match": false},
    {"phrase": "cease and desist", "weight": 1.0, "exact_match": false},
    {"phrase": "recording this call", "weight": 0.7, "exact_match": false}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Sales Keywords Library
-- ============================================
INSERT INTO keyword_libraries (name, description, category, keywords, is_active)
VALUES (
  'Sales & Closing',
  'Keywords related to successful sales and payment commitments',
  'sales',
  '[
    {"phrase": "pay today", "weight": 1.0, "exact_match": false},
    {"phrase": "settle", "weight": 0.8, "exact_match": false},
    {"phrase": "payment plan", "weight": 0.9, "exact_match": false},
    {"phrase": "credit card", "weight": 0.7, "exact_match": false},
    {"phrase": "debit card", "weight": 0.7, "exact_match": false},
    {"phrase": "checking account", "weight": 0.7, "exact_match": false},
    {"phrase": "authorize", "weight": 0.8, "exact_match": false},
    {"phrase": "confirm payment", "weight": 0.9, "exact_match": false},
    {"phrase": "schedule payment", "weight": 0.8, "exact_match": false},
    {"phrase": "discount", "weight": 0.6, "exact_match": false},
    {"phrase": "special offer", "weight": 0.7, "exact_match": false},
    {"phrase": "one-time", "weight": 0.6, "exact_match": false},
    {"phrase": "resolve this today", "weight": 1.0, "exact_match": false}
  ]'::jsonb,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Default Script Templates
-- ============================================

-- Opening Script
INSERT INTO script_templates (name, description, category, script_content, required_phrases, min_adherence_score, is_active)
VALUES (
  'Standard Opening',
  'Required opening script for all outbound collection calls',
  'opening',
  'Hello, my name is [Agent Name] calling from [Company Name]. This is an attempt to collect a debt and any information obtained will be used for that purpose. This call may be recorded for quality assurance. Am I speaking with [Customer Name]?',
  '[
    {"phrase": "this is an attempt to collect a debt", "required": true, "order": 1},
    {"phrase": "any information obtained will be used for that purpose", "required": true, "order": 2},
    {"phrase": "this call may be recorded", "required": false, "order": 3},
    {"phrase": "am I speaking with", "required": true, "order": 4}
  ]'::jsonb,
  80,
  true
)
ON CONFLICT DO NOTHING;

-- Verification Script
INSERT INTO script_templates (name, description, category, script_content, required_phrases, min_adherence_score, is_active)
VALUES (
  'Identity Verification',
  'Required verification before discussing account details',
  'verification',
  'For security purposes, I need to verify some information. Can you please confirm your date of birth and the last four digits of your social security number? I also need to verify your current mailing address.',
  '[
    {"phrase": "verify", "required": true, "order": 1},
    {"phrase": "date of birth", "required": true, "order": 2},
    {"phrase": "social security", "required": false, "order": 3},
    {"phrase": "mailing address", "required": false, "order": 4}
  ]'::jsonb,
  70,
  true
)
ON CONFLICT DO NOTHING;

-- Closing Script
INSERT INTO script_templates (name, description, category, script_content, required_phrases, min_adherence_score, is_active)
VALUES (
  'Standard Closing',
  'Professional call closing script',
  'closing',
  'Thank you for your time today. Just to confirm, [summarize agreement/next steps]. Is there anything else I can help you with? Thank you for speaking with me, have a great day.',
  '[
    {"phrase": "thank you", "required": true, "order": 1},
    {"phrase": "confirm", "required": false, "order": 2},
    {"phrase": "anything else", "required": false, "order": 3},
    {"phrase": "have a great day", "required": false, "order": 4}
  ]'::jsonb,
  60,
  true
)
ON CONFLICT DO NOTHING;

-- Payment Negotiation Script
INSERT INTO script_templates (name, description, category, script_content, required_phrases, min_adherence_score, is_active)
VALUES (
  'Payment Negotiation',
  'Script for discussing payment options and arrangements',
  'negotiation',
  'I understand your situation. Let me see what options we have available. We can offer [payment options]. Would you like to take advantage of this opportunity to resolve your account today? I can process the payment right now if you have your payment information available.',
  '[
    {"phrase": "I understand", "required": true, "order": 1},
    {"phrase": "options", "required": true, "order": 2},
    {"phrase": "resolve", "required": false, "order": 3},
    {"phrase": "payment information", "required": false, "order": 4}
  ]'::jsonb,
  65,
  true
)
ON CONFLICT DO NOTHING;

-- Objection Handling Script
INSERT INTO script_templates (name, description, category, script_content, required_phrases, min_adherence_score, is_active)
VALUES (
  'Objection Handling',
  'Responses to common customer objections',
  'objection_handling',
  'I completely understand your concern. Many of our customers have felt the same way. What I can tell you is [address objection]. Would it help if we [offer solution]?',
  '[
    {"phrase": "I understand", "required": true, "order": 1},
    {"phrase": "concern", "required": false, "order": 2},
    {"phrase": "help", "required": true, "order": 3}
  ]'::jsonb,
  60,
  true
)
ON CONFLICT DO NOTHING;
