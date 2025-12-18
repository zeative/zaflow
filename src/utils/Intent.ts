import nlp from 'compromise';

/**
 * 🧠 DYNAMIC INTENT DETECTION ENGINE
 *
 * Uses NLP to distinguish between simple conversation and actionable tasks.
 * Works across multiple languages by analyzing sentence structure and semantics.
 */
export class Intent {
  /**
   * Detect if a message is purely conversational (greetings, social, etc.)
   * Returns true only if it's HIGHLY likely to be just a greeting.
   */
  static isConversational(text: string): boolean {
    const score = this.getConversationalScore(text);
    return score >= 0.7;
  }

  /**
   * Calculate a conversational score (0-1)
   * 1.0 = Definitely just a greeting/social
   * 0.0 = Definitely a complex task
   */
  static getConversationalScore(text: string): number {
    const clean = text.trim();
    if (!clean) return 1.0;

    // 1. Check for ultra-short messages (e.g., "p", "hi", "hey")
    if (clean.length <= 3 && !/[\d]/.test(clean)) {
      return 0.9;
    }

    const doc = nlp(clean);
    
    // 2. NLP Analysis
    const hasVerbs = doc.verbs().length > 0;
    const hasNouns = doc.nouns().length > 0;
    const hasQuestions = clean.includes('?') || doc.questions().length > 0;
    const isGreeting = doc.match('#Greeting').length > 0;
    const isExpression = doc.match('#Expression').length > 0;

    // Indonesian specific (dynamic check)
    const isIndoGreeting = /^(halo|hai|oi|woi|p|tes|test|pagi|siang|sore|malam|assalamualaikum|kabar)/i.test(clean);

    // 3. Scoring Logic
    let score = 0;

    // If it's a known greeting/expression, start high
    if (isGreeting || isExpression || isIndoGreeting) score += 0.7;

    // If it has NO verbs and NO nouns, it's likely just social/noise
    if (!hasVerbs && !hasNouns) score += 0.4;

    // If it's very short, increase score
    const wordCount = clean.split(/\s+/).length;
    if (wordCount <= 3) score += 0.3;
    if (wordCount <= 5) score += 0.1;

    // ⛔ PENALTIES (Things that indicate a task)
    
    // If it has a question, it's likely a task/query
    // BUT simple "how are you?" style questions are okay
    const isSocialQuestion = doc.match('(how|apa|gimana) (are|is|kabar|keadaan)').length > 0;
    if (hasQuestions && !isSocialQuestion) score -= 0.5;

    // If it has many verbs/nouns, it's likely a description of a task
    if (doc.verbs().length >= 3 || doc.nouns().length >= 4) score -= 0.6;

    // If it contains specific actionable keywords (universal)
    const actionablePatterns = [
      /http[s]?:\/\//, // URLs
      /\{.*\}/,        // JSON-like
      /\d+[\+\-\*\/]\d+/, // Math
      /(cari|search|find|analyze|hitung|calculate|buat|create|tolong|help)/i
    ];
    
    if (actionablePatterns.some(p => p.test(clean))) {
      score -= 0.7;
    }

    // Clamp score between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
}
