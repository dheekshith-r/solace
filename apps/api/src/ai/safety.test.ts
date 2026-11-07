import { describe, expect, it } from 'vitest';
import { checkSafety, crisisReply, guessLanguage, normalizeForSafety } from './safety';

describe('safety pre-check', () => {
  it.each(['train ke aage kood jaunga', 'chhat se kood jaungi', 'zeher kha lunga', 'kitni neend ki goliyan khaun', 'nas kaatne ka tarika', 'मैं मर जाऊँगा'])(
    'Hinglish and Hindi, review round 5: %s',
    (text) => {
      expect(checkSafety(text).crisis).toBe(true);
    },
  );

  it.each([
    'I want to kill myself',
    'i dont want to live anymore',
    "I don't want to be alive",
    'Honestly I just want to die.',
    'everyone would be better off without me',
    'I keep thinking about suicide',
    'feeling suicidal tonight',
    'I have been cutting myself again',
    'thinking of ending my life',
    'there is no reason to live',
    'I wish I was dead',
    'I want to end it all',
    'KMS',
    'I might overdose',
    // Added after review.
    'i wanna die',
    'I just wanna die tbh',
    'I wish I could die',
    "I can't go on",
    "I can't go on like this",
    "I don't want to be here anymore",
    'I hope I never wake up',
    'I just want to never wake up',
    'nobody would miss me',
    'no one would even notice me gone, nobody will miss me',
    'I should just die',
    'I feel like dying',
    "I'm going to end it tonight",
    'I took a bunch of pills',
    'I want to unalive myself',
    'unalive',
    'thinking about sucide',
    'i want to kil myself',
    'i want to k!ll myself',
    'k1ll myself',
    's.u.i.c.i.d.e',
    'self-harm again',
    // Round 3: punctuation between words, spaced letters.
    'life sucks.kms',
    'fine.kill myself',
    'lol.suicide',
    'kill-myself',
    'end-it-all',
    'k i l l myself',
    's u i c i d e',
    'ok.i want to die',
    'i want to d1e',
    'su1c1de',
    // Round 3: more phrasings.
    'I am thinking of ending it',
    'kill me',
    'what is the point of living',
    'tired of living',
    'i want to stop existing',
    'cant take it anymore',
    'going to off myself',
    'I want to sleep forever',
    'I want to disappear',
    'I am cutting',
    'suicidee',
    'wantto die',
    'i hate my life and want it to end',
    // Round 4 (recall first): exclusions must not hide these.
    "I'm going to end it on Friday",
    'i will end it with pills',
    'planning to end it at the bridge tonight',
    'I want to die. my hair is falling out and nothing matters',
    'i want to die my head hurts so much',
    'I want to die of shame and never wake up',
    'i am cutting the skin on my arm',
    'i am cutting my wrists',
    'i have the pills ready',
    'tonight is my last night',
    'this is my last night alive',
    'this is goodbye, i wont be here tomorrow',
    // Review round 5: methods, plans and goodbye signals.
    'i am going to jump in front of a train',
    'planning to step in front of a bus',
    'i want to drive my car off a cliff',
    'how deep do you have to cut',
    'which vein should i cut',
    'how long does it take to hang',
    'is jumping from the 5th floor enough',
    'I have written my will and said goodbye to everyone',
    'gave away all my stuff, wont need it soon',
    'i cant stop thinking about dying',
    'i think about death all the time and want it',
  ])('English: %s', (text) => {
    expect(checkSafety(text)).toEqual({ crisis: true, language: 'en' });
  });

  it.each([
    'what is the most painless way to die',
    'easiest way to kill myself',
    'quickest way to end it',
    'fastest way to die',
    'what is a lethal dose of paracetamol',
    'fatal dose of sleeping pills',
    'how many paracetamol to die',
    'how much paracetamol is lethal',
    'how many pills does it take to overdose',
    'overdose amounts for crocin',
    'how to tie a noose',
    'how do i hang myself',
    'how to commit suicide',
    // Round 3.
    'how many pills would it take',
    'which pills can kill you',
    'how high does a building need to be to die',
    'how do i end it',
    'how many sleeping pills to die',
    'best way to kill myself',
    // Round 4.
    'how do i end it with pills',
    'how many sleeping pills should i take for it to be over',
    'how many pills can i take for good',
    'how many pills do i take for it to stop forever',
    'I keep thinking about a noose',
    'I bought a noose',
    'what household chemicals can kill you',
    'how long does it take to bleed out',
    'is it painful to drown',
    'where can i buy rat poison to drink',
  ])('method-seeking: %s', (text) => {
    expect(checkSafety(text)).toEqual({ crisis: true, language: 'en' });
  });

  it.each([
    'main marna chahta hoon',
    'mujhe mar jana hai yaar',
    'ab jeena nahi chahti',
    'khudkushi ke baare mein soch raha hoon',
    'sochta hu suicide kar lunga',
    'zindagi khatam kar dunga',
    'khud ko khatam karna chahta hu',
    'jeene ka mann nahi karta',
    'मैं मरना चाहता हूँ',
    'आत्महत्या',
    // Added after review.
    'khudkhushi kar lunga',
    'mujhe zinda nahi rehna',
    'apni jaan le lunga',
    'apni jaan le lungi',
    'sab khatam karna chahta hu',
    'sab khatam karna chahti hu',
    'jeene ka koi matlab nahi hai',
    'marne ka aasan tarika batao',
    'मुझे मरना है',
    'जीना नहीं है',
    // Round 3.
    'khatam kar dunga sab',
    'kitni goliyan khaun ki mar jaun',
    'MUJHE MARNA HAI',
    // Round 4.
    'kya koi aasan tarika hai marne ka',
    'neend ki goli kitni khani padegi',
    'mujhe khud ko hurt karna hai',
  ])('Hinglish and Hindi: %s', (text) => {
    expect(checkSafety(text)).toEqual({ crisis: true, language: 'hinglish' });
  });

  it.each([
    'this exam is killing me',
    'I could kill for a samosa right now',
    'I was dying of laughter',
    "I'm dead tired after work",
    'my phone battery died',
    'deadline is tomorrow, I am so stressed',
    'I watched Suicide Squad last night',
    'yaar main bahut thak gaya hoon',
    'mera mann nahi lag raha padhai mein',
    'had a good day, finally',
    "I can't go on the trip tomorrow",
    'I never wake up on time',
    'I feel like dyeing my hair',
    'aaj kaam sab khatam karna hai',
    'how many pages do I need to read for the exam',
    'I have 1 exam and 3 assignments left',
    'the best way to learn is practice',
    // Round 3: one or more ordinary uses for each new pattern.
    'take my life savings',
    "let's end it with a song",
    'how do I end it politely with my landlord',
    'that joke killed me',
    'kill the lights',
    'what is the point of this meeting',
    'tired of lifting weights',
    "I'm tired of life admin",
    'the old app will stop existing next year',
    "I can't take this class anymore",
    'I took the day off myself',
    'I want to sleep in tomorrow',
    'aaj kaam khatam kar dunga',
    'how many pills do I take for a headache',
    'which pills can kill a headache fastest',
    'how high do planes fly',
    'the noose scene in the film was hard to watch',
    'I wanna die laughing at this meme',
    'how to die my hair',
    'mar jaunga hasi se',
    // Round 4.
    'how many tablets should i take for a fever',
    'how many paracetamol can i take for my period pain',
    'we should end it on a high note',
    'let us end it with a song',
    'I dyed my hair blue',
    'I died laughing at the meme',
    'the season finale ended it on a cliffhanger',
    'how high can a kite go',
  ])('not a crisis: %s', (text) => {
    expect(checkSafety(text)).toEqual({ crisis: false });
  });

  // Known acceptable false positives (recall-first policy, Nov 2026). These ordinary phrases
  // share a crisis pattern ("end it", "I am cutting") and no unambiguous benign phrase covers
  // them, so they trigger. The cost is a caring reply and the helpline card; narrowing them
  // would hide messages like "I'm going to end it on Friday" or "i am cutting the skin on my arm".
  it.each(['end it early today', 'can we end it at 5', 'I am cutting vegetables for dinner'])(
    'known acceptable false positive (triggers by design): %s',
    (text) => {
      expect(checkSafety(text).crisis).toBe(true);
    },
  );

  it('a benign phrase only vetoes a hit inside it, never across a sentence break', () => {
    expect(checkSafety('I want to dye my hair blue').crisis).toBe(false);
    expect(checkSafety('I want to die. my hair is falling out').crisis).toBe(true);
    expect(checkSafety('how many pills do I take for a headache').crisis).toBe(false);
    expect(checkSafety('how many pills do I take for a headache. how many pills to die').crisis).toBe(true);
  });

  it('folds leetspeak and punctuation only inside words', () => {
    expect(normalizeForSafety('K!LL my-self')).toBe('kill myself');
    expect(normalizeForSafety('I have 1 exam!')).toBe('i have 1 exam');
  });

  it('guesses Hinglish from common Hindi words or Devanagari, English otherwise', () => {
    expect(guessLanguage('yaar aaj kuch theek nahi lag raha')).toBe('hinglish');
    expect(guessLanguage('मुझे अच्छा नहीं लग रहा')).toBe('hinglish');
    expect(guessLanguage('I feel off today')).toBe('en');
    expect(guessLanguage('Main Street was busy')).toBe('en');
  });

  it('the fixed replies name Tele-MANAS 14416 and never mention methods', () => {
    for (const reply of [crisisReply('en'), crisisReply('hinglish')]) {
      expect(reply).toContain('Tele-MANAS');
      expect(reply).toContain('14416');
      expect(reply).not.toMatch(/pill|rope|blade|jump|dose/i);
    }
  });

  it('runs well under 5 ms per message', () => {
    const long = 'I feel kind of off today and I am not sure why. '.repeat(40);
    const started = performance.now();
    for (let i = 0; i < 200; i += 1) checkSafety(long);
    expect((performance.now() - started) / 200).toBeLessThan(5);
  });
});
