
import { GoogleGenAI, Type } from "@google/genai";
import { CallMetrics } from "./types";

export const analyzePerformance = async (metrics: CallMetrics[], phleboName: string) => {
  // Always use a new instance to ensure it always uses the most up-to-date API key from the environment
  // and follow coding guidelines for direct process.env.API_KEY usage.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const summary = metrics.reduce((acc, curr) => ({
    totalTat: acc.totalTat + curr.totalTat,
    withinTat: acc.withinTat + (curr.totalTat <= 30 ? 1 : 0),
  }), { totalTat: 0, withinTat: 0 });

  const avgTat = metrics.length > 0 ? summary.totalTat / metrics.length : 0;
  const achievementRate = metrics.length > 0 ? (summary.withinTat / metrics.length) * 100 : 0;

  const prompt = `Analyze performance for ${phleboName}: Avg TAT ${avgTat.toFixed(1)}m, ${achievementRate.toFixed(1)}% within threshold. Grade A/B/C and provide short feedback.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING },
            feedback: { type: Type.STRING }
          },
          required: ["grade", "feedback"]
        }
      }
    });

    // Directly access .text property from GenerateContentResponse as per guidelines
    const text = response.text;
    return text ? JSON.parse(text) : { grade: "N/A", feedback: "Analysis returned no content." };
  } catch (error) {
    console.error("Gemini performance analysis failed:", error);
    return { grade: "N/A", feedback: "Unable to analyze performance at this time." };
  }
};
