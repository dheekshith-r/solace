/**
 * GET /resources content (ticket 12): static, bundled with the API, no database.
 * Plain, practical language. General wellbeing guidance only: no medical claims.
 */
import { HELPLINE, type ResourcesResponse } from '@solace/shared';

export const RESOURCES: ResourcesResponse = {
  guides: [
    {
      slug: 'mindfulness-101',
      title: 'Mindfulness 101',
      summary: 'What mindfulness actually is, and three small ways to practise it today.',
      minutes: 4,
      sections: [
        {
          heading: 'What it is',
          body: 'Mindfulness is noticing what is happening right now, inside and around you, without rushing to judge it. It isn’t about emptying your mind. Thoughts will keep coming, and that’s fine. The practice is gently coming back, again and again.',
        },
        {
          heading: 'One minute of breath',
          body: 'Sit comfortably and let your breath move on its own. Notice where you feel it most: the nose, the chest or the belly. When your mind wanders, and it will, notice where it went and bring your attention back. That return is the whole exercise.',
        },
        {
          heading: 'Everyday moments',
          body: 'Pick one routine thing, like brushing your teeth or drinking chai, and do it with full attention. Notice the taste, the temperature, the sounds. A few mindful minutes in an ordinary task count just as much as formal practice.',
        },
        {
          heading: 'Be patient with yourself',
          body: 'Some days your mind will feel busy and restless. That isn’t failing. Short and regular beats long and rare, so start with a minute or two and build from there if it feels good.',
        },
      ],
    },
    {
      slug: 'anxiety-toolkit',
      title: 'Anxiety toolkit',
      summary: 'Quick, practical tools for the moments when worry takes over, including 5-4-3-2-1 grounding.',
      minutes: 5,
      sections: [
        {
          heading: 'Anxiety is a signal, not a verdict',
          body: 'A racing heart, tight chest or spinning thoughts are your body’s alarm system being a little too helpful. The feeling is real and uncomfortable, and it does pass. Naming it, “this is anxiety”, can already loosen its grip a little.',
        },
        {
          heading: '5-4-3-2-1 grounding',
          body: 'Look around and name 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell and 1 thing you can taste. Take your time with each one. It gently pulls your attention out of the worry and back into the room you are in.',
        },
        {
          heading: 'Longer out-breaths',
          body: 'Breathe in through your nose for a count of four, then out slowly for a count of six. Making the out-breath longer than the in-breath tells your body it is safe to settle. Five or six rounds is often enough to notice a shift.',
        },
        {
          heading: 'Give worry a time slot',
          body: 'If a worry keeps circling, write it down and set a fifteen-minute “worry time” later in the day. When it comes back before then, remind yourself it has a slot. Many worries feel smaller by the time you get to them.',
        },
      ],
    },
    {
      slug: 'beating-the-blues',
      title: 'Beating the blues',
      summary: 'Gentle, small steps for days when your mood is low and everything feels like effort.',
      minutes: 4,
      sections: [
        {
          heading: 'Start smaller than feels useful',
          body: 'When your mood is low, motivation often comes after action, not before. Choose something tiny: open the curtains, drink a glass of water, step outside for two minutes. Small wins add up more than they seem to.',
        },
        {
          heading: 'Move a little',
          body: 'A short walk, some stretching or dancing to one song can lift your energy a bit. It doesn’t need to be exercise in the gym sense. Just let your body move for a few minutes, ideally in daylight.',
        },
        {
          heading: 'Reach out, even briefly',
          body: 'Low mood can make you want to pull away from people. A short message to a friend or family member, even just “thinking of you”, keeps a thread of connection open. You don’t have to explain how you feel.',
        },
        {
          heading: 'Notice what helps',
          body: 'At the end of the day, write down one thing that felt slightly better, however small. Over a week, these notes can show you what to do more of. If low days keep stacking up for two weeks or more, talking to a doctor or counsellor is a good next step.',
        },
      ],
    },
    {
      slug: 'self-esteem-reset',
      title: 'Self-esteem reset',
      summary: 'How to notice your inner critic and start talking to yourself like a good friend would.',
      minutes: 4,
      sections: [
        {
          heading: 'Catch the critic',
          body: 'Most of us have an inner voice that is quick to point out what went wrong. Start by simply noticing it. When you hear “I’m so useless”, pause and label it: “that’s my critic talking”. You don’t have to agree with it.',
        },
        {
          heading: 'The friend test',
          body: 'Ask yourself: would I say this to a friend who was going through the same thing? If not, try saying what you would tell them instead. It may feel awkward at first; it gets easier with practice.',
        },
        {
          heading: 'Keep a small evidence list',
          body: 'Each evening, write down one thing you handled, tried or did kindly, even if it seems minor. On harder days, reading back through the list is a reminder that the critic only tells part of the story.',
        },
        {
          heading: 'Progress, not perfection',
          body: 'Building self-worth is slow and uneven, and that is normal. Aim to be a little kinder to yourself than yesterday, not to feel confident all the time.',
        },
      ],
    },
    {
      slug: 'sleep-wind-down',
      title: 'Sleep wind-down',
      summary: 'A simple evening routine to help your body and mind get ready for sleep.',
      minutes: 4,
      sections: [
        {
          heading: 'Keep a steady rhythm',
          body: 'Going to bed and waking up at roughly the same time each day, weekends included, helps your body know when to feel sleepy. Morning daylight helps set that rhythm too.',
        },
        {
          heading: 'Dim the last hour',
          body: 'In the hour before bed, lower the lights and put screens away or turn their brightness down. Choose something calm instead: a book, gentle music, a warm shower or a few slow stretches.',
        },
        {
          heading: 'Park your thoughts',
          body: 'If your mind races at night, keep a notebook by the bed. Write down tomorrow’s to-dos or whatever is on your mind, then tell yourself it is safe on paper until morning.',
        },
        {
          heading: 'If you can’t sleep',
          body: 'If you have been awake for what feels like twenty minutes, get up and do something quiet in dim light until you feel drowsy, then try again. Lying there trying hard to sleep tends to keep you awake. Slow breathing, with a longer out-breath, can help you settle.',
        },
      ],
    },
  ],
  getHelp: {
    helpline: HELPLINE,
    emergencyNumber: HELPLINE.emergencyNumber,
    note: 'Solace is not a substitute for professional care.',
  },
};
