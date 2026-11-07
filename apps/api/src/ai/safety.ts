/**
 * Safety pre-check (spec 2.1 step 3). Runs synchronously on every typed message before any
 * model call; on a hit the model is never called and the fixed reply below is used instead.
 *
 * It favours recall: a false positive shows a caring reply and the helpline card, which is a
 * small cost; a miss is not. Idioms that are clearly not about self-harm ("this exam is killing
 * me", "dying of laughter") are deliberately not matched. Questions seeking methods or means
 * are always a hit. Subtler language is left to the reply model, whose system prompt carries
 * the crisis tone (prompts.ts).
 */
import { HELPLINE } from '@solace/shared';

export type CrisisLanguage = 'en' | 'hinglish';
export type SafetyResult = { crisis: false } | { crisis: true; language: CrisisLanguage };

const between = (chars: string) => new RegExp(`(?<=\\p{L})[${chars}]+(?=\\p{L})`, 'gu');
const LEET: [RegExp, string][] = [
  [between('!1|'), 'i'],
  [between('@4'), 'a'],
  [between('3'), 'e'],
  [between('0'), 'o'],
  [between('$5'), 's'],
  [between('7'), 't'],
];
const IN_WORD_PUNCTUATION = between('.*_~\\-');

/** Lowercase, apostrophes dropped, leetspeak folded inside words ("k!ll", "su1c1de"). */
function prepare(text: string): string {
  let prepared = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’`']/g, '');
  // Leetspeak only inside a word, so "I have 1 exam" is untouched.
  for (const [pattern, letter] of LEET) prepared = prepared.replace(pattern, letter);
  return prepared;
}

const tidy = (text: string) =>
  text
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The glued form: punctuation inside a word is removed ("s.u.i.c.i.d.e", "self-harm"), other
 * punctuation dropped, whitespace collapsed.
 */
export function normalizeForSafety(text: string): string {
  return tidy(prepare(text).replace(IN_WORD_PUNCTUATION, ''));
}

/** Runs of three or more single letters ("k i l l") joined into one word. */
const SPACED_LETTERS = /(?<!\S)(?:\p{L} ){2,}\p{L}(?!\S)/gu;

/**
 * Every form a message is checked in: punctuation as spaces ("life sucks.kms"), punctuation
 * glued ("k.i.l.l"), and spaced letters joined ("k i l l myself"). A hit on any form counts.
 */
export function safetyForms(text: string): string[] {
  const prepared = prepare(text);
  const spaced = tidy(prepared);
  const glued = tidy(prepared.replace(IN_WORD_PUNCTUATION, ''));
  const joined = spaced.replace(SPACED_LETTERS, (run) => run.replace(/ /g, ''));
  return [...new Set([spaced, glued, joined])];
}

// Building blocks for common spelling variants.
const I = '(?:i|im|i am|ive|i have|i will|ill|i would|id|me)';
const DONT = '(?:dont|do not|dnt|didnt|cant|cannot|can not|no longer|wont)';
const MYSELF = '(?:my ?self|me self|mself|myslf)';
const WANT_TO = '(?:want to|wanna|wantto|wanto|wish to|wish i could|want 2)';

const ENGLISH: RegExp[] = [
  // Suicide and common misspellings ("sucide", "suiside").
  /\b(?:sui?ci?d|suisid|susid)(?:e+|es|al|ally)?\b/,
  new RegExp(`\\bk(?:i|e)ll?(?:ing)? ${MYSELF}\\b`),
  /\b(?:just |please |someone )?kill me\b/,
  /\bkms\b/,
  /\bunalive\b/,
  new RegExp(`\\b(?:to|gonna|going to|will|wanna|want to|should|might|could) off ${MYSELF}\\b`),
  /\bend(?:ing)? (?:my|it|my own) (?:life|lives)\b/,
  /\bend(?:ing)? it all\b/,
  /\bend(?:ing)? it\b/,
  /\bwant (?:it|everything|my life|life) to end\b/,
  /\btake (?:my|my own) life\b/,
  /\b(?:what is|whats|wats|what s) the point (?:of|in) (?:living|life|being alive|going on)\b/,
  /\btired of (?:living|being alive|life)\b/,
  new RegExp(`\\b(?:i|me) (?:just )?(?:${WANT_TO} |could |would |should |will )?(?:just )?stop existing\\b`),
  /\b(?:cant|cannot|can not) take (?:it|this) any ?more\b/,
  new RegExp(`\\b${WANT_TO} (?:sleep forever|disappear|not exist|not be alive)\\b`),
  /\b(?:i am|im|been|started|start|keep|still) cutting\b/,
  // Intent and goodbye.
  /\bpills (?:are )?ready\b/,
  /\b(?:my )?last night (?:alive|on earth)\b/,
  /\btonight is my last\b/,
  /\b(?:wont|will not) be here tomorrow\b/,
  /\btaking my (?:own )?life\b/,
  new RegExp(`\\b${I} (?:just |really |honestly |only )?${WANT_TO} (?:just )?die\\b`),
  new RegExp(`\\b${WANT_TO} (?:be dead|die)\\b`),
  /\bwant(?:s|ed)? to (?:be dead|die)\b/,
  new RegExp(`\\b${I} should (?:just )?(?:die|be dead|end it)\\b`),
  /\bfeel(?:s|ing)? like dying\b/,
  /\bwish (?:i|id) (?:was|were|had) (?:dead|never been born)\b/,
  /\bbetter off (?:dead|without me)\b/,
  /\b(?:nobody|no one|noone|no body) (?:would|will|wud|is going to|gonna) (?:even )?(?:miss|notice) me\b/,
  /\b(?:nobody|no one|noone) would care if i (?:died|was gone|were gone|disappeared)\b/,
  /\b(?:no|not any|isnt any) (?:reason|point) (?:to|in) (?:live|living|go on|going on)\b/,
  /\bnot worth living\b/,
  /\blife (?:is|isnt|feels) (?:not )?worth (?:living|it) any ?more\b/,
  new RegExp(`\\b${DONT} (?:want to|wanna) (?:live|be alive|exist|wake up)\\b`),
  new RegExp(`\\b${DONT} (?:want to|wanna) be here any ?more\\b`),
  new RegExp(`\\b${DONT} (?:go on|keep going|do this) any ?more\\b`),
  /\bi (?:cant|cannot|can not) go on\b/,
  /\b(?:want|wanna|wish|hope|hoping) (?:i |to )?(?:could )?never wake up\b/,
  /\bnever wake up again\b/,
  /\bsleep and never wake up\b/,
  /\bself ?harm(?:ing)?\b/,
  new RegExp(`\\b(?:hurt|harm|cut|cutting|burn|starve) ${MYSELF}\\b`),
  /\bcutting again\b/,
  /\boverdos(?:e|es|ed|ing)\b/,
  /\btook (?:a (?:bunch|lot|handful|load|whole bottle) of|all (?:my|the)|too many|so many|loads of) (?:pills|tablets|meds|medicines?|sleeping pills|paracetamol)\b/,
  new RegExp(`\\b(?:hang|hanging|drown|drowning) ${MYSELF}\\b`),
  /\bjump(?:ing)? (?:off|from) (?:a|the) (?:bridge|building|roof|terrace)\b/,
  /\bslit (?:my )?wrists?\b/,
  /\bdisappear forever\b/,
  /\bwrit(?:e|ing|ten) (?:a|my) (?:suicide|goodbye) (?:note|letter)\b/,
  // Methods and plans (review round 5).
  /\b(?:jump|jumping|step|stepping|throw (?:my ?self|myself)|lie down|lay down) in front of (?:a|the) (?:train|bus|truck|lorry|car|metro|local)\b/,
  /\bdrive (?:my car |the car )?off (?:a|the) (?:cliff|bridge|road)\b/,
  // Intent and goodbye signals.
  /\bsaid (?:my )?goodbyes? to (?:everyone|everybody|all of you|my family)\b/,
  /\bwritten (?:my|a) will\b/,
  /\bgave away (?:all )?(?:of )?my (?:stuff|things|belongings)\b/,
  /\b(?:cant|can't|cannot) stop thinking about (?:dying|death|killing (?:my ?self)|ending (?:it|my life))\b/,
  /\bkeep thinking about (?:dying|killing (?:my ?self)|ending (?:it|my life))\b/,
  /\bthink about death all the time\b/,
];

/** Questions seeking means or methods. Always a crisis: these must never reach a model. */
const METHOD_SEEKING: RegExp[] = [
  /\b(?:painless|easiest|easy|quickest|quick|fastest|best|surest|least painful|simplest) (?:way|ways|method|methods) (?:to|of) (?:die|dying|kill (?:my ?self|yourself|oneself)|end (?:my|your|it)|suicide|commit suicide)\b/,
  /\bhow (?:to|do i|can i|would i|could i|should i|do you|does one) (?:die|kill (?:my ?self|yourself|oneself)|end my life|commit suicide|hang (?:my ?self|yourself|oneself)|overdose|od)\b/,
  /\b(?:lethal|fatal|deadly|toxic) (?:dose|doses|dosage|amount|amounts|quantity)\b/,
  // Any "how many pills" question. Ordinary dosing ("... take for a headache") is vetoed in BENIGN.
  /\bhow (?:many|much) (?:pills|tablets|sleeping pills|paracetamol|meds|medicines?)\b/,
  /\bhow (?:many|much) .{1,30}?(?:would|does|will|do) it take to (?:die|kill|overdose|od)\b/,
  /\b(?:which|what) (?:pills|tablets|meds|medicines|drugs|poison|poisons) (?:can|will|would|could) kill\b/,
  /\b(?:which|what) \w+(?: \w+)? (?:can|will|would|could) kill (?:you|me|a person|someone)\b/,
  /\bhow (?:high|tall|far) .{0,40}?(?:to die|kill)\b/,
  /\bhow (?:do|can|should|would) i end it\b/,
  /\bnoose\b/,
  /\bbleed (?:out|to death)\b/,
  /\b(?:painful|hurt) to (?:drown|hang|die|jump)\b/,
  /\b(?:rat )?poison to (?:drink|eat|take)\b/,
  /\bhanging (?:yourself|oneself|someone)\b/,
  /\bhow (?:many|much) .{1,40}?(?:to die|to overdose|to od|is lethal|is fatal|would kill (?:me|you|a person|someone)|to kill (?:me|my ?self|yourself|a person))\b/,
  /\b(?:paracetamol|tylenol|acetaminophen|crocin|dolo|sleeping pills?|pills|tablets) (?:overdose|to die|lethal|fatal)\b/,
  // Review round 5.
  /\bhow deep .{0,20}?cut\b/,
  /\b(?:which|what) (?:vein|veins|artery|arteries)\b/,
  /\bhow long (?:does it|would it|will it|do you|does one) (?:take )?(?:to )?(?:hang|die|drown|bleed)\b/,
  /\b(?:jump|jumping) (?:from|off) .{0,25}?(?:floor|storey|story|building|roof) .{0,15}?enough\b/,
];

// Romanised Hindi (Hinglish), the way people actually type it.
const HINGLISH: RegExp[] = [
  /\bkhud ?(?:ku|k|kh|khu)shi\b/,
  /\baatm?a ?hatya\b/,
  /\bmar(?:na|ne|jana|jaana|jaun|jau|jaaun|jaunga|jaungi|jaoon) (?:chah?ta|chaah?ta|chah?ti|chaah?ti|chahte|chahiye|hai|hu|hoon|hun|tha|thi)\b/,
  /\bmar (?:jana|jaana|jaun|jau|jaaun|jaunga|jaungi|jaoon|jaati|jaata)\b/,
  /\bmarne ka (?:mann?|man|dil|soch)\b/,
  /\bmarne ki (?:ichha|icchha|soch)\b/,
  /\b(?:jeena|jina|jeene|jine) (?:nahi|nhi|nahin|ni) (?:chah?ta|chaah?ta|chah?ti|chaah?ti|chahte|hai)\b/,
  /\b(?:jeene|jine) ka (?:mann?|man|dil) (?:nahi|nhi|nahin|ni)\b/,
  /\b(?:jeene|jine) ki (?:koi )?(?:wajah|vajah|wja) (?:nahi|nhi|nahin|ni)\b/,
  /\b(?:jeene|jine|jeena|jina|zindagi) (?:ka|ki|ke) (?:koi )?(?:matlab|matlb|maksad|point) (?:nahi|nhi|nahin|ni)\b/,
  /\bzinda (?:nahi|nhi|nahin|ni) (?:rehna|rahna|rehena|rahunga|rahungi|reh sakta|reh sakti)\b/,
  /\bzindagi (?:khatam|khtm|khatm) (?:kar|karna|karni|karne|kardu|kar du|kar dunga|kar dungi|ho gayi)\b/,
  /\bsab (?:kuch )?(?:khatam|khtm|khatm) (?:karna|karne) (?:chah?ta|chaah?ta|chah?ti|chaah?ti|chahte)\b/,
  /\bsab (?:kuch )?(?:khatam|khtm|khatm) kar (?:dunga|dungi|du|doon)\b/,
  /\b(?:khatam|khtm|khatm) kar (?:dunga|dungi|du|doon) sab\b/,
  /\b(?:khud|apne aap) ko (?:khatam|khtm|maar|mar|hurt|nuksan|nuksaan|chot)\b/,
  /\bapni jaan (?:le|lena|lene|lelu|de|dena|dedu)\b/,
  /\bjaan de (?:dunga|dungi|du|doon|dena)\b/,
  /\bsuicide (?:kar|karna|karne|karunga|karungi|kar lunga|kar lungi|krna|krunga|krungi)\b/,
  /\bnas kaat/,
  /\b(?:faasi|fansi|phansi|phaansi) (?:laga|lagana|lagaunga|lagaungi|lagaa|le lunga|le lungi)\b/,
  // Method-seeking.
  /\bmarne (?:ka|ke|ki) (?:liye )?(?:koi )?(?:aasan |asan |easy )?(?:tarika|tareeka|tarike|tareeke|upay|way)\b/,
  /\bkitni (?:goli|goliyan|goliya|tablet|tablets|pills?) .{0,30}?(?:marne|mar jau|mar jaun|mar jaunga|mar jaungi)\b/,
  /\btarika .{0,20}marne\b/,
  /\bgoli(?:yan|ya)? kitni\b/,
  // Review round 5.
  /\bkood (?:jaunga|jaungi|jau|jaun|jaaun|jaoon|jaa(?:unga|ungi))\b/,
  /\b(?:zeher|zehar|jahar|zahar) (?:kha|pi|pee) (?:lunga|lungi|lu|loon|lu ga|lena)\b/,
  /\b(?:neend|sleeping) ki goli(?:yan|ya)? kitni\b/,
  /\bkitni .{0,15}?goli(?:yan|ya)? (?:khaun|khau|khani|khaoon|kha lu)\b/,
];

// Devanagari Hindi. Normalised the same way as the input, so nukta forms compare equal.
const HINDI: RegExp[] = [
  'आत्महत्या',
  'खुदकुशी',
  'मरना चाहत',
  'मर जाना चाहत',
  'मुझे मरना',
  'जीना नहीं',
  'ज़िंदगी खत्म',
  'जिंदगी खत्म',
  'मर जाऊ',
  'मर जाउ',
].map((phrase) => new RegExp(normalizeForSafety(phrase)));

/**
 * Unambiguous everyday phrases. Recall comes first: a BENIGN phrase never removes text before
 * matching. It can only veto a hit whose whole match lies inside it, and only when the phrase
 * sits within one sentence of the original message ("I want to die. my hair is falling out"
 * still triggers). When in doubt, the message triggers.
 */
const BENIGN: RegExp[] = [
  /\b(?:i |im |i am )?(?:just |really )?(?:want to |wanna |could |gonna |going to |will |would )?(?:die|died|dying) (?:laughing|of (?:laughter|embarrassment|boredom|cuteness))\b/,
  /\b(?:how to |i |im |i am )?(?:want to |wanna |going to |gonna |will |feel like |feels like |feeling like )?(?:die|dye|dying|dyeing) (?:my|her|his|the|your) hair\b/,
  /\bmar (?:jaunga|jaungi|gaya|gayi|jaoge) (?:hasi|hasee|hass|hans|hassi) se\b/,
  /\bsuicide squad\b/,
  /\btake (?:my|my own) life (?:savings|insurance)\b/,
  /\btired of life admin\b/,
  /\b(?:i am |im |been |still |keep )?cutting the (?:vegetables|onions|cake|grass|line|cord)\b/,
  /\bi (?:cant|cannot|can not) go on (?:the|a|my|this|that|our) (?:trip|holiday|vacation|date|tour|stage|ride)\b/,
  /\bi (?:cant|cannot|can not) go on (?:leave|holiday|vacation)\b/,
  /\b(?:how (?:do|can|should|would) i )?end(?:ing)? it (?:on a high note|with a song|politely|nicely|gracefully)\b/,
  /\bhow (?:many|much) (?:pills|tablets|paracetamol|meds|medicines?) (?:(?:do|should|can) i take )?for (?:a |my )?(?:headache|fever|cold|pain|period pain|period|migraine|toothache|back pain)\b/,
  /\b(?:which|what) (?:pills|tablets|meds|medicines|drugs) (?:can|will|would|could) kill (?:a |my |the )?(?:headache|pain|fever|cold|migraine|bacteria|germs)\b/,
  /\bnoose scene\b/,
  /\bnoose\b.{0,40}?\bin the (?:film|movie|show|book|series)\b/,
  /\bin the (?:film|movie|show|book|series)\b.{0,40}?\bnoose\b/,
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asGlobal = (pattern: RegExp) => new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
const BENIGN_GLOBAL = BENIGN.map(asGlobal);

/** True when the words of a benign phrase appear in the original with no sentence break between. */
function withinOneSentence(phrase: string, prepared: string): boolean {
  const words = phrase.split(' ').filter(Boolean).map(escapeRegExp);
  return new RegExp(words.join('[^\\p{L}\\p{N}.!?;\\n]*'), 'u').test(prepared);
}

/** Spans of BENIGN phrases in a form that are allowed to veto a hit. */
function benignSpans(form: string, prepared: string) {
  const spans: { start: number; end: number }[] = [];
  for (const pattern of BENIGN_GLOBAL) {
    for (const match of form.matchAll(pattern)) {
      if (withinOneSentence(match[0], prepared)) {
        spans.push({ start: match.index, end: match.index + match[0].length });
      }
    }
  }
  return spans;
}

/** A match of `pattern` in `form` that no benign span fully contains. */
function unvetoedHit(form: string, pattern: RegExp, spans: { start: number; end: number }[]) {
  for (const match of form.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    if (!spans.some((span) => span.start <= start && span.end >= end)) return true;
  }
  return false;
}

const compile = (patterns: RegExp[]) => patterns.map(asGlobal);
const ENGLISH_G = compile(ENGLISH);
const METHOD_SEEKING_G = compile(METHOD_SEEKING);
const HINGLISH_G = compile(HINGLISH);
const HINDI_G = compile(HINDI);

export function checkSafety(text: string): SafetyResult {
  const prepared = prepare(text);
  const checks = safetyForms(text).map((form) => ({ form, spans: benignSpans(form, prepared) }));
  const matches = (patterns: RegExp[]) =>
    checks.some(({ form, spans }) => patterns.some((pattern) => unvetoedHit(form, pattern, spans)));
  // Hinglish first: a mixed message ("suicide kar lunga") gets the reply in the same language.
  if (matches(HINGLISH_G) || matches(HINDI_G)) return { crisis: true, language: 'hinglish' };
  if (matches(ENGLISH_G) || matches(METHOD_SEEKING_G)) {
    return { crisis: true, language: guessLanguage(text) };
  }
  return { crisis: false };
}

// Everyday Hindi words that rarely appear in English sentences.
const HINGLISH_WORDS =
  /\b(?:hai|hain|hoon|hu|nahi|nhi|nahin|kya|kyun|kyu|mujhe|mujhko|mera|meri|mere|main|mai|yaar|yar|kuch|bahut|bohot|aaj|kaise|tum|tumhe|aap|karna|kar|raha|rahi|rha|rhi|tha|thi|gaya|gayi|bhi|toh|abhi|sab|koi|accha|acha|matlab|dil|zindagi|jeena)\b/g;

/**
 * The language a fixed crisis reply should use: Hinglish when the text is in Devanagari or has
 * at least two common Hindi words, English otherwise. Used for messages that didn't hit a
 * Hinglish pattern, such as one Gemini's own safety filter blocked.
 */
export function guessLanguage(text: string): CrisisLanguage {
  if (/\p{Script=Devanagari}/u.test(text)) return 'hinglish';
  const words = prepare(text).match(HINGLISH_WORDS) ?? [];
  return words.length >= 2 ? 'hinglish' : 'en';
}

/** The fixed, caring reply streamed on a hit. No method details, ever. */
export function crisisReply(language: CrisisLanguage): string {
  if (language === 'hinglish') {
    return (
      `Mujhe sach mein khushi hai ki tumne mujhe bataya. Jo tum mehsoos kar rahe ho woh bahut bhaari lagta hai, aur tumhe ise akele nahi uthana hai. ` +
      `Abhi ${HELPLINE.name} ko ${HELPLINE.number} par call karo, yeh free hai aur 24 ghante khula hai, ya kisi bharose wale insaan ko batao. ` +
      `Agar tum abhi khatre mein ho, toh ${HELPLINE.emergencyNumber} par call karo. Main yahin hoon, tumhare saath.`
    );
  }
  return (
    `I'm really glad you told me. What you're carrying sounds so heavy, and you don't have to hold it alone. ` +
    `Please reach out to ${HELPLINE.name} at ${HELPLINE.number} (free, any time), or to someone you trust nearby. ` +
    `If you're in danger right now, call ${HELPLINE.emergencyNumber}. I'm here, and I'm staying with you.`
  );
}

/** A suggestion for the check-in response when the note holds crisis language. */
export const CRISIS_SUGGESTION = {
  text: `You don't have to carry this alone. ${HELPLINE.name} (${HELPLINE.number}) is free and there any time.`,
  action: 'none',
} as const;
