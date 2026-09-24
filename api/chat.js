import { GoogleGenAI } from '@google/genai';

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel in Settings.'
    });
  }

  try {
    const { messages, model = 'gemini-3.5-flash', contextData } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'A messages array is required.' });
    }

    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Failed to initialize Gemini client on the server.'
      });
    }

    // Format messages for @google/genai contents
    const contents = messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || m.text || '') }]
    }));

    // System instruction for the assistant's role
    let systemInstruction = `You are a specialized Singapore HDB Housing & Property Advisory Assistant embedded in the Singapore HDB Resale Explorer application.
You possess deep expertise in Singapore Housing & Development Board (HDB) estates, past resale transactions, price evaluation, estate types (mature vs non-mature), flat models (Standard, Improved, Model A, DBSS, Maisonette, Executive), CPF Housing Grants (Enhanced CPF Housing Grant, Family Grant, Proximity Housing Grant), Minimum Occupation Period (MOP), and financing guidelines.

Key guidelines:
1. Provide structured, practical, and friendly answers using Markdown formatting (bold key figures, bullet points).
2. Remind users that prices shown in this application are past registered resale transactions from data.gov.sg, not current real-time property listings or valuations.
3. If asked about specific estates or price trends, offer concise, well-reasoned context.
4. For grant eligibility or loan calculations, remind users that definitive approval is determined by HDB through the HDB Flat Portal.`;

    if (contextData) {
      systemInstruction += `\n\nCurrent user explorer context:\n${
        typeof contextData === 'string' ? contextData : JSON.stringify(contextData)
      }`;
    }

    // Select model according to prompt specifications:
    // gemini-3.1-pro-preview for complex tasks, gemini-3.5-flash for general tasks, and gemini-3.1-flash-lite for fast tasks
    const validModels = [
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-3.8-flash'
    ];
    const selectedModel = validModels.includes(model) ? model : 'gemini-3.5-flash';

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    const replyText = response.text || '';

    return res.status(200).json({
      role: 'model',
      content: replyText,
      model: selectedModel
    });
  } catch (error) {
    console.error('Gemini API Error:', error?.message || error);
    return res.status(500).json({
      error: error?.message || 'Failed to process request with Gemini.'
    });
  }
}
