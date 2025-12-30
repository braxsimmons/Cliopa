/**
 * LM Studio Local LLM Client (Production Ready)
 * ----------------------------------------------
 * Uses LM Studio as a local AI provider for real-time call audits.
 * - No API cost.
 * - Private.
 * - Fast.
 * - Auto-detects available model.
 * - OpenAI-compatible response format.
 */

export interface LMStudioConfig {
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AuditCriterion {
  id: string;
  result: "PASS" | "PARTIAL" | "FAIL";
  explanation: string;
  recommendation: string;
}

export interface AuditResult {
  overall_score: number;
  summary: string;
  criteria: AuditCriterion[];
  communication_score?: number;
  compliance_score?: number;
  accuracy_score?: number;
  tone_score?: number;
  empathy_score?: number;
  resolution_score?: number;
}

/** DEFAULT CONFIG — UPDATED MODEL NAME */
const DEFAULT_CONFIG: LMStudioConfig = {
  baseURL: "/lm-studio/v1", // Use Vite proxy to avoid CORS issues
  model: "qwen/qwen3-vl-4b", // 👈 Replace this if you load another model
  temperature: 0.7,
  maxTokens: 4000,
};

export class LMStudioClient {
  private config: LMStudioConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<LMStudioConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Don't auto-init on construction - wait until actually needed
  }

  /** 🔍 Check if LM Studio is available */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/models`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "cors",
      });

      // Also check that we got JSON, not HTML
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.warn("LM Studio returned non-JSON response");
        return false;
      }

      return response.ok;
    } catch (err) {
      // CORS errors or network failures
      console.warn("LM Studio not available:", err);
      return false;
    }
  }

  /** 🧠 Get loaded models inside LM Studio */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseURL}/models`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return [];
      }

      // Guard against HTML responses (happens when LM Studio isn't running)
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        console.warn("LM Studio models endpoint returned non-JSON");
        return [];
      }

      const data = await response.json();
      return data?.data?.map((m: any) => m.id) || [];
    } catch (err) {
      // Silently fail - LM Studio is optional
      return [];
    }
  }

  /** 🚀 Auto-detect best model (called lazily) */
  private async autoInitModel() {
    if (this.initialized) return;
    this.initialized = true;

    const models = await this.getAvailableModels();
    if (models.length && !models.includes(this.config.model)) {
      this.config.model = models[0];
      console.log(`LM Studio model auto-set to: ${this.config.model}`);
    }
  }

  /** 🧪 MAIN PROCESSING FUNCTION */
  async processAudit(
    transcript: string,
    auditTemplate?: any
  ): Promise<AuditResult | null> {
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new Error("LM Studio API is not available. Start it on port 1234.");
    }

    // Lazy init model detection only when actually processing
    await this.autoInitModel();

    const criteria = auditTemplate || (await this.loadAuditTemplate());
    const prompt = this.buildAuditPrompt(transcript, criteria);

    try {
      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content:
                "You are an expert call quality auditor. Analyze transcripts and return only valid JSON.",
            },
            { role: "user", content: prompt },
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: "json_object" }, // 👈 MAGIC FOR LM STUDIO
        }),
      });

      if (!response.ok) throw new Error(`LM Studio request failed: ${response.status}`);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from LM Studio");

      return this.parseAuditResponse(content);
    } catch (err) {
      console.error("Audit processing failed:", err);
      throw err;
    }
  }

  /** 🧱 Prompt Builder */
  private buildAuditPrompt(transcript: string, criteria: any[]): string {
    const criteriaList = criteria
      .map((c) => `- ${c.id}: ${c.name} — ${c.description}`)
      .join("\n");

    return `
AUDIT THIS CALL TRANSCRIPT USING THE FOLLOWING CRITERIA:

CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript}

RETURN STRICT JSON ONLY:
{
  "overall_score": number,
  "summary": string,
  "criteria": [
    { "id": string, "result": "PASS" | "PARTIAL" | "FAIL", "explanation": string, "recommendation": string }
  ]
}
    `.trim();
  }

  /** 🧠 JSON Safe Parsing */
  private parseAuditResponse(content: string): AuditResult {
    try {
      const cleaned = content.replace(/```json|```/g, "").trim(); // Remove code blocks
      const parsed = JSON.parse(cleaned);

      return {
        ...parsed,
        ...this.calculateDimensionalScores(parsed.criteria),
      };
    } catch (err) {
      console.error("Audit parse failed:", err);
      throw new Error("Audit returned invalid JSON");
    }
  }

  /** 📊 Score Aggregation */
  private calculateDimensionalScores(criteria: AuditCriterion[]) {
    const mapGroup = (ids: string[]) =>
      criteria
        .filter((c) => ids.includes(c.id))
        .reduce((acc, c) => acc + (c.result === "PASS" ? 100 : c.result === "PARTIAL" ? 50 : 0), 0) /
      Math.max(criteria.length, 1);

    return {
      communication_score: mapGroup(["WHY_SMILE", "WHAT_LISTEN_EXPLORE"]),
      compliance_score: mapGroup(["QQ", "VCI", "PERMISSION"]),
      accuracy_score: mapGroup(["NOTES", "CAMPAIGN"]),
      tone_score: mapGroup(["WHY_SMILE"]),
      empathy_score: mapGroup(["WHAT_EMPATHY"]),
      resolution_score: mapGroup(["FOLLOWUP", "WHERE_RESOLUTION"]),
    };
  }

  /** 📂 Load Template from Public Folder */
  private async loadAuditTemplate(): Promise<any[]> {
    try {
      const res = await fetch("/audit_template.json");
      if (!res.ok) throw new Error("Template not found");
      return await res.json();
    } catch {
      return this.getDefaultCriteria();
    }
  }

  /** 🛟 Default Criteria */
  private getDefaultCriteria(): AuditCriterion[] {
    return [
      { id: "QQ", description: "Verify qualifying questions", name: "Qualifying Questions", explanation: "", recommendation: "" },
      { id: "WHY_SMILE", description: "Tone & customer rapport", name: "Positive Tone", explanation: "", recommendation: "" },
      { id: "WHAT_EMPATHY", description: "Show empathy", name: "Empathy", explanation: "", recommendation: "" },
      { id: "WHERE_RESOLUTION", description: "Fair outcome for customer", name: "Resolution", explanation: "", recommendation: "" },
    ];
  }
}

// 🚀 EXPORT INSTANCE FOR USE ANYWHERE
export const lmStudioClient = new LMStudioClient();
