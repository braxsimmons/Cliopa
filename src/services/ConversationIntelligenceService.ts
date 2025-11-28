import { supabase } from '@/integrations/supabase/client';

// ============================================
// Type Definitions
// ============================================

export interface KeywordEntry {
  phrase: string;
  weight: number;
  exact_match: boolean;
}

export interface KeywordLibrary {
  id: string;
  name: string;
  description?: string;
  category: 'compliance' | 'prohibited' | 'sales' | 'empathy' | 'escalation' | 'closing' | 'greeting' | 'custom';
  keywords: KeywordEntry[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptPhrase {
  phrase: string;
  required: boolean;
  order: number;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'opening' | 'verification' | 'negotiation' | 'objection_handling' | 'closing' | 'compliance' | 'full_call';
  script_content: string;
  required_phrases: ScriptPhrase[];
  min_adherence_score: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SentimentPoint {
  timestamp: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number;
  text: string;
}

export interface KeywordMatch {
  phrase: string;
  category: string;
  library?: string;
  count: number;
  timestamps?: number[];
  weight: number;
}

export interface CallAnalytics {
  id: string;
  call_id?: string;
  user_id: string;

  // Timing
  call_duration_seconds?: number;
  agent_talk_time_seconds?: number;
  customer_talk_time_seconds?: number;
  silence_time_seconds?: number;
  talk_to_listen_ratio?: number;

  // Sentiment
  overall_sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentiment_score?: number;
  sentiment_timeline: SentimentPoint[];

  // Keywords
  keywords_found: KeywordMatch[];
  compliance_keywords_found: number;
  prohibited_keywords_found: number;
  empathy_keywords_found: number;
  escalation_triggers_found: number;

  // Script Adherence
  script_template_id?: string;
  script_adherence_score?: number;
  script_phrases_matched: string[];
  script_phrases_missed: string[];

  // Classification
  call_outcome?: 'payment_collected' | 'payment_arrangement' | 'callback_scheduled' | 'dispute' | 'wrong_party' | 'refused_to_pay' | 'disconnected' | 'voicemail' | 'no_contact' | 'other';
  call_topics: string[];
  customer_intent?: string;

  // Quality
  dead_air_count: number;
  interruption_count: number;
  hold_time_seconds: number;
  transfer_count: number;

  // AI
  ai_summary?: string;
  ai_recommendations: string[];
  ai_model?: string;
  processing_time_ms?: number;

  created_at: string;
  updated_at: string;

  // Joined
  agent?: { first_name: string; last_name: string; email: string; team?: string };
  script_template?: { name: string; category: string };
}

export interface ConversationInsight {
  agent_id: string;
  first_name: string;
  last_name: string;
  email: string;
  team?: string;
  total_calls_30d: number;
  avg_call_duration_mins: number;
  avg_talk_listen_ratio: number;
  avg_sentiment_score: number;
  avg_script_adherence: number;
  positive_calls: number;
  neutral_calls: number;
  negative_calls: number;
  total_compliance_keywords: number;
  total_prohibited_keywords: number;
  total_empathy_keywords: number;
  total_escalation_triggers: number;
  payments_collected: number;
  arrangements_made: number;
  avg_dead_air: number;
  avg_interruptions: number;
}

export interface TeamConversationInsight {
  team: string;
  agent_count: number;
  total_calls_30d: number;
  avg_sentiment: number;
  avg_script_adherence: number;
  avg_talk_listen_ratio: number;
  total_violations: number;
  successful_outcomes: number;
}

export interface TranscriptAnalysisResult {
  keywords: KeywordMatch[];
  compliance_count: number;
  prohibited_count: number;
  empathy_count: number;
  escalation_count: number;
  total_score: number;
}

// ============================================
// Conversation Intelligence Service
// ============================================

export const ConversationIntelligenceService = {
  // ============================================
  // Keyword Libraries
  // ============================================

  async getKeywordLibraries(activeOnly = true): Promise<KeywordLibrary[]> {
    try {
      let query = supabase
        .from('keyword_libraries' as any)
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching keyword libraries:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Error in getKeywordLibraries:', err);
      return [];
    }
  },

  async getKeywordLibrary(id: string): Promise<KeywordLibrary | null> {
    const { data, error } = await supabase
      .from('keyword_libraries' as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') return null;
    return data;
  },

  async createKeywordLibrary(library: Partial<KeywordLibrary>): Promise<KeywordLibrary> {
    const { data, error } = await supabase
      .from('keyword_libraries' as any)
      .insert(library)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateKeywordLibrary(id: string, updates: Partial<KeywordLibrary>): Promise<KeywordLibrary> {
    const { data, error } = await supabase
      .from('keyword_libraries' as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteKeywordLibrary(id: string): Promise<void> {
    const { error } = await supabase
      .from('keyword_libraries' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async addKeywordToLibrary(libraryId: string, keyword: KeywordEntry): Promise<KeywordLibrary> {
    const library = await this.getKeywordLibrary(libraryId);
    if (!library) throw new Error('Library not found');

    const keywords = [...library.keywords, keyword];
    return this.updateKeywordLibrary(libraryId, { keywords });
  },

  async removeKeywordFromLibrary(libraryId: string, phrase: string): Promise<KeywordLibrary> {
    const library = await this.getKeywordLibrary(libraryId);
    if (!library) throw new Error('Library not found');

    const keywords = library.keywords.filter(k => k.phrase !== phrase);
    return this.updateKeywordLibrary(libraryId, { keywords });
  },

  // ============================================
  // Script Templates
  // ============================================

  async getScriptTemplates(activeOnly = true): Promise<ScriptTemplate[]> {
    let query = supabase
      .from('script_templates' as any)
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getScriptTemplate(id: string): Promise<ScriptTemplate | null> {
    const { data, error } = await supabase
      .from('script_templates' as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createScriptTemplate(template: Partial<ScriptTemplate>): Promise<ScriptTemplate> {
    const { data, error } = await supabase
      .from('script_templates' as any)
      .insert(template)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateScriptTemplate(id: string, updates: Partial<ScriptTemplate>): Promise<ScriptTemplate> {
    const { data, error } = await supabase
      .from('script_templates' as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteScriptTemplate(id: string): Promise<void> {
    const { error } = await supabase
      .from('script_templates' as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ============================================
  // Call Analytics
  // ============================================

  async getCallAnalytics(filters?: {
    userId?: string;
    callId?: string;
    startDate?: string;
    endDate?: string;
    sentiment?: string;
    outcome?: string;
    limit?: number;
  }): Promise<CallAnalytics[]> {
    console.log('getCallAnalytics called with filters:', filters);
    try {
      // First try a simple select to verify table exists
      let query = supabase
        .from('call_analytics' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.callId) {
        query = query.eq('call_id', filters.callId);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.sentiment) {
        query = query.eq('overall_sentiment', filters.sentiment);
      }
      if (filters?.outcome) {
        query = query.eq('call_outcome', filters.outcome);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      console.log('getCallAnalytics result:', { data: data?.length || 0, error });
      if (error) {
        console.error('Error fetching call analytics:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Error in getCallAnalytics:', err);
      return [];
    }
  },

  async getCallAnalyticsById(id: string): Promise<CallAnalytics | null> {
    const { data, error } = await supabase
      .from('call_analytics' as any)
      .select(`
        *,
        agent:user_id (first_name, last_name, email, team),
        script_template:script_template_id (name, category)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createCallAnalytics(analytics: Partial<CallAnalytics>): Promise<CallAnalytics> {
    const { data, error } = await supabase
      .from('call_analytics' as any)
      .insert(analytics)
      .select(`
        *,
        agent:user_id (first_name, last_name, email, team),
        script_template:script_template_id (name, category)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  async updateCallAnalytics(id: string, updates: Partial<CallAnalytics>): Promise<CallAnalytics> {
    const { data, error } = await supabase
      .from('call_analytics' as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        agent:user_id (first_name, last_name, email, team),
        script_template:script_template_id (name, category)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // ============================================
  // Conversation Insights (Aggregated Views)
  // ============================================

  async getConversationInsights(filters?: {
    team?: string;
    agentId?: string;
  }): Promise<ConversationInsight[]> {
    try {
      let query = supabase
        .from('conversation_insights' as any)
        .select('*')
        .order('avg_sentiment_score', { ascending: false, nullsFirst: false });

      if (filters?.team) {
        query = query.eq('team', filters.team);
      }
      if (filters?.agentId) {
        query = query.eq('agent_id', filters.agentId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching conversation insights:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Error in getConversationInsights:', err);
      return [];
    }
  },

  async getTeamConversationInsights(): Promise<TeamConversationInsight[]> {
    try {
      const { data, error } = await supabase
        .from('team_conversation_insights' as any)
        .select('*')
        .order('avg_sentiment', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching team insights:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('Error in getTeamConversationInsights:', err);
      return [];
    }
  },

  // ============================================
  // Transcript Analysis (Client-side helpers)
  // ============================================

  async analyzeTranscriptKeywords(transcript: string): Promise<TranscriptAnalysisResult> {
    // Use database function for analysis
    const { data, error } = await supabase.rpc('analyze_transcript_keywords', {
      p_transcript: transcript,
    });

    if (error) throw error;

    const keywords: KeywordMatch[] = data || [];

    // Calculate counts by category
    let compliance_count = 0;
    let prohibited_count = 0;
    let empathy_count = 0;
    let escalation_count = 0;
    let total_score = 0;

    keywords.forEach((k: KeywordMatch) => {
      const score = k.count * k.weight;
      total_score += score;

      switch (k.category) {
        case 'compliance':
          compliance_count += k.count;
          break;
        case 'prohibited':
          prohibited_count += k.count;
          break;
        case 'empathy':
          empathy_count += k.count;
          break;
        case 'escalation':
          escalation_count += k.count;
          break;
      }
    });

    return {
      keywords,
      compliance_count,
      prohibited_count,
      empathy_count,
      escalation_count,
      total_score,
    };
  },

  calculateScriptAdherence(
    transcript: string,
    template: ScriptTemplate
  ): {
    score: number;
    matched: string[];
    missed: string[];
  } {
    const lowerTranscript = transcript.toLowerCase();
    const matched: string[] = [];
    const missed: string[] = [];

    template.required_phrases.forEach((phrase) => {
      if (lowerTranscript.includes(phrase.phrase.toLowerCase())) {
        matched.push(phrase.phrase);
      } else if (phrase.required) {
        missed.push(phrase.phrase);
      }
    });

    const requiredPhrases = template.required_phrases.filter(p => p.required);
    const score = requiredPhrases.length > 0
      ? (matched.filter(m => requiredPhrases.some(r => r.phrase === m)).length / requiredPhrases.length) * 100
      : 100;

    return { score, matched, missed };
  },

  // Simple sentiment analysis (for quick client-side use)
  analyzeSentimentBasic(text: string): { sentiment: 'positive' | 'neutral' | 'negative'; score: number } {
    const positiveWords = ['thank', 'appreciate', 'great', 'wonderful', 'excellent', 'happy', 'pleased', 'helpful', 'understand', 'agree'];
    const negativeWords = ['angry', 'frustrated', 'upset', 'terrible', 'awful', 'hate', 'never', 'worst', 'complaint', 'lawyer', 'sue'];

    const lowerText = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });

    // Clamp score between -1 and 1
    score = Math.max(-1, Math.min(1, score));

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (score > 0.2) sentiment = 'positive';
    else if (score < -0.2) sentiment = 'negative';

    return { sentiment, score };
  },

  // Calculate talk-to-listen ratio from timing data
  calculateTalkListenRatio(
    agentTalkTime: number,
    customerTalkTime: number
  ): number {
    if (customerTalkTime === 0) return 0;
    return Number((agentTalkTime / customerTalkTime).toFixed(2));
  },

  // Process a full call for analytics
  async processCallForAnalytics(
    callId: string,
    userId: string,
    transcript: string,
    timingData?: {
      duration_seconds: number;
      agent_talk_seconds: number;
      customer_talk_seconds: number;
      silence_seconds: number;
    },
    scriptTemplateId?: string
  ): Promise<CallAnalytics> {
    const startTime = Date.now();

    // Analyze keywords
    const keywordAnalysis = await this.analyzeTranscriptKeywords(transcript);

    // Analyze sentiment
    const sentimentResult = this.analyzeSentimentBasic(transcript);

    // Calculate script adherence if template provided
    let scriptAdherence: { score: number; matched: string[]; missed: string[] } | null = null;
    if (scriptTemplateId) {
      const template = await this.getScriptTemplate(scriptTemplateId);
      if (template) {
        scriptAdherence = this.calculateScriptAdherence(transcript, template);
      }
    }

    // Calculate talk-to-listen ratio
    const talkListenRatio = timingData
      ? this.calculateTalkListenRatio(timingData.agent_talk_seconds, timingData.customer_talk_seconds)
      : undefined;

    const processingTime = Date.now() - startTime;

    // Create analytics record
    const analytics: Partial<CallAnalytics> = {
      call_id: callId,
      user_id: userId,
      call_duration_seconds: timingData?.duration_seconds,
      agent_talk_time_seconds: timingData?.agent_talk_seconds,
      customer_talk_time_seconds: timingData?.customer_talk_seconds,
      silence_time_seconds: timingData?.silence_seconds,
      talk_to_listen_ratio: talkListenRatio,
      overall_sentiment: sentimentResult.sentiment,
      sentiment_score: sentimentResult.score,
      keywords_found: keywordAnalysis.keywords,
      compliance_keywords_found: keywordAnalysis.compliance_count,
      prohibited_keywords_found: keywordAnalysis.prohibited_count,
      empathy_keywords_found: keywordAnalysis.empathy_count,
      escalation_triggers_found: keywordAnalysis.escalation_count,
      script_template_id: scriptTemplateId,
      script_adherence_score: scriptAdherence?.score,
      script_phrases_matched: scriptAdherence?.matched || [],
      script_phrases_missed: scriptAdherence?.missed || [],
      processing_time_ms: processingTime,
    };

    return this.createCallAnalytics(analytics);
  },

  // ============================================
  // Dashboard Aggregations
  // ============================================

  async getSentimentTrends(
    startDate: string,
    endDate: string,
    groupBy: 'day' | 'week' = 'day'
  ): Promise<{ date: string; positive: number; neutral: number; negative: number; avg_score: number }[]> {
    try {
      const { data, error } = await supabase
        .from('call_analytics' as any)
        .select('created_at, overall_sentiment, sentiment_score')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sentiment trends:', error);
        return [];
      }
      if (!data?.length) return [];

      // Group by date
      const grouped = new Map<string, { positive: number; neutral: number; negative: number; scores: number[] }>();

      data.forEach(record => {
        const date = groupBy === 'day'
          ? record.created_at.split('T')[0]
          : this.getWeekStart(record.created_at);

        if (!grouped.has(date)) {
          grouped.set(date, { positive: 0, neutral: 0, negative: 0, scores: [] });
        }

        const group = grouped.get(date)!;
        if (record.overall_sentiment === 'positive') group.positive++;
        else if (record.overall_sentiment === 'neutral') group.neutral++;
        else if (record.overall_sentiment === 'negative') group.negative++;

        if (record.sentiment_score != null) {
          group.scores.push(record.sentiment_score);
        }
      });

      return Array.from(grouped.entries()).map(([date, data]) => ({
        date,
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        avg_score: data.scores.length > 0
          ? Number((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2))
          : 0,
      }));
    } catch (err) {
      console.error('Error in getSentimentTrends:', err);
      return [];
    }
  },

  getWeekStart(dateStr: string): string {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    return date.toISOString().split('T')[0];
  },

  async getKeywordTrends(
    startDate: string,
    endDate: string
  ): Promise<{
    category: string;
    total: number;
    phrases: { phrase: string; count: number }[];
  }[]> {
    try {
      const { data, error } = await supabase
        .from('call_analytics' as any)
        .select('keywords_found')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        console.error('Error fetching keyword trends:', error);
        return [];
      }
      if (!data?.length) return [];

      // Aggregate keywords
      const categoryTotals = new Map<string, Map<string, number>>();

      data.forEach(record => {
        if (!record.keywords_found) return;

        (record.keywords_found as KeywordMatch[]).forEach(keyword => {
          if (!categoryTotals.has(keyword.category)) {
            categoryTotals.set(keyword.category, new Map());
          }
          const phrases = categoryTotals.get(keyword.category)!;
          phrases.set(keyword.phrase, (phrases.get(keyword.phrase) || 0) + keyword.count);
        });
      });

      return Array.from(categoryTotals.entries()).map(([category, phrases]) => ({
        category,
        total: Array.from(phrases.values()).reduce((a, b) => a + b, 0),
        phrases: Array.from(phrases.entries())
          .map(([phrase, count]) => ({ phrase, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      }));
    } catch (err) {
      console.error('Error in getKeywordTrends:', err);
      return [];
    }
  },

  async getCallOutcomesBreakdown(
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<{ outcome: string; count: number; percentage: number }[]> {
    try {
      let query = supabase
        .from('call_analytics' as any)
        .select('call_outcome')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('call_outcome', 'is', null);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching call outcomes:', error);
        return [];
      }
      if (!data?.length) return [];

      const counts = new Map<string, number>();
      data.forEach(record => {
        counts.set(record.call_outcome!, (counts.get(record.call_outcome!) || 0) + 1);
      });

      const total = data.length;
      return Array.from(counts.entries())
        .map(([outcome, count]) => ({
          outcome,
          count,
          percentage: Number(((count / total) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.count - a.count);
    } catch (err) {
      console.error('Error in getCallOutcomesBreakdown:', err);
      return [];
    }
  },
};
