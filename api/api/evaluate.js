export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { essay, taskType, targetBand } = req.body;
  if (!essay || essay.trim().split(/\s+/).length < 50)
    return res.status(400).json({ error: 'Essay must be at least 50 words.' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 3000,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a highly experienced IELTS examiner. Evaluate essays strictly based on the four official IELTS Writing criteria. Respond ONLY with valid JSON — no markdown, no backticks, no explanation outside the JSON.'
          },
          {
            role: 'user',
            content: `Evaluate this IELTS Writing ${taskType} essay. The student is targeting Band ${targetBand}.\n\nEssay:\n"""\n${essay}\n"""\n\nReturn ONLY this JSON (no markdown, no code blocks, just raw JSON):\n{\n  "overall_band": 6.5,\n  "task_response": 6.0,\n  "coherence_cohesion": 6.5,\n  "lexical_resource": 7.0,\n  "grammatical_accuracy": 6.0,\n  "word_count": 280,\n  "strengths": "What the candidate did well (2-3 sentences)",\n  "weaknesses": "Main areas that reduced the score (2-3 sentences)",\n  "suggestions": "Specific actionable tips to improve (numbered list as string, e.g. 1. ... 2. ... 3. ...)",\n  "errors": [\n    {\n      "original": "exact phrase from essay",\n      "correction": "corrected version",\n      "type": "grammar",\n      "explanation": "Why this is wrong",\n      "severity": "minor"\n    }\n  ],\n  "improved_essay": "Complete improved version of the essay targeting Band ${targetBand}"\n}`
          }
        ]
      })
    });

    if (!response.ok) {
      const e = await response.json();
      return res.status(500).json({ error: e.error?.message || 'OpenAI API error' });
    }

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return res.status(200).json(JSON.parse(content));
    } catch {
      return res.status(500).json({ error: 'Could not parse AI response. Please try again.' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
