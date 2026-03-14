/**
 * POST /api/george-reward-refine
 * Body: { sessionVibe, rewardStrength, georgeContext, visibleStance, baseTitle, baseBody, baseRiskLine, sessionNote }
 * Returns: { title, body, risk_line, notion_prompt }
 * Refines a handcrafted George Reward Engine result so it echoes the session note.
 * Requires: OPENAI_API_KEY
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function extractJson(content) {
  if (!content || typeof content !== 'string') return null;
  const trimmed = content.trim();
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (_) {
    return null;
  }
}

const SYSTEM_PROMPT = `You refine a post-session D&D reward result for a character named George in Waterdeep. The result was chosen from a handcrafted pool; you only personalize it using the player's short session note.

Rules:
- Keep the same stance and overall meaning. Do not change the type of reward (something found, an opportunity, or a story hook).
- Do not escalate power level. Prefer rumors, leads, guarded access, favors, complications, debts, clergy, guilds, nobles, witnesses, merchants, small meaningful finds. No epic rewards or generic fantasy filler.
- Add one or two specific details that connect to the session note (place, person, event, or consequence from the note). Keep the tone grounded and slightly dramatic, Waterdeep-friendly.
- Output valid JSON only, no markdown or explanation. Keys: "title", "body", "risk_line", "notion_prompt".
- title: Short, evocative title (similar length to the base).
- body: 2–4 sentences. Combine the main description and the "why it fits" idea into one flowing paragraph.
- risk_line: One sentence for cost, risk, or complication—or empty string if none.
- notion_prompt: One short question or writing seed for the player to use in Notion (e.g. "What did George do with the writ?" or "Who else might have noticed the funeral?").`;

export async function onRequestPost(context) {
  const { env, request } = context;
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY not configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const sessionVibe = typeof body.sessionVibe === 'string' ? body.sessionVibe.trim() : '';
  const rewardStrength = typeof body.rewardStrength === 'string' ? body.rewardStrength.trim() : '';
  const georgeContext = typeof body.georgeContext === 'string' ? body.georgeContext.trim() : '';
  const visibleStance = typeof body.visibleStance === 'string' ? body.visibleStance.trim() : '';
  const baseTitle = typeof body.baseTitle === 'string' ? body.baseTitle.trim() : '';
  const baseBody = typeof body.baseBody === 'string' ? body.baseBody.trim() : '';
  const baseRiskLine = typeof body.baseRiskLine === 'string' ? body.baseRiskLine.trim() : '';
  const sessionNote = typeof body.sessionNote === 'string' ? body.sessionNote.trim() : '';

  if (!baseTitle || !baseBody) {
    return jsonResponse({ error: 'baseTitle and baseBody are required' }, 400);
  }

  const userPrompt = [
    'Session vibe: ' + (sessionVibe || 'not specified'),
    'Reward strength: ' + (rewardStrength || 'not specified'),
    "George's situation: " + (georgeContext || 'not specified'),
    'Stance (do not change): ' + (visibleStance || 'not specified'),
    '',
    'Base result:',
    'Title: ' + baseTitle,
    'Body: ' + baseBody,
    baseRiskLine ? 'Risk/cost: ' + baseRiskLine : '',
    '',
    "Player's session note (use this to add one or two specific, grounded details):",
    sessionNote || '(none — still add a little variety in wording while keeping the same meaning.)',
  ].filter(Boolean).join('\n');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  let res;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });
  } catch (e) {
    return jsonResponse({ error: 'Request failed', details: String(e.message) }, 502);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error;
    const msg = (err && (typeof err === 'string' ? err : err.message)) || data.message || res.statusText || 'Request failed';
    return jsonResponse({ error: msg }, res.status >= 500 ? 502 : 400);
  }

  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    return jsonResponse({ error: 'No content in model response' }, 502);
  }

  const parsed = extractJson(content);
  if (!parsed || typeof parsed.title !== 'string' || typeof parsed.body !== 'string') {
    return jsonResponse({ error: 'Invalid JSON from model', raw: content.slice(0, 200) }, 502);
  }

  return jsonResponse({
    title: String(parsed.title),
    body: String(parsed.body),
    risk_line: typeof parsed.risk_line === 'string' ? parsed.risk_line : '',
    notion_prompt: typeof parsed.notion_prompt === 'string' ? parsed.notion_prompt : '',
  });
}
