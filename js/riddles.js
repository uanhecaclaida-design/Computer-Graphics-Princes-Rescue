/* ============================================================
 * riddles.js — Shared riddle data and answer-checking logic
 * Used by both 2d.html and 3d.html
 * ============================================================ */

const RIDDLES = [
  {
    question: "I have keys but no locks, and space but no room. What am I?",
    options: ["A keyboard", "A treasure map", "A castle gate", "A storybook"],
    correctIndex: 0,
    hint: "You are tapping one right now, traveler!",
    correct: "Brilliant! That was too easy for a prince like you.",
    wrong: "Not quite! The giant stomps with disappointment."
  },
  {
    question: "The more you take, the more you leave behind. What am I?",
    options: ["Footsteps", "Memories", "Gold coins", "Breaths of wind"],
    correctIndex: 0,
    hint: "Look down at the path you have just walked.",
    correct: "Excellent! The giant blinks in surprise.",
    wrong: "Wrong! The giant laughs and the earth shakes."
  },
  {
    question: "What has hands but cannot clap?",
    options: ["A clock", "A great oak tree", "A river", "A shadow"],
    correctIndex: 0,
    hint: "It tells you something quietly all day long.",
    correct: "Correct! The giant rubs his chin, quietly impressed.",
    wrong: "Nope! The giant's stomp rattles your teeth."
  },
  {
    question: "I have a head and a tail, but no body. What am I?",
    options: ["A coin", "A friendly serpent", "A shooting star", "A dragon"],
    correctIndex: 0,
    hint: "You would jingle me inside a royal purse.",
    correct: "Yes! The giant nods slowly, beaten by your wit.",
    wrong: "Not it! The giant bellows and stomps hard."
  },
  {
    question: "What gets wetter the more it dries?",
    options: ["A towel", "A stone", "A candle flame", "A mirror"],
    correctIndex: 0,
    hint: "You use me after a warm bath, your highness.",
    correct: "Spot on! The giant scratches his great big ear.",
    wrong: "Wrong! The giant guffaws and the ground trembles."
  },
  {
    question: "I am tall when I am young, and short when I am old. What am I?",
    options: ["A candle", "An old wizard", "A growing tree", "A mountain"],
    correctIndex: 0,
    hint: "I melt away as I give you light.",
    correct: "Perfect! The giant sighs, running low on riddles.",
    wrong: "Nope! The giant laughs and stamps his foot."
  },
  {
    question: "What has many rings but cannot hold a single thing?",
    options: ["A tree trunk", "A royal bell", "A heavy door", "A shield"],
    correctIndex: 0,
    hint: "Count my circles and you will know my age.",
    correct: "Wonderful! The giant's eyes go wide with surprise.",
    wrong: "Incorrect! The giant stamps and the tower quakes."
  }
];

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRiddles(count = 3) {
  return shuffleArray(RIDDLES).slice(0, count);
}

function isCorrect(riddle, selectedIndex) {
  return selectedIndex === riddle.correctIndex;
}

window.RIDDLES      = RIDDLES;
window.pickRiddles  = pickRiddles;
window.isCorrect    = isCorrect;
