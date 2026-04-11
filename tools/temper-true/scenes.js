// ── SCENE DATA ────────────────────────────────────────────────────────────
// Each scene is an array of beats. A beat can be:
//   { type: 'prose', text: [...] }
//   { type: 'choices', items: [{ label, text, effect }] }
//   { type: 'manual-check', skill, dc, onSuccess, onFail }
//   { type: 'critical-check', name, desc, dc, onSuccess, onFail }

const SCENES = [

  // ── SCENE 0: TITLE (handled separately) ──

  // ── SCENE 1: Steam and Steel ──
  {
    id: 'scene1',
    label: 'Scene 1 · Session One',
    title: 'Steam and Steel',
    location: 'Trollskull Alley — Daylight',
    session: 1,
    beats: [
      {
        type: 'prose',
        text: [
          'Steam and Steel exhales through half-open shutters. The air tastes like hot iron and wet stone. Inside, the forge is a contained sun behind a brick hood — tongs hung by size, racks of half-finished tools, a quench trough that breathes faint mist even at rest.',
          'When you step in, the hammering stops on the second ring, not the first. Embric turns with a look that says he already decided how this will go, unless you change his mind for him. Avi wipes her hands once, then twice, like she is making space for a conversation that matters.',
          'You state your purpose plainly: fitted plate mail, lawful procurement, no exotic materials. You are here because you want to do it right and keep their name clean.',
        ]
      },
      {
        type: 'prose',
        text: [
          'They agree in principle. Then Avi produces a folded notice and a copied manifest page.',
          '"Their plate-grade steel is physically in the city," she says. "But flagged ON HOLD in harbor records. Registration irregularity, pending magister review. Fee assessment unresolved."',
          'Embric\'s voice is tight. "We can shape steel. We cannot shape paperwork."',
          'They need you to investigate. A smith showing up angry at the harbor looks suspicious. A Radiant Watch cleric can ask questions without sounding like a thug or a beggar.',
        ]
      },
      {
        type: 'manual-check',
        skill: 'Persuasion or Religion',
        baseDC: 13,
        successText: 'Your sincerity lands. Embric becomes cooperative. Avi offers extra detail — the hold language looks copy-pasted, like it came from a template used to stall. You note the clerk initials on the notice.',
        failText: 'They still take the job, but require a higher deposit. Avi is less forthcoming about the harbor details.',
        onSuccess: (state) => { state.tags.trust = 'up'; state.clues.a = true; },
        onFail: (state) => { state.tags.trust = 'neutral'; },
      },
      {
        type: 'choices',
        prompt: 'How do you frame your commitment to them?',
        items: [
          {
            label: 'A — "I take responsibility"',
            text: 'You acknowledge the dragonscale visit plainly and offer a corrective statement for their records.',
            effect: (state) => { state.tags.trust = 'up'; state.choices.scene1 = 'A'; },
          },
          {
            label: 'B — "We move fast because lives matter"',
            text: 'You emphasize urgency and protection, pushing for speed and asking what can be done while the steel is held.',
            effect: (state) => { state.choices.scene1 = 'B'; },
          },
          {
            label: 'C — "I will be your shield"',
            text: 'You offer to act as lawful witness with the harbor magister and the City Watch if needed.',
            effect: (state) => { state.tags.trust = 'up'; state.clues.a = true; state.choices.scene1 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      'They take your measurements anyway: chalk on cloth, cold tape across shoulder and chest, a quick check of how your shield arm moves.',
      'Embric says, almost grudging: "Bring us the release, and we will make you something that cannot be questioned."',
      'Avi adds, quieter: "And do not let anyone make you think urgency excuses dirt."',
      'You leave with papers in your pouch, and the sense that this is not only about armor.',
    ],
    llmContext: (state) => `George Ward, a Twilight Domain Cleric, just finished commissioning plate armor at Steam and Steel in Trollskull Alley. The smiths Embric and Avi revealed their steel shipment is on hold at the harbor due to manufactured bureaucratic interference. Tags: Shop Trust ${state.tags.trust}, Clue A ${state.clues.a ? 'found' : 'not found'}. George chose Branch ${state.choices.scene1 || 'none'}.`,
  },

  // ── SCENE 2: North Ward Threshold ──
  {
    id: 'scene2',
    label: 'Scene 2 · Session One',
    title: 'The North Ward Threshold',
    location: 'Trollskull Alley, Outside Steam and Steel — Blue Hour',
    session: 1,
    beats: [
      {
        type: 'prose',
        text: [
          'Late afternoon slips into blue hour. Lanterns are being lit one by one, warm pools on wet cobbles. Steam breathes from the smithy windows and curls into the cool air.',
          'As you step out, your priest collar catches lanternlight under your armor.',
          'A kid whispers too loudly: "That\'s him. The dragon-priest."',
          'The older neighbor answers, not unkind, just certain: "He brought dragon hide in here. Tried to buy a suit. That\'s the place."',
          'Avi\'s jaw tightens. Embric\'s hammering inside stops for one breath, then resumes louder than necessary.',
          'In ten minutes, this becomes illegal dragon armor. And that version is the one that reaches the harbor magister\'s clerk.',
        ]
      },
      {
        type: 'critical-check',
        name: 'Public Narrative',
        desc: 'Control the story now, or let the neighborhood write it for you. This check sets the tone for the entire investigation.',
        baseDC: 13,
        skill: 'Persuasion',
        onSuccess: (state) => { state.tags.narrative = 'clean'; },
        onFail: (state) => { state.tags.narrative = 'sour'; },
      },
      {
        type: 'choices',
        prompt: 'What do you do?',
        items: [
          {
            label: 'A — Public correction, one sentence',
            text: 'You step into a lantern pool, visible on purpose. You speak once, plain and controlled, then do not argue.',
            effect: (state) => { state.choices.scene2 = 'A'; },
          },
          {
            label: 'B — Say nothing, move fast',
            text: 'You leave immediately, letting the alley talk to itself. Efficient. Avoids a scene.',
            effect: (state) => { state.tags.narrative = 'sour'; state.choices.scene2 = 'B'; },
          },
          {
            label: 'C — Private reassurance to Embric and Avi',
            text: 'You stay at the doorway just long enough to speak to the makers, not the alley. Quiet, direct, no pleading.',
            effect: (state) => { if (state.tags.trust !== 'up') state.tags.trust = 'up'; state.choices.scene2 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      'The lanterns hold the boundary between warmth and cold, visibility and vulnerability.',
      'Behind you, Trollskull Alley settles into evening. Ahead, the harbor waits.',
    ],
    llmContext: (state) => `George just handled a public rumor situation in Trollskull Alley. Narrative tag is now ${state.tags.narrative === 'clean' ? 'CLEAN NARRATIVE' : 'SOUR NARRATIVE'}. He chose Branch ${state.choices.scene2 || 'none'}. ${state.tags.narrative === 'sour' ? 'The city is already telling a story about him that is not quite right.' : 'He controlled the story. The city heard the right version.'}`,
  },

  // ── SCENE 3: Radiant Heart Chapterhouse ──
  {
    id: 'scene3',
    label: 'Scene 3 · Session One',
    title: 'Structured Mercy',
    location: 'Radiant Heart Chapterhouse — Blue Hour',
    session: 1,
    beats: [
      {
        type: 'prose',
        text: [
          'The council chamber holds the day\'s chill. Lanternlight pools on a long oak table scarred with old candle burns. Tapestries show radiant knights — not triumphant. Just enduring.',
          'Wessalen watches you cross the threshold and waits until you have fully entered the lanternlight, as if the light itself is a boundary. When you finish your report, he lets the silence hang long enough for you to feel the weight of your own name in the city.',
          'He is not angry about the dragonscale incident. He is disappointed by what it could have become.',
          '"Good men are most vulnerable to being used when they are tired, urgent, and trying to do one more good thing quickly."',
        ]
      },
      {
        type: 'prose',
        text: [
          'He reveals that a charitable endowment recently offered to fund equipment was declined. The source was entangled with the Cassalanters. He states it like a weather report: influence arrives with a smile, and it always wants a return.',
          'Then he pivots. George still needs to be equipped. The Chapterhouse will not leave him exposed just to prove a point.',
          '"If someone offers you speed, ask what they want to own."',
        ]
      },
      {
        type: 'prose',
        text: [
          'He presents the cloak and tunic — not as generosity. As uniform and responsibility.',
          'A floor-length hooded cape of rich deep navy wool shot with silver threads like distant stars, edged in intricate gold embroidery. A crisp midnight-blue tunic centered with a bold golden sunburst emblem. A supple oiled leather belt.',
          'The old torn, faded rags have been fully replaced by this fresh, high-quality set.',
          '"Be seen, on purpose," Wessalen says quietly. "Or you will be seen, by accident."',
        ]
      },
      {
        type: 'choices',
        prompt: 'How do you accept — or refuse — what Wessalen offers?',
        items: [
          {
            label: 'A — Accept the cloak',
            text: 'George accepts the cloak and the conditions. Visibility as duty.',
            effect: (state) => { state.tags.letter = true; state.choices.scene3 = 'A'; },
          },
          {
            label: 'B — Refuse out of pride',
            text: 'Wessalen does not argue. "The city will narrate you for you." You leave without the cloak.',
            effect: (state) => { state.choices.scene3 = 'B'; },
          },
          {
            label: 'C — Accept and request a formal letter',
            text: 'You accept the cloak and also request a sealed letter of standing and a named witness.',
            effect: (state) => { state.tags.letter = true; state.choices.scene3 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      'As the last daylight fades, the chamber grows darker at the corners. Wessalen does not light more lanterns. He lets the room become honest.',
      '"Thresholds reveal people. You are most yourself when no one is watching. The city will test you by watching."',
    ],
    llmContext: (state) => `George met with Prelate Wessalen (he/him) at the Radiant Heart Chapterhouse. George ${state.tags.letter ? 'accepted the cloak and has Wessalen\'s formal backing' : 'refused the cloak and walks without institutional support'}. George's narrative tag is ${state.tags.narrative}. George chose Branch ${state.choices.scene3 || 'none'}.`,
  },

  // ── SCENE 4: Harbor Magister's Office ──
  {
    id: 'scene4',
    label: 'Scene 4 · Session One',
    title: "The Harbor Magister's Office",
    location: 'Great Harbor, Registry Desk — Afternoon',
    session: 1,
    beats: [
      {
        type: 'prose',
        text: [
          'A low, stone-front office on the edge of the Great Harbor. Everything smells like salt, tar, wet rope, and fish guts that never quite wash out. Inside: ink, damp wool, old paper. A barred counter. Two City Guard in red-and-black, halberds grounded, eyes moving.',
          'A clerk finds the manifest, then pauses. "This lot is under hold order. No release to guild pickup."',
          'He does not say why at first. If you bite, you look impatient. If you wait, you look disciplined.',
        ]
      },
      {
        type: 'manual-check',
        skill: 'Insight',
        baseDC: 12,
        successText: 'You notice the clerk hesitates only on this lot number. The hold language sounds copied from a template. This is not routine. This is targeted. The hold is a lever.',
        failText: 'It reads like ordinary customs friction. You cannot quite see the shape of it yet.',
        onSuccess: (state) => {},
        onFail: (state) => {},
      },
      {
        type: 'manual-check',
        skill: 'Investigation',
        baseDC: 15,
        successText: 'You spot it: the hold references a secondary docket labeled "charitable construction." A classification that has no business on a steel shipment. Clue B — the ledger reassignment.',
        failText: 'You know the hold is unusual but cannot identify the specific mechanism.',
        onSuccess: (state) => { state.clues.b = true; },
        onFail: (state) => {},
      },
      {
        type: 'prose',
        text: [
          'Inside the magister\'s chamber: a small, austere room. Heavy table, a single lantern, stacks of ledgers, a seal press. The magister does not stand. He simply looks up, and the room belongs to him.',
          'The official story: registration irregularities. A discrepancy between the ship\'s manifest and the receiving factor\'s declaration. Until re-verification, it cannot be released.',
          'What is really going on: the irregularity is minor and technical, the kind that normally resolves in a day. Here it is being treated as dangerous. That mismatch is the tell.',
        ]
      },
      {
        type: 'critical-check',
        name: 'Push for the Source',
        desc: 'Ask who initiated the hold and on what evidence. The truth of the interference depends on what George learns here.',
        baseDC: 14,
        skill: 'Persuasion',
        onSuccess: (state) => { state.clues.b = true; state.choices.scene4_truth = true; },
        onFail: (state) => { state.choices.scene4_truth = false; },
      },
      {
        type: 'choices',
        prompt: 'What do you pursue at the harbor?',
        items: [
          {
            label: 'A — Request re-verification scheduling',
            text: 'Ask for the earliest lawful inspection appointment. You get a written appointment note. Points toward the fee rounds.',
            effect: (state) => { state.choices.scene4 = 'A'; },
          },
          {
            label: 'B — Request chain-of-custody viewing rights',
            text: 'Ask to physically confirm the lot exists and hasn\'t been reassigned. Requires City Watch escort — Staget becomes relevant.',
            effect: (state) => { state.choices.scene4 = 'B'; },
          },
          {
            label: 'C — Push for the source of the hold',
            text: 'Ask who initiated the hold and on what evidence. Risk: if you are too sharp, the magister becomes colder.',
            effect: (state) => { state.choices.scene4 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      'As blue hour settles over the harbor, lanterns ignite along the quays. The water turns slate.',
      'The hold slip in your hand is a small, thin thing to weigh against a city this size.',
      'But it has a reference number. And reference numbers have sources.',
    ],
    isCliffhanger: true,
    llmContext: (state) => `George investigated at the harbor magister's office. Clue B is ${state.clues.b ? 'found — the charitable construction docket' : 'not yet found'}. He ${state.choices.scene4_truth ? 'pushed for the source of the hold and learned it was externally initiated' : 'did not learn who initiated the hold'}. His narrative is ${state.tags.narrative}, letter is ${state.tags.letter ? 'yes' : 'no'}.`,
  },

  // ── SCENE 5: Fee Rounds ──
  {
    id: 'scene5',
    label: 'Scene 5 · Session Two',
    title: 'Fee Rounds',
    location: 'Dock Ward Streets — Mulgor of Tyr',
    session: 2,
    beats: [
      {
        type: 'prose',
        text: [
          'The Dock Ward smells like tar, fish, wet rope, and hot iron from the shipwright yards. A small procession moves through a narrow street: a stout ink-stained clerk with a ledger case, two City Watch in plain working kit, and a broad-shouldered man in an immaculate tabard bearing Tyr\'s scales.',
          'Mulgor of Tyr, collector-of-fees, doing rounds. His authority is not volume. It is inevitability.',
          'He will ask you one question: "Are you here to understand the fee, or to argue it?"',
        ]
      },
      {
        type: 'manual-check',
        skill: 'Persuasion or Religion',
        baseDC: 12,
        successText: 'The clerk opens the ledger case. You see it: the charitable construction reference code, the initiating office stamp, and a secondary docket that has no business on a steel shipment. Clue B confirmed.',
        failText: 'The clerk stonewalls. "This is between the factor and the city." Mulgor watches you decide what kind of man you are in public.',
        onSuccess: (state) => { state.clues.b = true; },
        onFail: (state) => {},
      },
      {
        type: 'prose',
        text: [
          'As the clerk points at the line item, a well-dressed dock factor steps closer, all smiles.',
          '"If your smiths are in a bind, I can clear it today. Just a small administrative consideration."',
          'This is not the main antagonist. It is a lever. The city does not need to be corrupt for corruption to operate. It just needs friction.',
        ]
      },
      {
        type: 'choices',
        prompt: 'How do you resolve the fee?',
        items: [
          {
            label: 'A — Pay cleanly, document everything',
            text: 'Ask for the exact fee basis, pay at the window if legitimate, get a stamped receipt. Strongest integrity. Costs time.',
            effect: (state) => { state.choices.scene5 = 'A'; },
          },
          {
            label: 'B — Force a face-saving correction',
            text: 'Ask Mulgor to confirm the reclassification irregularity in front of the Watch escort. Witnessed. Speeds things up.',
            effect: (state) => { state.choices.scene5 = 'B'; },
          },
          {
            label: 'C — Call for Staget',
            text: 'Don\'t fix the fee here. Note the discrepancy and go to Staget to arrange chain-of-custody escort for the release.',
            effect: (state) => { state.choices.scene5 = 'C'; },
          },
          {
            label: 'D — Take the shortcut',
            text: 'Pay the "consideration." The lot releases quickly. Avi will test the steel later.',
            effect: (state) => { state.choices.scene5 = 'D'; },
          },
        ]
      },
    ],
    endProse: [
      'As the sun sinks, the Dock Ward lanterns flicker on. The fee procession pauses at a threshold between warm light and a darker alley mouth.',
      'George stands steady. That small shift in posture is power in the city.',
    ],
    llmContext: (state) => `George navigated the fee rounds with Mulgor of Tyr in the Dock Ward. The fee flag is charitable cargo reclassification — someone briefly filed Steel and Steam's steel under a charity docket to create a jurisdictional freeze. He chose Branch ${state.choices.scene5 || 'none'}. ${state.choices.scene5 === 'D' ? 'He took the shortcut. This will matter.' : 'He stayed clean.'} Narrative: ${state.tags.narrative}.`,
  },

  // ── SCENE 6: Captain Staget ──
  {
    id: 'scene6',
    label: 'Scene 6 · Session Two',
    title: 'Captain Staget',
    location: 'Dock Ward Streets — Blue Hour',
    session: 2,
    beats: [
      {
        type: 'prose',
        text: [
          'Staget\'s office is more ledger-and-duty-board than courtroom. He is at a desk with a duty board behind him. A runner waits with a sealed note. Staget breaks the seal, reads, sets it aside without expression.',
          'Then he gives you his full attention.',
          '"If this is about a hold, tell me what you need. And tell me what you are not telling me."',
        ]
      },
      {
        type: 'manual-check',
        skill: 'Persuasion',
        baseDC: 12,
        successText: 'Staget agrees to help with your specific request. His tone becomes formal but cooperative.',
        failText: 'Staget helps only minimally and requires you to demonstrate cleaner paperwork first.',
        onSuccess: (state) => {},
        onFail: (state) => {},
      },
      {
        type: 'manual-check',
        skill: 'Perception',
        baseDC: 13,
        successText: 'A watcher across the street. Clean-dressed, but you notice the collar mark — a sunburst variant you haven\'t seen before. You catch the hand-signal they use when checking in. Organized. Paid. Reporting upward. Clue C.',
        failText: 'The watcher goes unnoticed. Clue C is not found here.',
        onSuccess: (state) => { state.clues.c = true; },
        onFail: (state) => {},
      },
      {
        type: 'prose',
        text: [
          'A Watch sergeant mentions offhand that a different lot could be purchased today from a dockside broker. Same dimensions, same weight, no waiting.',
          'Staget\'s eyes flick to you for half a second. He says nothing.',
          'That silence is the test.',
        ]
      },
      {
        type: 'choices',
        prompt: 'What do you ask of Staget?',
        items: [
          {
            label: 'A — Lawful witness and escort',
            text: 'Ask for Watch escort when the hold is lifted and the lot moves. Staget assigns 2-4 Watch to the transfer.',
            effect: (state) => { state.choices.scene6 = 'A'; },
          },
          {
            label: 'B — Chain-of-custody certification',
            text: 'Ask for a Watch document stating the lot was released lawfully and transferred intact.',
            effect: (state) => { state.choices.scene6 = 'B'; },
          },
          {
            label: 'C — Quiet lead on the right desk',
            text: 'Ask who in Dock Ward is known for misfiling manifests and who benefits. Staget gives you a pattern, not names.',
            effect: (state) => { state.choices.scene6 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      '"Do it clean, Brother," Staget says as you leave. "In this ward, clean is the rarest steel."',
    ],
    llmContext: (state) => `George met with Captain Staget in the Dock Ward. Clue C is ${state.clues.c ? 'found — organized surveillance with a Cassalanter-adjacent sunburst mark' : 'not found'}. He chose Branch ${state.choices.scene6 || 'none'}. All three clues status: A=${state.clues.a}, B=${state.clues.b}, C=${state.clues.c}.`,
  },

  // ── SCENE 7: Steel Trial ──
  {
    id: 'scene7',
    label: 'Scene 7 · Session Two',
    title: 'The Steel Trial',
    location: 'Steam and Steel, Fitting Room — Evening',
    session: 2,
    beats: [
      {
        type: 'prose',
        text: [
          'The back room behind the shop floor: half fitting chamber, half finishing space. A standing mirror with scorch marks on the frame. Chalk lines on the floor where armor pieces lay in order.',
          'Lanternlight catches polished test coupons. The air smells like oiled leather, coal smoke, and wet stone from Avi\'s quench basin.',
          'Avi measures you again even if she already did. Tape at the collar line, shoulder breadth, waist, hip, thigh, knee.',
          'Embric\'s question sounds like bravado. "You still want this clean?"',
        ]
      },
      {
        type: 'prose',
        text: [
          'Avi lays it out without drama.',
          '"George. If we use steel we cannot prove, you do not get plate. You get a story someone else can own. And I do not let my shop become the place where Radiant Watch learned to bend."',
          'Embric, quieter than usual: "And if you want it rushed, there are people who will rush it. They will also name the price later."',
        ]
      },
      {
        type: 'critical-check',
        name: 'The Steel Trial',
        desc: 'Avi tests the lot with ring, spark, and bite. The result determines whether the armor is clean — and what the temper-blue means.',
        baseDC: 13,
        skill: 'The Steel\'s Integrity',
        onSuccess: (state) => { state.tags.lot = 'clean'; },
        onFail: (state) => { state.tags.lot = 'shortcut'; },
      },
      {
        type: 'choices',
        prompt: 'What is your answer to Avi?',
        items: [
          {
            label: '1 — Refuse the shortcut, wait for verified steel',
            text: 'George chooses delay, scrutiny, and duty over speed. The armor will mean something.',
            effect: (state) => { state.tags.lot = 'clean'; state.choices.scene7 = '1'; },
          },
          {
            label: '2 — Accept questionable steel',
            text: 'George chooses speed. Embric is conflicted. Avi is not angry. She is disappointed, which is worse.',
            effect: (state) => { if (state.tags.lot !== 'clean') state.tags.lot = 'shortcut'; state.choices.scene7 = '2'; },
          },
          {
            label: '3 — Third path: lawful pressure',
            text: 'Refuse the shortcut but take an assertive lawful move — bring Staget, use Wessalen\'s letter, or demand immediate adjudication.',
            effect: (state) => { state.tags.lot = 'clean'; state.choices.scene7 = '3'; },
          },
        ]
      },
    ],
    endProse: [
      'Avi times the final test quench to the moment the street lanterns outside click on.',
      '"People will see this armor under lanternlight," she says. "Truth should survive that lighting."',
    ],
    llmContext: (state) => `George faced the moral crisis of the steel trial at Steam and Steel. Steel is ${state.tags.lot === 'clean' ? 'CLEAN — verified and honest' : 'COMPROMISED — shortcut taken'}. He chose Branch ${state.choices.scene7 || 'none'}. ${state.tags.lot === 'shortcut' ? 'The Cassalanters now have a plausible claim on George\'s equipment.' : 'The armor will be made clean.'} All tags: narrative=${state.tags.narrative}, trust=${state.tags.trust}, letter=${state.tags.letter}, lot=${state.tags.lot}.`,
  },

  // ── SCENE 8: The 310°C Rite ──
  {
    id: 'scene8',
    label: 'Scene 8 · Session Two',
    title: 'The 310°C Rite',
    location: 'Steam and Steel, Forge Room — Night',
    session: 2,
    beats: [
      {
        type: 'prose',
        text: [
          'The forge is not roaring tonight. It is disciplined. Embric\'s fire is banked low, fed in measured breaths. Avi has set three lanterns around the workbench so the light falls clean across the edges.',
          'The steel plates hang on hooks like a row of silent judges.',
          'When Embric taps the cuirass with the hammer head, it answers with a bright, true ring that carries into the rafters. Avi listens longer than seems necessary, then nods once.',
        ]
      },
      {
        type: 'prose',
        text: [
          'Avi asks you to step to the front threshold with her. Trollskull Alley is quiet. The line where lanternlight ends and night begins cuts across the cobbles like a blade.',
          '"This is the part where stories attach themselves. Decide what story you\'re willing to wear."',
          state => state.clues.c
            ? 'A figure across the alley pauses just long enough to be noticed. You recognize the collar mark. The same organized watcher from the Dock Ward. No confrontation. Just pressure.'
            : 'A figure across the alley pauses just long enough to be noticed, then moves on.',
        ]
      },
      {
        type: 'prose',
        text: [
          'Avi: "310 is not a color number. It is the line where the steel becomes what it claims to be. Hard enough to endure. Tempered enough not to break. If we miss it, it will still be armor. It will not be honest armor."',
          'Embric heats the edges in controlled passes. The plates warm into a quiet, restrained heat. The sound changes first — hammer on steel becomes tighter, clearer, as if the metal is learning to sing in tune.',
          'Avi watches edge color under lanternlight, not forge glare. She calls time like a surgeon.',
          'A faint bloom appears along the bevel, then deepens. Blue, vivid, precise — like twilight caught in metal.',
          'She quenches with a measured curtain of water. Steam rolls up, white and heavy, smelling of hot iron and clean rain. When the steam clears, the edge tint remains: a disciplined temper blue that looks earned, not painted.',
        ]
      },
      {
        type: 'prose',
        text: [
          'Inside the cuirass, near the heart-side seam, Avi etches a paired maker\'s mark alongside the guild temper code "310."',
          state => state.tags.lot === 'clean'
            ? 'The mark is awarded. Once per tenday, when George openly presents it while truthfully establishing legality or correcting rumors, he gains advantage on one Persuasion check for that purpose.'
            : 'The mark is withheld pending re-verification of the steel. That is the cost of expediency.',
          'A polite intermediary appears just inside the doorway with a practiced smile. "It\'s good to see the city taking care of its heroes."',
          'They are trying to make this sound like patronage.',
        ]
      },
      {
        type: 'choices',
        prompt: 'How do you answer the intermediary?',
        items: [
          {
            label: 'A — One-sentence denial',
            text: '"Steam and Steel made this. Lawfully. Paid in full." Then stop talking.',
            effect: (state) => { state.choices.scene8 = 'A'; },
          },
          {
            label: 'B — Let it slide',
            text: 'Peace now. Leverage later. The Cassalanter claim persists.',
            effect: (state) => { state.choices.scene8 = 'B'; },
          },
          {
            label: 'C — Invite scrutiny',
            text: 'Ask Staget or the clerk to note chain-of-custody and payment. Strongest shield. You accept public attention.',
            effect: (state) => { state.choices.scene8 = 'C'; },
          },
        ]
      },
    ],
    endProse: [
      'You lift the cuirass. The lanternlight catches the temper-blue edges and holds them like a promise.',
      'Steam drifts up as Avi sets the last rivet. Embric\'s hammer taps once, twice, then stops.',
      'Silence. Not emptiness. Completion.',
      'On the threshold, blue hour has deepened into night. You step into it wearing something honest.',
    ],
    llmContext: (state) => `The 310°C tempering rite is complete. The temper-blue edge tint is set. Steel: ${state.tags.lot}. Maker's mark: ${state.tags.lot === 'clean' ? 'awarded' : 'withheld'}. George answered the Cassalanter narrative hook with Branch ${state.choices.scene8 || 'none'}. Full tags: ${JSON.stringify(state.tags)}.`,
  },

  // ── SCENE 9: Epilogue ──
  {
    id: 'scene9',
    label: 'Scene 9 · Session Two',
    title: 'Seen in the Blue',
    location: 'North Ward Streets, Toward the Chapterhouse — Night',
    session: 2,
    beats: [
      {
        type: 'prose',
        text: [
          'You feel the plate settle. Not heavy. Final. Like a decision.',
          'The temper-blue edge tint catches lanternlight in thin lines — a dusk-colored blade along every seam. It is beautiful in a way that makes you visible.',
          'Steam from a nearby vent drifts across the street and beads on polished steel. The cloak\'s navy wool drinks the cold, silver threads winking like distant stars when you move.',
          state => state.clues.c
            ? 'A cream paper card arrives, no signature. Only a sunburst watermark variant and a single line: "Waterdeep supports those who support Waterdeep." It reads like praise. It feels like a hand on a collar.'
            : 'Someone nearby repeats, barely audible: "He got that because the nobles are funding the Watch now." You hear how easily the city turns integrity into ownership.',
        ]
      },
      {
        type: 'manual-check',
        skill: 'Insight',
        baseDC: 14,
        successText: 'You clock the hook — the note, the seal, the bystander — without spiraling. You file it as evidence, not threat. Yet.',
        failText: 'The hook lands as unsettling but unnamed. You will think about it tonight.',
        onSuccess: (state) => {},
        onFail: (state) => {},
      },
      {
        type: 'choices',
        prompt: 'How do you carry this forward?',
        items: [
          {
            label: 'A — Public credit, one sentence',
            text: '"Steam and Steel made this lawfully, and I wear it to keep people alive." Rumors lose oxygen.',
            effect: (state) => { state.tags.credit = true; state.choices.scene9 = 'A'; },
          },
          {
            label: 'B — Silence, keep moving',
            text: 'No immediate friction. The rumor persists. A future scene starts with someone believing the worst version.',
            effect: (state) => { state.choices.scene9 = 'B'; },
          },
          {
            label: 'C — Formal report to Wessalen',
            text: 'George returns to Wessalen and reports the supply-chain interference. A sanctioned inquiry, not vigilantism.',
            effect: (state) => { state.tags.credit = true; state.choices.scene9 = 'C'; },
          },
          {
            label: 'D — Watch alliance',
            text: 'George meets Staget to close the loop. A stable law contact for future Cassalanter moves.',
            effect: (state) => { state.tags.credit = true; state.choices.scene9 = 'D'; },
          },
        ]
      },
    ],
    endProse: [
      'You reach a darker stretch between lanterns. For a second, the city is only wet stone and distant voices.',
      'The temper-blue edges glow faintly in reflected light. Not magical. Just honest.',
      'You realize the armor does not make you harder to kill.',
      'It makes you harder to misrepresent.',
      'If you are willing to be seen.',
    ],
    isFinal: true,
    llmContext: (state) => `Temper-True is complete. Final state: ${JSON.stringify(state.tags)}. Clues found: ${JSON.stringify(state.clues)}. George chose Branch ${state.choices.scene9 || 'none'} for his epilogue. ${state.tags.lot === 'clean' ? 'The armor is honest. The maker\'s mark is earned.' : 'The steel was compromised. The mark awaits re-verification.'} ${state.tags.credit ? 'George took public credit. The Cassalanter claim is weakened.' : 'George stayed silent. The Cassalanter hook remains live.'}`,
  },
];
