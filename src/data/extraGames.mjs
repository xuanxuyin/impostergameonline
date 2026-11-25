export const QUESTION_PAIRS = [
  { crew: 'What animal would be the funniest to keep as a pet?', imposter: 'What animal would you be most terrified to meet in the wild?', category: 'Animals' },
  { crew: 'What food could you happily eat every single day?', imposter: 'What food do you secretly think is overrated?', category: 'Food' },
  { crew: 'What is the best superpower to have in real life?', imposter: 'What is the most useless superpower imaginable?', category: 'Fun' },
  { crew: 'Where would you go for your dream vacation?', imposter: 'Where is the worst place to get stuck for a week?', category: 'Travel' },
  { crew: 'What movie have you rewatched the most times?', imposter: 'What movie put you to sleep halfway through?', category: 'Movies' },
  { crew: 'What is the first thing you buy if you win $10 million?', imposter: 'What is the dumbest thing people waste money on?', category: 'Money' },
  { crew: 'Who is a celebrity you would love to have dinner with?', imposter: 'Who is a celebrity you would never trust to drive your car?', category: 'Pop Culture' },
  { crew: 'What is your favorite school subject or class?', imposter: 'What class feels like it lasts 10 hours?', category: 'School' },
  { crew: 'What video game have you spent the most hours playing?', imposter: 'What game makes you rage quit the fastest?', category: 'Gaming' },
  { crew: 'What is the best midnight snack?', imposter: 'What is the weirdest thing to eat for breakfast?', category: 'Food' },
  { crew: 'What app on your phone could you not live without?', imposter: 'What app wastes way too much of your time?', category: 'Tech' },
  { crew: 'What job did you want when you were 8 years old?', imposter: 'What job would you definitely get fired from on day one?', category: 'Jobs' },
  { crew: 'What is the best holiday of the year?', imposter: 'What holiday is the most stressful?', category: 'Life' },
  { crew: 'What song instantly puts you in a good mood?', imposter: 'What song is stuck in your head way too often?', category: 'Music' },
  { crew: 'What sport is the most fun to play with friends?', imposter: 'What sport looks exhausting just to watch?', category: 'Sports' },
  { crew: 'What fictional world would you love to live in?', imposter: 'What fictional world would you not survive 24 hours in?', category: 'Movies' },
  { crew: 'What is the best fast-food restaurant?', imposter: 'What restaurant always forgets something in your order?', category: 'Food' },
  { crew: 'What is a hobby you really want to try someday?', imposter: 'What hobby sounds way too expensive?', category: 'Life' }
];

export const RANKING_PAIRS = [
  { crew: 'Rate how much you love eating Pizza (1 = Hate it, 10 = Obsessed)', imposter: 'Rate how much you love eating Broccoli (1 = Hate it, 10 = Obsessed)' },
  { crew: 'Rate how likely you are to survive a Zombie Apocalypse (1–10)', imposter: 'Rate how good you are at waking up on time (1–10)' },
  { crew: 'Rate how much you enjoy Roller Coasters (1–10)', imposter: 'Rate how much you enjoy doing Homework (1–10)' },
  { crew: 'Rate how good you are at keeping a secret (1–10)', imposter: 'Rate how loud you are when laughing (1–10)' },
  { crew: 'Rate how much you love Summer Break (1–10)', imposter: 'Rate how much you love Monday Mornings (1–10)' },
  { crew: 'Rate how brave you are in a Haunted House (1–10)', imposter: 'Rate how addicted you are to your phone (1–10)' },
  { crew: 'Rate how well you can cook a full meal (1–10)', imposter: 'Rate how fast you reply to text messages (1–10)' },
  { crew: 'Rate how much you like Spicy Food (1–10)', imposter: 'Rate how much you like Cold Weather (1–10)' },
  { crew: 'Rate how competitive you are at board games (1–10)', imposter: 'Rate how neat your bedroom is right now (1–10)' },
  { crew: 'Rate how much you would want to go to Space (1–10)', imposter: 'Rate how much you enjoy Public Speaking (1–10)' },
  { crew: 'Rate how good your taste in music is (1–10)', imposter: 'Rate how good your handwriting is (1–10)' },
  { crew: 'Rate how likely you are to cry at a sad movie (1–10)', imposter: 'Rate how likely you are to eat food off the floor (1–10)' },
  { crew: 'Rate how much you love Dogs (1–10)', imposter: 'Rate how much you love Spiders (1–10)' },
  { crew: 'Rate how much you trust yourself with $1,000 cash (1–10)', imposter: 'Rate how patient you are in slow Wi-Fi (1–10)' }
];

export const DAILY_PUZZLES = [
  {
    category: 'Food & Drinks',
    secretWord: 'Pizza',
    suspects: [
      { name: 'Nova', clue: 'Pepperoni', isImposter: false },
      { name: 'Blaze', clue: 'Delivery', isImposter: false },
      { name: 'Pixel', clue: 'Bowl', isImposter: true, reason: 'Pizza comes in a box or slices — not a bowl!' },
      { name: 'Echo', clue: 'Crust', isImposter: false }
    ]
  },
  {
    category: 'Movies & TV',
    secretWord: 'Spider-Man',
    suspects: [
      { name: 'Nova', clue: 'Gotham', isImposter: true, reason: 'Gotham is Batman\'s city — Spider-Man is from Queens, New York!' },
      { name: 'Blaze', clue: 'Webs', isImposter: false },
      { name: 'Pixel', clue: 'Queens', isImposter: false },
      { name: 'Echo', clue: 'Peter', isImposter: false }
    ]
  },
  {
    category: 'US Cities & Places',
    secretWord: 'Las Vegas',
    suspects: [
      { name: 'Nova', clue: 'Casino', isImposter: false },
      { name: 'Blaze', clue: 'Neon', isImposter: false },
      { name: 'Pixel', clue: 'Desert', isImposter: false },
      { name: 'Echo', clue: 'Subway', isImposter: true, reason: 'Las Vegas has no subway system — Echo was guessing New York!' }
    ]
  },
  {
    category: 'Animals',
    secretWord: 'Penguin',
    suspects: [
      { name: 'Nova', clue: 'Antarctica', isImposter: false },
      { name: 'Blaze', clue: 'Soaring', isImposter: true, reason: 'Penguins are flightless birds — they cannot soar!' },
      { name: 'Pixel', clue: 'Tuxedo', isImposter: false },
      { name: 'Echo', clue: 'Waddle', isImposter: false }
    ]
  },
  {
    category: 'Sports & Games',
    secretWord: 'Minecraft',
    suspects: [
      { name: 'Nova', clue: 'Creeper', isImposter: false },
      { name: 'Blaze', clue: 'Pickaxe', isImposter: false },
      { name: 'Pixel', clue: 'Nether', isImposter: false },
      { name: 'Echo', clue: 'Checkmate', isImposter: true, reason: 'Checkmate is from Chess, not Minecraft!' }
    ]
  },
  {
    category: 'School & Campus',
    secretWord: 'Chromebook',
    suspects: [
      { name: 'Nova', clue: 'Tabs', isImposter: false },
      { name: 'Blaze', clue: 'Charger', isImposter: false },
      { name: 'Pixel', clue: 'Chalk', isImposter: true, reason: 'Chalk belongs to a chalkboard, not a school Chromebook!' },
      { name: 'Echo', clue: 'Keyboard', isImposter: false }
    ]
  },
  {
    category: 'Food & Drinks',
    secretWord: 'Sushi',
    suspects: [
      { name: 'Nova', clue: 'Chopsticks', isImposter: false },
      { name: 'Blaze', clue: 'Seaweed', isImposter: false },
      { name: 'Pixel', clue: 'Oven', isImposter: true, reason: 'Sushi is served cold/raw — it does not go in an oven!' },
      { name: 'Echo', clue: 'Wasabi', isImposter: false }
    ]
  },
  {
    category: 'Movies & TV',
    secretWord: 'Harry Potter',
    suspects: [
      { name: 'Nova', clue: 'Lightsaber', isImposter: true, reason: 'Lightsabers are from Star Wars, not Harry Potter!' },
      { name: 'Blaze', clue: 'Wand', isImposter: false },
      { name: 'Pixel', clue: 'Hogwarts', isImposter: false },
      { name: 'Echo', clue: 'Owl', isImposter: false }
    ]
  },
  {
    category: 'Sports & Games',
    secretWord: 'Basketball',
    suspects: [
      { name: 'Nova', clue: 'Dunk', isImposter: false },
      { name: 'Blaze', clue: 'Goalie', isImposter: true, reason: 'Basketball has no goalie — Blaze was thinking of Soccer or Hockey!' },
      { name: 'Pixel', clue: 'Dribble', isImposter: false },
      { name: 'Echo', clue: 'Three-pointer', isImposter: false }
    ]
  },
  {
    category: 'Pop Culture',
    secretWord: 'TikTok',
    suspects: [
      { name: 'Nova', clue: 'Scroll', isImposter: false },
      { name: 'Blaze', clue: 'For-You', isImposter: false },
      { name: 'Pixel', clue: 'Trends', isImposter: false },
      { name: 'Echo', clue: 'Inbox', isImposter: true, reason: 'Inbox sounds like email — not a short-form video feed!' }
    ]
  }
];
