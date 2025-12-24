import nlp from 'compromise';

export class Intent {
  static isConversational(text: string): boolean {
    const score = this.getConversationalScore(text);
    return score >= 0.7;
  }

  static getConversationalScore(text: string): number {
    const clean = text.trim();
    if (!clean) return 1.0;

    if (clean.length <= 3 && !/[\d]/.test(clean)) {
      return 0.9;
    }

    const doc = nlp(clean);
    
    const hasVerbs = doc.verbs().length > 0;
    const hasNouns = doc.nouns().length > 0;
    const hasQuestions = clean.includes('?') || doc.questions().length > 0;
    const isGreeting = doc.match('#Greeting').length > 0;
    const isExpression = doc.match('#Expression').length > 0;

    const isIndoGreeting = /^(halo|hai|oi|woi|p|tes|test|pagi|siang|sore|malam|assalamualaikum|kabar)/i.test(clean);

    let score = 0;

    if (isGreeting || isExpression || isIndoGreeting) score += 0.7;

    if (!hasVerbs && !hasNouns) score += 0.4;

    const wordCount = clean.split(/\s+/).length;
    if (wordCount <= 3) score += 0.3;
    if (wordCount <= 5) score += 0.1;

    const isSocialQuestion = doc.match('(how|apa|gimana) (are|is|kabar|keadaan)').length > 0;
    if (hasQuestions && !isSocialQuestion) score -= 0.5;

    if (doc.verbs().length >= 3 || doc.nouns().length >= 4) score -= 0.6;

    const actionablePatterns = [
      /http[s]?:\/\//,
      /\{.*\}/,
      /\d+[\+\-\*\/]\d+/,
      /(cari|search|find|analyze|hitung|calculate|buat|create|tolong|help)/i
    ];
    
    if (actionablePatterns.some(p => p.test(clean))) {
      score -= 0.7;
    }

    return Math.max(0, Math.min(1, score));
  }
}
