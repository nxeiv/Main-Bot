'use strict';

const {
  BOT_HELP_MESSAGE,
  FEATURE_ALIASES,
  FEATURE_GUIDE,
  FEATURE_TUTORIALS,
  SERVER_INFO,
  SYSTEM_PROMPT,
} = require('./ai-knowledge');


function formatMinecraftReply(text) {
  return String(text || '')
    .trim()
    // Remove Markdown escaping before stripping Markdown syntax.
    .replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g, '$1')
    // Turn Markdown links into their visible text.
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    // Remove common Markdown formatting markers.
    .replace(/\*\*|__|~~/g, '')
    .replace(/[*_~`]/g, '')
    // Remove Markdown headings and convert unordered list markers to plain bullets.
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '• ')
    // Keep the Minecraft chat response as a single readable line.
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// AI RATE LIMITER
// ============================================================

// Minimum time between Gemini requests from the same user.
const USER_COOLDOWN_MS = 5000;

// Minimum time between ALL Gemini requests.
const GLOBAL_COOLDOWN_MS = 2000;

// Maximum number of requests waiting in the queue.
const MAX_QUEUE_SIZE = 10;
const MAX_CONTEXT_MESSAGES = 40;

const userLastRequest = new Map();

const aiMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  lastRequestAt: null,
  lastSuccessAt: null,
  lastError: null,
};

let requestQueue = [];
let processingQueue = false;
let lastGeminiRequest = 0;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function trimConversationHistory(history) {
  if (!Array.isArray(history) || history.length <= MAX_CONTEXT_MESSAGES) {
    return Array.isArray(history) ? history : [];
  }

  const trimmed = history.slice(-MAX_CONTEXT_MESSAGES);
  if (trimmed.length > 1 && trimmed[0]?.role === 'model') {
    trimmed.shift();
  }
  return trimmed;
}

function normalizeAiReply(text) {
  const symbolReplacements = [
    [/•/g, '-'],
    [/◆|◇/g, '-'],
    [/⌁|→/g, '->'],
    [/✓/g, 'yes'],
    [/✕/g, 'x'],
    [/ⓘ/g, 'info:'],
    [/⚠︎|⚠️|⚠/g, 'warning:'],
    [/⚒︎|⚒️|⚒/g, 'tools:'],
    [/⌂/g, 'home'],
    [/⌫/g, 'delete'],
    [/◌|◷|◎|⌘/g, ''],
    [/\uFE0F|\uFE0E|\u200D/g, ''],
  ];

  let reply = String(text || '');

  for (const [pattern, replacement] of symbolReplacements) {
    reply = reply.replace(pattern, replacement);
  }

  return reply
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeChatReply(text) {
  return normalizeAiReply(text)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .trim();
}

function runAiQualityChecks(text, options = {}) {
  let reply = normalizeAiReply(text);
  reply = reply.replace(/^(certainly|sure|absolutely|great question|of course)[!,.]?\s+/i, '');

  if (options.platform === 'minecraft') {
    reply = formatMinecraftReply(reply);
  }

  const maxLength = options.platform === 'minecraft' ? 240 : 1500;
  if (reply.length > maxLength) {
    reply = `${reply.slice(0, maxLength - 3)}...`;
  }

  return reply.trim();
}

function getAiDiagnostics() {
  const now = Date.now();
  let activeCooldowns = 0;

  for (const timestamp of userLastRequest.values()) {
    if (now - timestamp < USER_COOLDOWN_MS) activeCooldowns += 1;
  }

  return {
    configuredKeys: geminiClients.length,
    activeNormalKey: activeGeminiKeyIndex + 1,
    activeAdminKey: activeAdminGeminiKeyIndex + 1,
    queuedRequests: requestQueue.length,
    queueLimit: MAX_QUEUE_SIZE,
    activeCooldowns,
    conversationSessions: chatSessions.size,
    contextLimitMessages: MAX_CONTEXT_MESSAGES,
    model: GEMINI_MODEL,
    totalRequests: aiMetrics.totalRequests,
    totalErrors: aiMetrics.totalErrors,
    lastRequestAt: aiMetrics.lastRequestAt,
    lastSuccessAt: aiMetrics.lastSuccessAt,
    lastError: aiMetrics.lastError,
  };
}
function getUserId(options) {
  if (!options || !options.userId) {
    return 'unknown';
  }

  return String(options.userId);
}

function checkUserCooldown(userId) {
  if (userId === 'unknown') {
    return 0;
  }

  const lastRequest = userLastRequest.get(userId);

  if (!lastRequest) {
    return 0;
  }

  const elapsed = Date.now() - lastRequest;

  if (elapsed >= USER_COOLDOWN_MS) {
    return 0;
  }

  return USER_COOLDOWN_MS - elapsed;
}

function waitForGlobalCooldown() {
  const elapsed = Date.now() - lastGeminiRequest;

  if (elapsed >= GLOBAL_COOLDOWN_MS) {
    return Promise.resolve();
  }

  return wait(GLOBAL_COOLDOWN_MS - elapsed);
}

async function processQueue() {
  if (processingQueue) {
    return;
  }

  processingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();

    try {
      await waitForGlobalCooldown();

      lastGeminiRequest = Date.now();

      const result = await request.run();

      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
  }

  processingQueue = false;
}

function queueGeminiRequest(userId, run) {
  return new Promise((resolve, reject) => {
    if (requestQueue.length >= MAX_QUEUE_SIZE) {
      reject(
        new Error(
          'The AI is currently busy. Please try again in a moment.',
        ),
      );

      return;
    }

    requestQueue.push({
      userId,
      run,
      resolve,
      reject,
    });

    processQueue().catch(error => {
      console.error('[AI] Queue error:', error);
    });
  });
}

// ============================================================
// GEMINI
// ============================================================

const { GoogleGenAI } = require('@google/genai');

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const GEMINI_API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean);

if (GEMINI_API_KEYS.length === 0) {
  throw new Error('No Gemini API keys configured.');
}

const geminiClients = GEMINI_API_KEYS.map(
  apiKey => new GoogleGenAI({ apiKey }),
);

// ============================================================
// NORMAL AI SESSIONS
// ============================================================

// Each user gets their own conversation state.
//
// history:
//   Stores successful user/model turns so the conversation
//   can be rebuilt when Gemini key failover occurs.
//
// chat:
//   The currently active Gemini chat session for that user.
//
// keyIndex:
//   Which Gemini key the current chat session belongs to.
const chatSessions = new Map();

// Start with the first normal AI key.
let activeGeminiKeyIndex = 0;

// ============================================================
// ADMIN AI
// ============================================================

const ADMIN_COMMAND_PROMPT = `
You are an administrative intent parser for The Cottage★ SMP's Discord bot.

Your ONLY job is to determine whether the user's message requests one of these
specific administrative actions:

- start = start the AFK Minecraft bot
- stop = stop the AFK Minecraft bot
- status = check the AFK Minecraft bot status
- maintenance = put the server into maintenance / run the approved maintenance action
- restart = restart the Minecraft server
- scheduled = show currently scheduled administrative actions
- cancel = cancel a previously scheduled administrative action
- none = not an administrative request

Return ONLY valid JSON.
Do not use Markdown.
Do not explain your answer.

The JSON MUST have exactly this structure:

{
  "action": "start|stop|status|maintenance|restart|scheduled|cancel|none",
  "targetAction": "start|stop|status|maintenance|restart|all|none",
  "delayMinutes": number,
  "confidence": number
}

Rules for delayMinutes:
- If the user says "now", "immediately", or gives no delay, use 0.
- "in 5 minutes" means 5.
- "after 10 minutes" means 10.
- "in an hour" means 60.
- "in 30 seconds" should use 0 because this parser only supports minutes.
- Never return a negative number.
- If action is "none", use 0.
- If action is not "cancel", targetAction must be "none".
- If action is "cancel", targetAction must be the action the user wants cancelled.
- Do not interpret ordinary conversation as an admin command.
- confidence must be between 0 and 1.
- Use at least 0.9 only when the requested action is unambiguous.
- Use below 0.85 when the intent is unclear, hypothetical, or conversational.

Examples:

User: restart the server in 10 minutes
Output:
{"action":"restart","targetAction":"none","delayMinutes":10,"confidence":0.99}

User: put the server into maintenance after 5 minutes
Output:
{"action":"maintenance","targetAction":"none","delayMinutes":5,"confidence":0.99}

User: stop the AFK bot
Output:
{"action":"stop","targetAction":"none","delayMinutes":0,"confidence":0.99}

User: what's the server status?
Output:
{"action":"status","targetAction":"none","delayMinutes":0,"confidence":0.98}

User: cancel the scheduled restart
Output:
{"action":"cancel","targetAction":"restart","delayMinutes":0,"confidence":0.99}

User: what's scheduled?
Output:
{"action":"scheduled","targetAction":"none","delayMinutes":0,"confidence":0.98}

User: what actions are scheduled?
Output:
{"action":"scheduled","targetAction":"none","delayMinutes":0,"confidence":0.98}

User: what do you have scheduled?
Output:
{"action":"scheduled","targetAction":"none","delayMinutes":0,"confidence":0.98}

User: cancel the maintenance
Output:
{"action":"cancel","targetAction":"maintenance","delayMinutes":0,"confidence":0.99}

User: what's the weather like?
Output:
{"action":"none","targetAction":"none","delayMinutes":0,"confidence":0.99}
`;

// Admin AI is intentionally stateless.
// Every administrative request gets a fresh parser session.

// Admin AI keeps its own active-key pointer.
let activeAdminGeminiKeyIndex = 0;

function createChatSession(userId, index) {
  let state = chatSessions.get(userId);

  if (!state) {
    state = {
      history: [],
      chat: null,
      keyIndex: null,
    };

    chatSessions.set(userId, state);
  }

  // Reuse the current session when we're still on the same key.
  if (
    state.chat &&
    state.keyIndex === index
  ) {
    return state.chat;
  }

  // A different Gemini key is being used.
  // Rebuild the user's conversation from the saved history.
  state.chat = geminiClients[index].chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
    history: state.history,
  });

  state.keyIndex = index;

  return state.chat;
}

function isFallbackError(error) {
  const errorText = String(
    error?.message ||
    error?.error?.message ||
    error ||
    '',
  ).toLowerCase();

  const status =
    error?.status ||
    error?.code ||
    error?.error?.code;

  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    errorText.includes('resource_exhausted') ||
    errorText.includes('quota') ||
    errorText.includes('rate limit') ||
    errorText.includes('unavailable') ||
    errorText.includes('overloaded')
  );
}

// ============================================================
// NORMAL AI REQUEST
// ============================================================

async function sendGeminiMessage(message, userId) {
  let lastError = null;

  const state =
    chatSessions.get(userId) || {
      history: [],
      chat: null,
      keyIndex: null,
    };

  chatSessions.set(userId, state);

  for (
    let attempt = 0;
    attempt < geminiClients.length;
    attempt++
  ) {
    const index =
      (activeGeminiKeyIndex + attempt) %
      geminiClients.length;

    try {
      const chat =
        createChatSession(userId, index);

      console.log(
        `[AI] Using Gemini API key ${index + 1}/${geminiClients.length}.`,
      );

      const response =
        await chat.sendMessage({
          message,
        });

      // Save Gemini's actual curated conversation history.
      // This is used if the bot needs to fail over to another key.
      state.history = trimConversationHistory(chat.getHistory(true));
      activeGeminiKeyIndex = index;

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `[AI] Gemini API key ${index + 1} failed:`,
        error?.message || error,
      );

      if (!isFallbackError(error)) {
        throw error;
      }

      if (attempt + 1 < geminiClients.length) {
        console.log(
          `[AI] Falling back to Gemini API key ${
            ((index + 1) % geminiClients.length) + 1
          }.`,
        );
      }
    }
  }

  throw lastError;
}

// ============================================================
// ADMIN AI REQUEST
// ============================================================

async function sendAdminGeminiMessage(message) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt < geminiClients.length;
    attempt++
  ) {
    const index =
      (activeAdminGeminiKeyIndex + attempt) %
      geminiClients.length;

    try {
      // Fresh chat every time.
      // This intentionally gives the admin parser no memory.
      const chat =
        geminiClients[index].chats.create({
          model: GEMINI_MODEL,
          config: {
            systemInstruction:
              ADMIN_COMMAND_PROMPT,
          },
        });

      console.log(
        `[AI] Using Gemini admin parser key ${index + 1}/${geminiClients.length}.`,
      );

      const response =
        await chat.sendMessage({          message,
        });

      activeAdminGeminiKeyIndex = index;

      return response;
    } catch (error) {
      lastError = error;

      console.error(
        `[AI] Gemini admin parser key ${index + 1} failed:`,
        error?.message || error,
      );

      if (!isFallbackError(error)) {
        throw error;
      }

      if (attempt + 1 < geminiClients.length) {
        console.log(
          `[AI] Admin parser falling back to Gemini API key ${
            ((index + 1) % geminiClients.length) + 1
          }.`,
        );
      }
    }
  }

  throw lastError;
}

// ============================================================
// ADMIN COMMAND PARSER
// ============================================================

async function parseAdminCommand(message, options = {}) {
  const text = String(message || '').trim();

  if (!text) {
    return null;
  }

  const userId = getUserId(options);

  return queueGeminiRequest(userId, async () => {
    const response = await sendAdminGeminiMessage(
      `USER MESSAGE:
${text}`,
    );

    let raw = response.text?.trim();

    if (!raw) {
      throw new Error(
        'Gemini returned an empty admin command response.',
      );
    }

    // Remove accidental Markdown code fences.
    raw = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(
        '[AI] Invalid admin command JSON:',
        raw,
      );

      throw new Error(
        'Gemini returned an invalid administrative command.',
      );
    }

    const allowedActions = new Set([
  'start',
  'stop',
  'status',
  'maintenance',
  'restart',
  'scheduled',
  'cancel',
  'none',
]);

const allowedTargetActions = new Set([
  'start',
  'stop',
  'status',
  'maintenance',
  'restart',
  'all',
  'none',
]);

    if (!allowedActions.has(parsed.action)) {
      throw new Error(
        'Gemini returned an unsupported administrative action.',
      );
    }

    if (!allowedTargetActions.has(parsed.targetAction)) {
      throw new Error(
        'Gemini returned an unsupported target action.',
      );
    }

    const delayMinutes = Number(parsed.delayMinutes);
    const confidence = Number(parsed.confidence);

    if (
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      throw new Error(
        'Gemini returned an invalid administrative confidence.',
      );
    }

    if (
      !Number.isFinite(delayMinutes) ||
      delayMinutes < 0 ||
      delayMinutes > 10080
    ) {
      throw new Error(
        'Gemini returned an invalid administrative delay.',
      );
    }

    if (
      parsed.action !== 'none' &&
      confidence < 0.85
    ) {
      return {
        action: 'none',
        targetAction: 'none',
        delayMinutes: 0,
        confidence,
      };
    }

    if (
      parsed.action === 'cancel' &&
      parsed.targetAction === 'none'
    ) {
      throw new Error(
        'Gemini did not specify which scheduled action to cancel.',
      );
    }

    if (
      parsed.action !== 'cancel' &&
      parsed.targetAction !== 'none'
    ) {
      throw new Error(
        'Gemini returned an invalid target action.',
      );
    }

    return {
      action: parsed.action,
      targetAction: parsed.targetAction,
      delayMinutes: Math.floor(delayMinutes),
      confidence,
    };
  });
}

function getKnownAnswer(message) {
  const text = message.toLowerCase().trim();

  // ============================================================
  // DETERMINE WHETHER THIS IS ACTUALLY A MINECRAFT QUESTION
  // ============================================================

  const minecraftContext =
    /\bminecraft\b/.test(text) ||
    /\bsmp\b/.test(text) ||
    /\bminecraft server\b/.test(text) ||
    /\bmc server\b/.test(text) ||
    /\bjava edition\b/.test(text) ||
    /\bbedrock edition\b/.test(text) ||
    /\bjava player\b/.test(text) ||
    /\bbedrock player\b/.test(text) ||
    /\bgeyser\b/.test(text) ||
    /\bmcxboxbroadcast\b/.test(text) ||
    /\bsimple voice chat\b/.test(text) ||
    /\bveinminer\b/.test(text) ||
    /\belytra lunge\b/.test(text) ||
    /\bnetherite\b/.test(text);

  // ============================================================
  // SUMMARIZATION
  // ============================================================

  const summarizeChannelMatch = text.match(
    /^summarize\s+<\#(\d+)>$/,
  );

  if (summarizeChannelMatch) {
    return 'ⓘ Use `/summarize <channel>` for a private channel summary. It expires after 10 minutes.';
  }

  // ============================================================
  // BOT HELP
  // ============================================================

  if (
    text === 'help' ||
    text === 'help?' ||
    text === '/help' ||
    text === 'bot help' ||
    text === 'bot help?' ||
    text === 'commands' ||
    text === 'commands?' ||
    text === 'what can you do' ||
    text === 'what can you do?' ||
    text === 'what do you do' ||
    text === 'what do you do?' ||
    text === 'what can the bot do' ||
    text === 'what can the bot do?' ||
    text === 'how can you help' ||
    text === 'how can you help?'
  ) {
    return BOT_HELP_MESSAGE;
  }

  // ============================================================
  // BOT FEATURE QUESTIONS
  // These are aliases for the canonical help response.
  // ============================================================

  if (
    text === 'what are your features?' ||
    text === 'what are your features' ||
    text === 'your features?' ||
    text === 'your features' ||
    text === 'bot features?' ||
    text === 'bot features' ||
    text === 'features?' ||
    text === 'features'
  ) {
    return BOT_HELP_MESSAGE;
  }

  // ============================================================
  // SMP FEATURE QUESTIONS
  // ============================================================

  if (
    text === 'server features?' ||
    text === 'server features' ||
    text === 'smp features?' ||
    text === 'smp features' ||
    text === 'minecraft features?' ||
    text === 'minecraft features' ||
    text === 'what are the server features?' ||
    text === 'what are the server features' ||
    text === 'what are the smp features?' ||
    text === 'what are the smp features' ||
    text === 'what are the minecraft features?' ||
    text === 'what are the minecraft features'
  ) {
    return [
      '**The Cottage★ Chapter 1 Season 6 features:**',
      ...SERVER_INFO.features.map(
        feature => `• **${feature}** — ${FEATURE_GUIDE[feature]}`,
      ),
    ].join('\n');
  }

  // Feature tutorials work with both the public Cottage★ name and
  // older/internal phrases so players can ask naturally without the
  // bot exposing those internal names in its response.
  const featureEntries = [
    ...SERVER_INFO.features.map(feature => [feature.toLowerCase(), feature]),
    ...Object.entries(FEATURE_ALIASES),
  ];

  for (const [term, feature] of featureEntries) {
    const normalizedTerm = term.toLowerCase();

    if (!text.includes(normalizedTerm)) {
      continue;
    }

    const asksForTutorial =
      /\bhow (?:do i|can i|do you|does this|does it|do we)\b/.test(text) ||
      /\bhow to\b/.test(text) ||
      /\bhow does\b/.test(text) ||
      /\bhow do\b/.test(text) ||
      /\bhow can\b/.test(text) ||
      /\bhow should\b/.test(text) ||
      /\bguide\b/.test(text) ||
      /\btutorial\b/.test(text) ||
      /\buse\b/.test(text);

    const asksForDescription =
      /\bwhat is\b/.test(text) ||
      /\bwhat's\b/.test(text) ||
      /\bwhat does\b/.test(text) ||
      /\btell me about\b/.test(text) ||
      /\bexplain\b/.test(text);

    if (asksForTutorial && FEATURE_TUTORIALS[feature]) {
      return `**${feature}** — ${FEATURE_TUTORIALS[feature]}`;
    }

    if (
      asksForDescription ||
      text === normalizedTerm ||
      text === `${normalizedTerm}?`
    ) {
      return `**${feature}** — ${FEATURE_GUIDE[feature]}`;
    }
  }

  // ============================================================
  // HIGH-CONFIDENCE SERVER FACTS
  // These should never fall through to Gemini because they have
  // one authoritative answer in the current SMP configuration.
  // ============================================================

  const asksAboutUnconfirmedJavaAuthentication =
    /\b(?:cracked|non-premium|non premium|offline-mode|offline mode)\b/.test(text) &&
    /\b(?:server|smp|java|join|play|support|supports|account|premium)\b/.test(text);

  if (asksAboutUnconfirmedJavaAuthentication) {
    return 'Cracked/non-premium Java access is not confirmed for Chapter 1 Season 6. Please ask staff before relying on it.';
  }

  const asksAboutServerNetherite =
    /\bnetherite\b/.test(text) &&
    /\b(?:allowed|available|enabled|disabled|use|uses|tools|tool|armor|armour|craft|crafting|obtain|obtainable|this smp|the smp|this server|the server)\b/.test(text);

  if (asksAboutServerNetherite) {
    return 'The old Season 5 Netherite restriction has not been confirmed for Season 6. Check the current Minecraft Code of Conduct or ask staff.';
  }

  // ============================================================
  // GENERAL MINECRAFT IP INFORMATION
  // ============================================================

  if (
    text === 'ip?' ||
    text === 'server ip?' ||
    text === 'smp ip?' ||
    /\bserver ip information\b/.test(text) ||
    /\bwhere is the server ip\b/.test(text)
  ) {
    return `Java: ${SERVER_INFO.javaAddress}\nBedrock: ${SERVER_INFO.bedrockJoiningInfo}`;
  }

  if (
    text === 'invite?' ||
    text === 'invite' ||
    text === 'discord invite?' ||
    text === 'discord invite' ||
    text === 'join discord?' ||
    text === 'join discord' ||
    text === 'discord join?' ||
    text === 'discord join'
  ) {
    return `Join The Cottage★ Discord here: ${SERVER_INFO.invite}`;
  }

  if (
    text === 'mcrules?' ||
    text === 'mcrules' ||
    text === 'smp code of conduct?' ||
    text === 'smp code of conduct'
  ) {
    return `The Cottage★ Minecraft Code of Conduct is here: ${SERVER_INFO.rulesLink}`;
  }

  // ============================================================
  // JAVA ADDRESS
  // ============================================================

  if (
    /\bjava ip\b/.test(text) ||
    /\bjava address\b/.test(text) ||
    /\bjava server address\b/.test(text)
  ) {
    return `Java: ${SERVER_INFO.javaAddress}`;
  }

  // ============================================================
  // BEDROCK ADDRESS
  // ============================================================

  if (
    /\bbedrock ip\b/.test(text) ||
    /\bbedrock address\b/.test(text) ||
    /\bbedrock server address\b/.test(text) ||
    /\bbedrock port\b/.test(text)
  ) {
    return `${SERVER_INFO.bedrockJoiningInfo} A verified direct Bedrock IP/port is not currently listed in the public server information.`;
  }

  // ============================================================
  // INSTANT COMMON QUESTIONS
  // ============================================================

  if (text === 'roles?' || text === 'roles' || text === 'server roles?' || text === 'server roles') {
    return 'Server roles are here: <#1398624929099812937>';
  }

  if (text === 'channels?' || text === 'channels' || text === 'server channels?' || text === 'server channels') {
    return [
      '**Important Cottage★ channels:**',
      '• Rules — <#1478166898020585592>',
      '• Roles — <#1398624929099812937>',
      '• General — <#1398568017708978258>',
      '• Minecraft / Status — <#1533883039287873566>',
      '• Minecraft-related community — <#1533895421988962334>',
    ].join('\n');
  }

  if (text === 'rules?' || text === 'rules' || text === 'discord rules?' || text === 'discord rules') {
    return 'The main Discord rules are here: <#1478166898020585592>';
  }

  if (text === 'world download?' || text === 'world download' || text === 'download world?' || text === 'download world') {
    return 'A Season 6 world download has not been published yet. Do not use a previous-season download as the current world.';
  }

  if (text === 'join?' || text === 'join') {
    return 'For the Cottage★ community, use the official website. For Chapter 1 Season 6 joining instructions, ask **how do I join the server?**';
  }

  if (text === 'smp join?' || text === 'smp join' || text === 'join the smp?' || text === 'join the smp' || text === 'how do i join the smp?' || text === 'how do i join the smp') {
    return `The Cottage★ Chapter 1 Season 6 is invite-only. Start here: ${SERVER_INFO.invite}`;
  }

  if (text === 'java?' || text === 'java' || text === 'java server?' || text === 'java server') {
    return `Java: ${SERVER_INFO.serverVersion} • ${SERVER_INFO.serverSoftware} • ${SERVER_INFO.javaAddress}`;
  }

  if (text === 'bedrock?' || text === 'bedrock' || text === 'bedrock join?' || text === 'bedrock joining?') {
    return SERVER_INFO.bedrockJoiningInfo;
  }

  // ============================================================
  // MINECRAFT / SMP RULES
  // ============================================================

  if (
    minecraftContext &&
    (
      /\bserver rules\b/.test(text) ||
      /\bsmp rules\b/.test(text) ||
      /\bminecraft rules\b/.test(text) ||
      /\bwhat are the minecraft rules\b/.test(text) ||
      /\bwhat are the smp rules\b/.test(text) ||
      /\bwhere are the minecraft rules\b/.test(text) ||
      /\bwhere are the smp rules\b/.test(text)
    )
  ) {
    return `The Cottage★ Minecraft Code of Conduct is here: ${SERVER_INFO.rulesLink}`;
  }
  // ============================================================
  // BEDROCK JOINING
  // ============================================================

  if (
    text === 'how do i join on bedrock?' ||
    text === 'how do i join bedrock?' ||
    /\bjoin.*bedrock\b/.test(text)
  ) {
    return SERVER_INFO.bedrockJoiningInfo;
  }

  return null;
}

function getInstantAnswer(message) {
  const knownAnswer = getKnownAnswer(message);

  return knownAnswer
    ? normalizeChatReply(knownAnswer)
    : null;
}

function getHelpMessage() {
  return getInstantAnswer('help');
}


// ============================================================
// ASK
// ============================================================

async function ask(message, options = {}) {
  const text = String(message || '').trim();

  aiMetrics.totalRequests += 1;
  aiMetrics.lastRequestAt = Date.now();

  if (!text) {
    throw new Error('Message cannot be empty.');
  }

  // Known server questions NEVER use Gemini,
  // unless this request explicitly needs the normal Gemini path.
  if (!options.skipKnownAnswers) {
    const knownAnswer = getInstantAnswer(text);

    if (knownAnswer) {
      const reply = knownAnswer;

      return options.platform === 'minecraft'
        ? formatMinecraftReply(reply)
        : reply;
    }
  }

  const userId = getUserId(options);

  // Per-user cooldown.
  const cooldown = checkUserCooldown(userId);

  if (cooldown > 0) {
    throw new Error(
      `Please wait ${Math.ceil(cooldown / 1000)}s before asking the AI again.`,
    );
  }

  userLastRequest.set(userId, Date.now());

  return queueGeminiRequest(userId, async () => {
    try {
      const response = await sendGeminiMessage(text, userId);

      let reply = response.text?.trim();

      if (!reply) {
        throw new Error('Gemini returned an empty response.');
      }

      reply = runAiQualityChecks(reply, options);

      if (reply.startsWith('/')) {
        reply = `- ${reply}`;
      }

      reply = normalizeChatReply(reply);

      aiMetrics.lastSuccessAt = Date.now();
      aiMetrics.lastError = null;

      return reply;
    } catch (error) {
      aiMetrics.totalErrors += 1;
      aiMetrics.lastError = String(
        error?.message ||
        error?.error?.message ||
        error ||
        'Unknown AI error',
      ).slice(0, 300);

      const errorText = String(
        error?.message ||
        error?.error?.message ||
        error ||
        '',
      ).toLowerCase();

      const status =
        error?.status ||
        error?.code ||
        error?.error?.code;

      // Both configured keys failed because of quota/rate limits.
      if (
        status === 429 ||
        errorText.includes('resource_exhausted') ||
        errorText.includes('quota') ||
        errorText.includes('rate limit')
      ) {
        throw new Error(
          'Gemini has reached its current quota. Please try again later.',
        );
      }

      // Both configured keys are temporarily unavailable.
      if (
        status === 503 ||
        errorText.includes('unavailable') ||
        errorText.includes('overloaded')
      ) {
        throw new Error(
          'Gemini is temporarily busy. Please try again in a moment.',
        );
      }

      throw error;
    }
  });
}

function resetUserConversation(userId) {
  if (!userId) {
    return false;
  }

  return chatSessions.delete(
    String(userId),
  );
}

function resetConversation() {
  // Forget every normal user's conversation.
  chatSessions.clear();

  // The admin parser is stateless, so there is
  // no admin conversation history to clear.

  activeGeminiKeyIndex = 0;
  activeAdminGeminiKeyIndex = 0;
}

module.exports = {
  ask,
  parseAdminCommand,
  resetConversation,
  resetUserConversation,
  getAiDiagnostics,
  getKnownAnswer,
  getInstantAnswer,
  getHelpMessage,
};