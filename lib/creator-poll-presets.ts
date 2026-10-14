/** Collector conversation starters, separate from requests for future content. */
export const CREATOR_POLL_PRESETS = [
  {
    "id": "collector-style",
    "question": "What kind of collector are you?",
    "options": [
      "One favorite, all the editions",
      "The whole fictional cast",
      "Whatever matches my current read",
      "Rare pulls are my weakness",
      "A little bit of everything"
    ]
  },
  {
    "id": "reading-ritual",
    "question": "How do you usually meet your next obsession?",
    "options": [
      "Reading on my phone or Kindle",
      "An audiobook in my headphones",
      "A paperback with tabs everywhere",
      "Reading and listening together",
      "A friend who won’t stop talking about them"
    ]
  },
  {
    "id": "favorite-detail",
    "question": "What makes a character card an instant favorite?",
    "options": [
      "A likeness that feels right",
      "An outfit straight from the story",
      "An expression full of personality",
      "Details only a fellow fan would notice",
      "The whole card just hits"
    ]
  },
  {
    "id": "pack-ritual",
    "question": "What’s your pack-opening ritual?",
    "options": [
      "Slow reveal. Let me savor it.",
      "Straight to the foil",
      "Open everything, then admire",
      "Send my favorite pull to a friend",
      "One pack before I get back to my book"
    ]
  },
  {
    "id": "binder-style",
    "question": "How do you like to organize your binder?",
    "options": [
      "By series",
      "By favorite character",
      "By color and mood",
      "By rarity or finish",
      "Organized chaos"
    ]
  },
  {
    "id": "fictional-type",
    "question": "Which character energy gets you every time?",
    "options": [
      "The grumpy one with a soft spot",
      "The chaotic charmer",
      "The quietly devoted protector",
      "The clever troublemaker",
      "The sunshine with a backbone"
    ]
  },
  {
    "id": "showcase-style",
    "question": "What belongs at the center of your showcase?",
    "options": [
      "My current fictional obsession",
      "The whole found family",
      "My favorite couple",
      "My rarest pull",
      "A rotating cast of favorites"
    ]
  }
] as const;
