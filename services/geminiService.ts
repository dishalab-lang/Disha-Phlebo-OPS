
import { GoogleGenAI, Type } from "@google/genai";
import { CallMetrics } from "../types";

export const analyzePerformance = async (metrics: CallMetrics[], phleboName: string) => {
  // Initialize GoogleGenAI inside the function to use the most up-to-date API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const summary = metrics.reduce((acc, curr) => ({
    totalTat: acc.totalTat + curr.totalTat,
    totalDist: acc.totalDist + curr.distance,
    withinTat: acc.withinTat + (curr.totalTat <= 30 ? 1 : 0),
  }), { totalTat: 0, totalDist: 0, withinTat: 0 });

  const avgTat = summary.totalTat / metrics.length;
  const tatAchievementRate = (summary.withinTat / metrics.length) * 100;

  const prompt = `
    Analyze the performance of Phlebotomist ${phleboName} based on the following monthly stats:
    - Total Calls: ${metrics.length}
    - Average TAT: ${(Number(avgTat) || 0).toFixed(2)} minutes
    - TAT Achievement Rate: ${(Number(tatAchievementRate) || 0).toFixed(2)}%
    - Standard TAT Threshold: 30 minutes
    
    Assign a Grade (A, B, or C) and provide a short constructive feedback paragraph.
    A: >90% TAT achievement.
    B: 75-90% TAT achievement.
    C: <75% TAT achievement.
  `;

  try {
    // Upgraded model to gemini-3-pro-preview for complex reasoning/analysis task
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grade: { type: Type.STRING, description: "A, B, or C" },
            feedback: { type: Type.STRING, description: "Performance analysis text" },
            summaryMetrics: {
              type: Type.OBJECT,
              properties: {
                avgTat: { type: Type.NUMBER },
                achievementRate: { type: Type.NUMBER }
              }
            }
          },
          required: ["grade", "feedback"]
        }
      }
    });

    // Directly access .text property from GenerateContentResponse
    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { grade: "N/A", feedback: "Unable to analyze at this time." };
  }
};
