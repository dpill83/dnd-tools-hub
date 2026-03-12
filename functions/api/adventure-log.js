/**
 * POST /api/adventure-log
 * Body: { step: 'intake' | 'generate', session: {...}, defaults: {...}, notesText: string, transcriptText?: string, answers?: {...} }
 * Returns: intake -> { missingQuestions: string[], uncertainItems?: {...}, confidence: number }; generate -> { log: string }
 * Requires: ADVENTURE_LOG_BUILDER_PROD (or OPENAI_API_KEY as fallback). Loads prompt from prompt-config.json and output template from template.txt (same origin).
 */

const CONFIG_PATH = '/tools/adventure-log-builder/prompt-config.json';
const TEMPLATE_PATH = '/tools/adventure-log-builder/template.txt';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MAX_TRANSCRIPT_CHARS = 12000;
const DEFAULT_FILLER_WORDS = ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know', 'I mean'];
const DEFAULT_TIMESTAMP_PATTERNS = [/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, /\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi];

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getOrigin(request) {
    const url = new URL(request.url);
    return url.origin;
}

async function loadConfig(request) {
    const origin = getOrigin(request);
    const url = origin + CONFIG_PATH;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (_) {
        return null;
    }
}

async function loadTemplate(request) {
    const origin = getOrigin(request);
    const url = origin + TEMPLATE_PATH;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.text();
    } catch (_) {
        return null;
    }
}

function preprocessText(text) {
    if (!text || typeof text !== 'string') return '';
    let s = text.trim();
    s = s.replace(/\n{3,}/g, '\n\n');
    if (s.length > DEFAULT_MAX_TRANSCRIPT_CHARS) {
        s = s.slice(0, DEFAULT_MAX_TRANSCRIPT_CHARS) + '\n\n[… truncated for length …]';
    }
    return s;
}

function buildFillerRegex(words) {
    if (!Array.isArray(words) || words.length === 0) return null;
    const escaped = words.map(function (w) {
        return String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).filter(Boolean);
    if (escaped.length === 0) return null;
    try {
        return new RegExp('\\b(' + escaped.join('|') + ')\\b', 'gi');
    } catch (_) {
        return null;
    }
}

function buildTimestampRegexes(patterns) {
    if (!Array.isArray(patterns) || patterns.length === 0) return DEFAULT_TIMESTAMP_PATTERNS;
    return patterns.map(function (p) {
        try {
            return new RegExp(p, 'gi');
        } catch (_) {
            return null;
        }
    }).filter(Boolean);
}

function preprocessTranscript(text, cleaningConfig) {
    if (!text || typeof text !== 'string') return '';
    let s = text.trim();
    const maxLen = (cleaningConfig && typeof cleaningConfig.maxLength === 'number') ? cleaningConfig.maxLength : DEFAULT_MAX_TRANSCRIPT_CHARS;

    const fillerWords = (cleaningConfig && cleaningConfig.fillerWords) || DEFAULT_FILLER_WORDS;
    const fillerRegex = buildFillerRegex(fillerWords);
    if (fillerRegex) s = s.replace(fillerRegex, ' ');

    if (cleaningConfig && cleaningConfig.stripTimestamps) {
        const timestampRegexes = buildTimestampRegexes(cleaningConfig.timestampPatterns);
        timestampRegexes.forEach(function (re) {
            s = s.replace(re, '');
        });
    }

    if (cleaningConfig && cleaningConfig.stripSpeakerLabels && cleaningConfig.speakerLabelPattern) {
        try {
            const speakerRe = new RegExp(cleaningConfig.speakerLabelPattern, 'gim');
            s = s.replace(speakerRe, '');
        } catch (_) {}
    }

    s = s.replace(/\n{3,}/g, '\n\n');
    s = s.replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').replace(/ \n/g, '\n');
    s = s.trim();
    if (s.length > maxLen) {
        s = s.slice(0, maxLen) + '\n\n[… transcript truncated …]';
    }
    return s;
}

async function openaiChat(apiKey, messages, config) {
    const model = (config && config.model) || 'gpt-4o-mini';
    const res = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || res.statusText || 'OpenAI request failed');
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content == null) throw new Error('No content in OpenAI response');
    return content;
}

function parseIntakeResponse(content) {
    const out = { missingQuestions: [], uncertainItems: {}, confidence: null };
    try {
        const trimmed = content.trim();
        const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed.missingQuestions)) out.missingQuestions = parsed.missingQuestions;
            if (parsed.uncertainItems && typeof parsed.uncertainItems === 'object') {
                out.uncertainItems = parsed.uncertainItems;
            }
            if (typeof parsed.confidence === 'number') out.confidence = parsed.confidence;
        }
    } catch (_) {
        out.missingQuestions = [content];
    }
    if (out.confidence == null) {
        const missing = Array.isArray(out.missingQuestions) ? out.missingQuestions.length : 0;
        out.confidence = Math.max(0, Math.min(100, Math.round(100 - missing * 15)));
    } else {
        out.confidence = Math.max(0, Math.min(100, Math.round(out.confidence)));
    }
    return out;
}

export async function onRequestPost(context) {
    const { env, request } = context;
    const apiKey = env.ADVENTURE_LOG_BUILDER_PROD || env.OPENAI_API_KEY;
    if (!apiKey) {
        return jsonResponse({ error: 'ADVENTURE_LOG_BUILDER_PROD (or OPENAI_API_KEY) not configured' }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch (_) {
        return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const step = body.step === 'intake' || body.step === 'intake-followup' || body.step === 'generate' ? body.step : null;
    if (!step) {
        return jsonResponse({ error: 'step must be "intake", "intake-followup", or "generate"' }, 400);
    }

    const uncertainItems = body.uncertainItems && typeof body.uncertainItems === 'object' ? body.uncertainItems : {};

    const session = body.session && typeof body.session === 'object' ? body.session : {};
    const defaults = body.defaults && typeof body.defaults === 'object' ? body.defaults : {};
    const notesText = typeof body.notesText === 'string' ? body.notesText : '';
    const transcriptText = typeof body.transcriptText === 'string' ? body.transcriptText : '';
    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

    const config = await loadConfig(request);
    const useLightTemplate = session.template === 'light' && config && config.templateLight;
    const templateText = useLightTemplate
        ? (config.templateLight && config.templateLight.trim()) || ''
        : await loadTemplate(request);
    const transcriptCleaning = (config && config.transcriptCleaning) || null;

    const notesProcessed = preprocessText(notesText);
    const transcriptProcessed = preprocessTranscript(transcriptText, transcriptCleaning);
    const combinedForLLM = notesProcessed + (transcriptProcessed ? '\n\n--- Transcript (supporting) ---\n\n' + transcriptProcessed : '');
    const systemPrompt = (config && config.systemPrompt) || 'You help create standardized adventure logs. Use the provided notes as primary source; transcript is supporting. Output Notion-ready markdown.';
    const outputFormat = (config && config.outputFormat) || (templateText ? 'Follow the provided template structure exactly; fill in each section from the session content. Omit or shorten sections that have no content.' : 'Sections: Session date, Campaign, Players present, Summary, Key events, Next time.');
    const outputTemplate = (templateText && templateText.trim()) || (config && config.outputTemplate) || '';
    const intakePrompt = (config && config.intakePrompt) || 'Return JSON only: { "missingQuestions": string[], "uncertainItems": { "names": [], "rewards": [], "outcomes": [] } }. Ask only for missing or contradictory data.';
    const intakeFollowupPrompt = (config && config.intakeFollowupPrompt) || 'Given uncertain items and existing answers, generate up to 3 short questions to clarify. Return ONLY valid JSON: { "missingQuestions": [] }.';

    if (step === 'intake') {
        const intakeSystem =
            intakePrompt +
            '\n\nAlso include a numeric confidence score from 0 to 100 in the JSON response as "confidence".' +
            '\nRespond with valid JSON only.';
        const intakeUser =
            `Defaults: ${JSON.stringify(defaults)}\n\n` +
            `Session form: ${JSON.stringify(session)}\n\n` +
            `Answers so far (may include optional clarifications): ${JSON.stringify(answers)}\n\n` +
            `Content (notes + transcript):\n${combinedForLLM.slice(0, 15000)}`;
        let content;
        try {
            content = await openaiChat(apiKey, [
                { role: 'system', content: intakeSystem },
                { role: 'user', content: intakeUser },
            ], config);
        } catch (e) {
            return jsonResponse({ error: e.message || 'Intake request failed' }, 502);
        }
        const result = parseIntakeResponse(content);
        return jsonResponse(result);
    }

    if (step === 'intake-followup') {
        const followupSystem =
            intakeFollowupPrompt +
            '\n\nAlso include a numeric confidence score from 0 to 100 in the JSON response as "confidence".' +
            '\nRespond with valid JSON only.';
        const followupUser = `Uncertain items: ${JSON.stringify(uncertainItems)}\n\nAnswers so far: ${JSON.stringify(answers)}\n\nGenerate up to 3 new questions to clarify the uncertain items. Do not repeat questions already answered.`;
        let content;
        try {
            content = await openaiChat(apiKey, [
                { role: 'system', content: followupSystem },
                { role: 'user', content: followupUser },
            ], config);
        } catch (e) {
            return jsonResponse({ error: e.message || 'Follow-up intake failed' }, 502);
        }
        const result = parseIntakeResponse(content);
        return jsonResponse(result);
    }

    if (step === 'generate') {
        const generateSystem = systemPrompt + '\n\n' + outputFormat + (outputTemplate ? '\n\nTemplate structure:\n' + outputTemplate : '');
        const generateUser = `Session metadata: ${JSON.stringify(session)}\n${Object.keys(answers).length ? 'Answers to intake: ' + JSON.stringify(answers) + '\n\n' : ''}Content:\n${combinedForLLM.slice(0, 20000)}`;
        let log;
        try {
            log = await openaiChat(apiKey, [
                { role: 'system', content: generateSystem },
                { role: 'user', content: generateUser },
            ], config);
        } catch (e) {
            return jsonResponse({ error: e.message || 'Generate request failed' }, 502);
        }
        return jsonResponse({ log: log.trim() });
    }

    return jsonResponse({ error: 'Invalid step' }, 400);
}
