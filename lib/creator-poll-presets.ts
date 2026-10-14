/** Editable starting points for new polls; never seed or publish database records. */
export const CREATOR_POLL_PRESETS = [
  {
    id: "next-obsession",
    question: "What should we collect next?",
    options: ["Sports romance", "Dark romance", "Fantasy romance", "Cozy fantasy", "LitRPG & progression fantasy"],
  },
  {
    id: "cast-spotlight",
    question: "Which fictional cast deserves more of the spotlight?",
    options: ["Warlock", "Coven King", "Into Darkness", "Ruinous Love", "Slaycation", "Off-Campus"],
  },
  {
    id: "artwork-vibe",
    question: "What kind of character artwork would you love to collect?",
    options: ["Cozy nights in", "Dressed up & dangerous", "Everyday off-duty moments", "Epic fantasy scenes", "Playful & flirty portraits"],
  },
  {
    id: "portrait-moment",
    question: "Which character moment belongs in your binder?",
    options: ["A quiet reading break", "A confident walk toward you", "A relaxed seat by the window", "A mischievous over-the-shoulder glance", "A dramatic mid-action moment"],
  },
  {
    id: "collection-priority",
    question: "What makes a character card an instant favorite?",
    options: ["A likeness that feels right", "An outfit straight from the story", "A memorable setting", "An expression full of personality", "Details only a fellow fan would notice"],
  },
  {
    id: "studio-style",
    question: "What’s your favorite way to show off your collection?",
    options: ["One favorite in the spotlight", "A whole fictional cast", "A matching color palette", "A moodboard of my current obsessions", "A showcase of my rarest pulls"],
  },
] as const;
