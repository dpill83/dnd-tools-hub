const SCENES = {

  start: {
    eyebrow: "Strong Start",
    title: "Viktor Receives the Note",
    subtitle: "Zephyr Post, early evening, Waterdeep",
    sections: [
      {
        type: "strong-start-image"
      },
      {
        type: "body",
        content: "Open by asking each player where their character is and what they're doing. Let them answer. Then turn to Ted."
      },
      {
        type: "read-aloud",
        text: "Viktor. A small bird lands on the windowsill beside you — sky-blue ribbon on its leg. Zephyr Post. A note, folded tight, is tied to the ribbon.",
        wtyd: "What do you do?"
      },
      {
        type: "section-title",
        text: "George's Note"
      },
      {
        type: "note-image"
      },
      {
        type: "body",
        content: "Hand the printed note prop to Ted, or read it aloud in George's voice — measured, careful, a man choosing his words because he knows some walls have ears. The note directs them to follow up with Durnan at the Yawning Portal in the Dock Ward."
      },
      {
        type: "section-title",
        text: "Key Points in the Note"
      },
      {
        type: "clues",
        items: [
          "George spotted two men matching Viktor's description of Brahm and Joss leaving the House of Gems on Gem Street.",
          "He followed them to the Yawning Portal in the Dock Ward.",
          "Durnan told him they've been lurking about, speaking to people.",
          "George cannot investigate himself — urgent matter related to the Radiant Watch seal.",
          "Signed: Walk in the light, George."
        ]
      }
    ]
  },

  scene1: {
    eyebrow: "Scene 1",
    title: "Arrival at the Yawning Portal",
    subtitle: "Dock Ward — approaching from the street",
    sections: [
      { type: "scene-image", src: "scene1.png" },
      {
        type: "read-aloud",
        text: "The Dock Ward smells like salt and cold stone. Across the street, a narrow shopfront — Mira's Alchemical Sundries, the gilt lettering faded above the door — has been cordoned off with City Watch tape. The door hangs open. An officer leans against the wall outside with the particular stillness of a man running on no sleep, his uniform rumpled, his eyes half-closed. Beside him, close and low, Captain Staget talks quietly — one hand on the officer's shoulder. Not giving orders. Listening.",
        wtyd: "Do you approach Staget first, or head inside the Portal?"
      },
      {
        type: "section-title",
        text: "What They Can See"
      },
      {
        type: "clues",
        items: [
          "City Watch tape across Mira's Alchemical Sundries. Third burglary this tenday.",
          "Captain Staget — familiar face, City Watch, known to the party.",
          "The Yawning Portal across the street, busy as always.",
          "Dock Ward foot traffic, sailors, merchants, nobody paying much attention."
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "skilltable",
        rows: [
          {
            skill: "Perception",
            dc: "11",
            result: "The shop window has been recently cleaned from the inside — someone wiped it down after the theft."
          },
          {
            skill: "Investigation",
            dc: "12",
            result: "The Watch tape was applied hastily. Staget was inside for a while before he cordoned it off. Whatever he found, he looked at it carefully first."
          },
          {
            skill: "Insight (on Staget)",
            dc: "13",
            result: "He's not just working a burglary. He's worried this connects to something bigger and he's deciding how much to tell them."
          },
          {
            skill: "History / Streetwise",
            dc: "12",
            result: "The Tithemans is a street name that's been floating around the Dock Ward for a few months. Nobody knows who runs it."
          }
        ]
      }
    ]
  },

  staget: {
    eyebrow: "Scene 1 Branch",
    title: "Captain Staget",
    subtitle: "Outside Mira's Alchemical Sundries",
    sections: [
      {
        type: "npc",
        name: "Captain Hyustus Staget",
        role: "City Watch, Known Ally",
        want: "Handle this cleanly. No more incident reports that go nowhere.",
        voice: "Professional and tired. Trusts the party more than he lets on. Genuinely wants to help people.",
        keyline: "Bring them in breathing if you can manage it. I've got enough paperwork."
      },
      {
        type: "section-title",
        text: "What Staget Tells Them"
      },
      {
        type: "body",
        content: "Staget has been working the burglary case for a tenday. Three alchemist shops hit, all precise, nothing taken but specific reagents. His men are covering the hit shops and the higher-priority targets. He's stretched thin."
      },
      {
        type: "ifthen",
        items: [
          { condition: "They ask what was stolen", result: "Sulphur salts, concentrated vitriol, powdered dragonthorn bark across the three shops. One shop also lost stone-eye jelly — basilisk-derived. That one bothers him. He doesn't know what it's for." },
          { condition: "They ask about suspects", result: "Nothing solid. Whoever's doing this knows exactly what they want and how to get in without making a mess. Not street thieves." },
          { condition: "They mention Brahm and Joss", result: "He doesn't know those names but he writes them down. Asks for descriptions. Says if they turn up anything, bring them in breathing." },
          { condition: "They ask how they can help", result: "He gets to Cinderfang. A customs broker contact flagged a manifest — one item matching the stolen reagent list came through the docks a few days ago, stored at Cinderfang Warehouse on the south side of the Dock Ward. Not enough for a warrant. Would appreciate unofficial eyes on it tonight." }
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "checks",
        items: [
          { dc: "DC 12 Insight", desc: "Staget is genuinely worried. This isn't routine. He's seen organized crime before and this feels organized." },
          { dc: "DC 14 Persuasion", desc: "He shares the name of a second unhit shop if they push him — Pendleton's Fine Reagents on Copper Street." }
        ]
      }
    ]
  },

  portal: {
    eyebrow: "Scene 2",
    title: "The Yawning Portal",
    subtitle: "Common room — Dock Ward",
    sections: [
      {
        type: "location",
        aspects: [
          "The great well in the center of the floor, rope and darkness, ignored by regulars who stopped finding it remarkable years ago.",
          "Noise of a hundred conversations, clinking tankards, a fight that almost happened in the corner an hour ago and hasn't quite settled.",
          "Durnan behind the bar, wiping a tankard he's wiped a hundred times, watching everything without appearing to watch anything."
        ]
      },
      {
        type: "read-aloud",
        text: "The Yawning Portal. A hundred meals, twice as many arguments, the smell of both still in the air. The great well in the center of the floor drops into darkness — the regulars stopped looking at it years ago. Behind the bar, Durnan wipes a tankard he's wiped a hundred times today, watching everything without appearing to watch anything.",
        wtyd: "How do you approach Durnan?"
      },
      {
        type: "npc",
        name: "Durnan",
        role: "Barkeep, Yawning Portal",
        want: "Keep the Portal out of trouble. See nothing officially.",
        voice: "Slow, economical, never asks a question he doesn't already know the answer to.",
        keyline: "I run a bar, not a watch post. But I hear things."
      },
      {
        type: "section-title",
        text: "What Durnan Knows"
      },
      {
        type: "ifthen",
        items: [
          { condition: "They describe Brahm and Joss", result: "He remembers them. Two hard men, not from the city originally. Been coming in for a couple of weeks. Meet someone, talk quietly, leave. He doesn't ask questions. One of them dropped a name once: the Tithemans." },
          { condition: "They ask about the woman", result: "He pauses. A woman, a few times. Elegant. Sinister smile, like she found something funny nobody else could see. Came in alone more often than with the men. Doesn't know her name." },
          { condition: "They ask about the alchemist burglaries", result: "Word gets around. Whoever's doing it knows the trade. Not smash and grab — surgical. Suggests they talk to Mira Coppervan directly. She's furious and she's the most recent victim." },
          { condition: "They offer coin for information", result: "He takes it. Adds that Brahm and Joss were here two nights ago. Left in a hurry heading south toward the waterfront." }
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "checks",
        items: [
          { dc: "DC 13 Persuasion", desc: "Durnan gives up the Tithemans name without being paid." },
          { dc: "DC 15 Insight", desc: "The woman Durnan describes — sinister smile, elegant, sometimes alone — the party recognizes this matches Sella." }
        ]
      }
    ]
  },

  scene3: {
    eyebrow: "Scene 3",
    title: "Mira Coppervan's Workshop",
    subtitle: "Mira's Alchemical Sundries — crime scene",
    sections: [
      { type: "scene-image", src: "scene3.png" },
      {
        type: "location",
        aspects: [
          "Sharp chemical smell of spilled reagents, faint and wrong in the air like something that should be contained.",
          "Overturned shelving along the back wall, shattered glass ground into the floorboards.",
          "The shelves along the far wall are undisturbed — everything exactly where Mira left it, except what's gone."
        ]
      },
      {
        type: "read-aloud",
        text: "The workshop is a controlled disaster. Overturned shelving, shattered glass ground into the floorboards, the sharp chemical smell of something spilled that should have stayed contained. Mira Coppervan stands at the back counter — ink-stained fingers, jaw set, moving through her stock list with a quill that presses harder than it needs to.",
        wtyd: "How do you approach her?"
      },
      {
        type: "npc",
        name: "Mira Coppervan",
        role: "Robbed Alchemist",
        want: "Get her shop made safe and her reagents back. Understand what was taken and why.",
        voice: "Controlled fury. Meticulous. Gives information like she's filing it — organized and precise.",
        keyline: "I know every bottle in this room. I know what's missing."
      },
      {
        type: "section-title",
        text: "If / Then"
      },
      {
        type: "ifthen",
        items: [
          { condition: "They ask what was stolen", result: "She reads from her list: sulphur salts, vitriol concentrate, dragonthorn bark powder. Then she stops. The last item — stone-eye jelly, basilisk-derived — bothers her most. Expensive, controlled, not something used in anything she'd sell legally. She doesn't know what it's for." },

          { condition: "They ask about other shops", result: "Names two: Aldric's Reagents on Candle Lane and the Copper Crucible near the Dock Ward. Staget can add Cinderfang Warehouse to the list." },
          { condition: "They ask if anyone cased the shop", result: "DC 13 Investigation in the shop. She mentions a boy, maybe twelve or thirteen, came in three days ago asking about dragonthorn bark prices. She thought he was running an errand for someone." }
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "skilltable",
        rows: [
          {
            skill: "Investigation",
            dc: "13",
            result: "The shattered glass on the floor was broken from the inside — something was knocked over during the theft, not at the point of entry. Whoever did this was already in."
          },
          {
            skill: "Investigation",
            dc: "15",
            result: "The stolen reagents — sulphur salts, vitriol concentrate, dragonthorn bark — are consistent with an explosive compound when combined. The stone-eye jelly doesn't fit that formula at all. It was stolen for something else entirely."
          },
          {
            skill: "Arcana",
            dc: "15",
            result: "The combination of reagents could produce something far more dangerous than alchemist's fire. In the right concentrations, triggered correctly, this could bring down a building."
          },
          {
            skill: "Perception",
            dc: "13",
            result: "Outside the back entrance, faint scrape marks on the sill consistent with a small person climbing through. A child, maybe."
          },
          {
            skill: "Insight (on Mira)",
            dc: "12",
            result: "She's not just angry about the theft. She's frightened. She knows what these reagents can do together and she doesn't want to say it out loud."
          }
        ]
      }
    ]
  },

  stakeout: {
    eyebrow: "Scene 4",
    title: "Cinderfang Warehouse",
    subtitle: "South side, Dock Ward — stake out",
    sections: [
      { type: "scene-image", src: "CinderfangWarehouse.png" },
      {
        type: "location",
        aspects: [
          "A massive stone building near the waterfront, several stories of stacked crates and iron-banded doors.",
          "Smell of salt water, tar, and the faint mineral tang of stored goods. Torches at the main entrance, darkness around the sides.",
          "Two side entrances, both locked. Loading dock faces the water. The building is quiet — at least from out here."
        ]
      },
      {
        type: "body",
        content: "Staget's customs contact flagged a manifest with one item matching the stolen reagent list — stone-eye jelly — stored somewhere in Cinderfang. Not enough for a warrant. The party is here unofficially."
      },
      {
        type: "read-aloud",
        text: "Cinderfang Warehouse. Massive, stone-faced, iron-banded, squatting at the waterfront like it grew there. The smell of salt water and stored goods in the cold air. Somewhere out on the harbor a bell rings once. The torches at the main entrance throw orange light across the cobblestones. Beyond that, dark.",
        wtyd: "You have eyes on the place. How are you positioned? And what are you doing while you wait?"
      },
      { type: "clockcontrol" },
      {
        type: "section-title",
        text: "DM: The Night Watchman"
      },
      {
        type: "body",
        content: "There is a night watchman. The party doesn't know this yet — let them find out through play. He appears on a Perception DC 13 or as part of a stakeout event roll. If the players asked Staget about the warehouse before coming, he may have mentioned it; otherwise it's a discovery. When he does appear, the interesting question isn't will he stop us — they can invoke Watch authority and he'll back off. It's will he mention this to someone tomorrow? Let that paranoia sit with the players."
      },
      {
        type: "section-title",
        text: "Stakeout Events Table"
      },
      { type: "stakeout-table" },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "skilltable",
        rows: [
          { skill: "Perception", dc: "11", result: "Something moves near the south wall — a figure with a lantern, making a slow circuit of the building. A night watchman. He hasn't seen you yet." },
          { skill: "Stealth", dc: "12", result: "Stay hidden as the watchman passes your position. Failure: he slows, squints in your direction — not alarmed yet, but aware." },
          { skill: "Perception", dc: "13", result: "Notice the kids approaching from the water-side loading dock — not the main entrance you've been watching." },
          { skill: "Insight (if watchman found)", dc: "11", result: "He knows they're Watch-adjacent. He's relieved, not suspicious. He just wants to finish his shift without trouble." },
          { skill: "Investigation", dc: "14", result: "The loading dock latch has been oiled recently. Quietly, and recently. Someone prepared this entrance." }
        ]
      }
    ]
  },

  scene4: {
    eyebrow: "Scene 5",
    title: "The Kids Arrive",
    subtitle: "Cinderfang Warehouse — side entrance",
    sections: [
      {
        type: "read-aloud",
        text: "Movement in the alley to the east. Three figures, small, moving quietly along the wall. They stop at the side entrance. One of them looks up and down the street. Another crouches at the door. The third hangs back, holding something.",
        wtyd: "What do you do?"
      },
      {
        type: "body",
        content: "This is the moment the tone shifts. The party expected Brahm and Joss. They got children. Let that land before anyone does anything."
      },
      {
        type: "section-title",
        text: "The Three Kids"
      },
      {
        type: "npc",
        name: "Brin",
        role: "Lookout — oldest, de facto leader",
        want: "Keep Sal and Patch safe. Deliver for Ezrin. Doesn't trust strangers.",
        voice: "Defiant when cornered. Protective. Won't give up names but will fold if Sal or Patch is threatened.",
        keyline: "We weren't doing anything. And I don't know who you are."
      },
      {
        type: "npc",
        name: "Sal",
        role: "Lock kid — the technician",
        want: "Finish the job right. Treat it like a puzzle, not a crime.",
        voice: "Quiet and focused. Doesn't panic. More likely to talk than Brin if approached calmly.",
        keyline: "It's a seven-pin tumbler. Give me thirty seconds."
      },
      {
        type: "npc",
        name: "Patch",
        role: "Bag kid — youngest, most nervous",
        want: "Get this over with. Go home. Stop shaking.",
        voice: "Jumpy. Talks too much when scared. Most likely to crack under any pressure at all.",
        keyline: "Brin said it would be fine. Brin said nobody would see us."
      },
      {
        type: "section-title",
        text: "Positions"
      },
      {
        type: "clues",
        items: [
          "Brin (lookout, northeast corner): quick eyes, ready to bolt. DC 13 Stealth to approach without being spotted.",
          "Sal (at the door): focused on the lock, doesn't look up. Leather case of picks. Doesn't notice anything Brin doesn't flag.",
          "Patch (waiting with the bag): nervous, shifting weight. Already has something in the bag from a prior stop. First to drop it and run."
        ]
      },
      {
        type: "section-title",
        text: "If / Then"
      },
      {
        type: "ifthen",
        items: [
          { condition: "They grab Brin quietly", result: "Sal and Patch don't notice immediately. Brin is terrified, then defiant. Won't give names. But their satchel has a torn note: Coppel & Sons, Three Daggers Alley. Back room. Leave the bag." },
          { condition: "They follow all three inside", result: "The kids know exactly where to go — third row, northeast section, two specific crates marked with chalk. They fill the bag with reagent bottles. Following them out leads directly to Three Daggers Alley." },
          { condition: "They spook the kids and they bolt", result: "Patch drops the canvas bag. Inside: several reagent bottles and the same torn note with the Three Daggers Alley address." },
          { condition: "They confront all three openly", result: "Kids scatter in different directions. DC 13 Athletics to catch any of them. Caught kid eventually gives up the address when frightened enough or offered safety." },
          { condition: "They let them complete the theft and tail them", result: "Kids move efficiently through the Dock Ward to Three Daggers Alley. Don't check for a tail. DC 11 Stealth to follow without being noticed." }
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "checks",
        items: [
          { dc: "DC 13 Stealth", desc: "Approach the lookout without being spotted." },
          { dc: "DC 13 Athletics", desc: "Chase and catch a fleeing kid." },
          { dc: "DC 12 Persuasion", desc: "Convince a caught kid they're not in trouble. On success, the kid gives up the address voluntarily." },
          { dc: "DC 14 Insight", desc: "These kids aren't street thieves. They're following very specific instructions from someone they trust." }
        ]
      }
    ]
  },

  grab: {
    eyebrow: "Scene 4 Branch",
    title: "Grab a Kid",
    subtitle: "Cinderfang alley — quick intervention",
    sections: [
      {
        type: "body",
        content: "If they grab Brin quietly, Sal and Patch don't immediately notice. DC 13 Stealth to do it silently. Brin is terrified, then defiant. Won't give names at first — but Patch will if they get to her."
      },
      {
        type: "ifthen",
        items: [
          { condition: "They threaten the kid", result: "Clams up completely. Will not talk. Stares at them." },
          { condition: "They offer safety or ask gently", result: "DC 12 Persuasion. On success: admits they were told where to go and what to take. Doesn't know who hired them, only a boy named Ezrin at the old Coppel building on Three Daggers Alley. Patch will say this almost immediately. Brin will be furious." },
          { condition: "They search the kid", result: "Torn note in the satchel: Coppel & Sons, Three Daggers Alley. Back room. Leave the bag." }
        ]
      }
    ]
  },

  follow: {
    eyebrow: "Scene 4 Branch",
    title: "Follow the Kids",
    subtitle: "Dock Ward to Three Daggers Alley",
    sections: [
      {
        type: "body",
        content: "The kids move efficiently. They know the route. They don't check for a tail — they've never needed to before."
      },
      {
        type: "checks",
        items: [
          { dc: "DC 11 Stealth", desc: "Follow without being noticed. On a failure, Brin glances back but doesn't fully clock them — they just pick up the pace." }
        ]
      },
      {
        type: "body",
        content: "The kids deliver the bag to the back of a shuttered building on Three Daggers Alley: Coppel & Sons, Importers. They knock twice, wait, knock once. A latch clicks and the door opens. They go inside. The party is now at Coppel & Sons."
      }
    ]
  },

  spook: {
    eyebrow: "Scene 4 Branch",
    title: "Spook the Kids",
    subtitle: "Cinderfang alley — the bag gets dropped",
    sections: [
      {
        type: "body",
        content: "If the party moves on the kids without managing stealth, or reveals themselves openly, the kids scatter. DC 13 Athletics to chase any of them down."
      },
      {
        type: "body",
        content: "Patch drops the canvas bag in the chaos. Inside: several reagent bottles with Mira's labels still on them, and a torn note reading: Coppel & Sons, Three Daggers Alley. Back room. Leave the bag."
      },
      {
        type: "body",
        content: "That's their lead. Three Daggers Alley."
      }
    ]
  },

  coppel: {
    eyebrow: "Scene 6",
    title: "Coppel & Sons",
    subtitle: "Three Daggers Alley — the back room",
    sections: [
      {
        type: "location",
        aspects: [
          "Dusty abandoned storefront, the sign barely legible, windows dark and papered over from inside.",
          "A low hum, almost below hearing at the entrance, growing louder and more unsettling the deeper you go.",
          "The back room glows with a faint blue-green light. Smells of ozone and something older — mineral, wrong."
        ]
      },
      {
        type: "body",
        content: "Mention the hum the moment they enter the building. Before they see anything. It sets the tone."
      },
      {
        type: "read-aloud",
        text: "The back room. Whoever works here has transformed abandoned storage into something between a laboratory and a chapel. Diagrams cover every surface — chalk, ink, charcoal, layers of it. In the center, on a table improvised from shipping crates, sits a device the size of a small trunk. It hums. The light it gives off is the color of shallow water over stone. A boy, thirteen or so, sits with his back to the door, adding something carefully to the device with a pair of copper tongs.",
        wtyd: "What do you do?"
      },
      {
        type: "body",
        content: "When the party enters or makes noise, Ezrin turns. His first instinct is hope."
      },
      {
        type: "read-aloud",
        text: "The boy turns. He goes still for a moment, looking at the doorway. Then he sets down the tongs — carefully, deliberately — and straightens up. \"Are you my new parents?\" His voice is steady. \"Sella said someone would come.\""
      },
      {
        type: "npc",
        name: "Ezrin Voss",
        role: "Brilliant Orphan, Unknowing Weapon-Maker",
        want: "A family. Sella's promise. Proof he deserves to be wanted.",
        voice: "Proud and earnest. Explains things with excitement because he loves the detail. Hope is his default expression until it isn't.",
        keyline: "Are you my new parents? Sella said someone would come."
      },
      {
        type: "section-title",
        text: "If / Then"
      },
      {
        type: "ifthen",
        items: [
          { condition: "They tell him the truth about Sella", result: "He doesn't believe them at first. Then he does. Watch his face fall. He looks at the device and asks quietly what he built." },
          { condition: "They ask what the device does", result: "He explains with pride that curdles as he talks. He thought it was a purification engine for volatile compounds. As he describes it the party recognizes: sulphur salts, vitriol, dragonthorn. This device concentrates a detonation. Everything in those crates, triggered at once, could level half a city block." },
          { condition: "They ask about Sella", result: "He tells them everything. She came to Crestfall Orphanage. Said she saw something special in him. Said this project would prove he deserved a real family. He believed her because he wanted to." },
          { condition: "They try to dismantle the device", result: "Ezrin helps. He built it. He knows how. Takes 10 minutes and a DC 14 Arcana or Investigation check with his assistance. On a failure, the hum intensifies briefly — not dangerous yet, but unsettling." }
        ]
      },
      {
        type: "section-title",
        text: "Skill Checks"
      },
      {
        type: "checks",
        items: [
          { dc: "DC 14 Arcana", desc: "Recognize the device as an alchemical concentrator — used to amplify rather than contain a reaction. In other words, a bomb trigger." },
          { dc: "DC 12 Persuasion", desc: "Convince Ezrin to help dismantle it before Brahm and Joss arrive." },
          { dc: "DC 14 Arcana / Investigation", desc: "Dismantle the device safely with Ezrin's help. Failure = hum intensifies, DC rises by 2 on retry." }
        ]
      }
    ]
  },

  climax: {
    eyebrow: "Scene 7",
    title: "Brahm & Joss Arrive",
    subtitle: "Coppel & Sons — the door opens",
    sections: [
      {
        type: "read-aloud",
        text: "The door opens. Brahm fills the frame first, Joss a half-step behind. Both of them take in the room — the party, Ezrin, the device. Brahm's hand moves to his weapon.",
        wtyd: "Initiative."
      },
      {
        type: "body",
        content: "Sella is with them or arrives moments later. She reads the room — party, Brahm and Joss, Ezrin, the device — and makes a decision in about two seconds. She runs."
      },
      {
        type: "ifthen",
        items: [
          { condition: "Party splits to chase Sella", result: "DC 14 Athletics or Acrobatics to cut her off before she exits. Brahm and Joss use the distraction. They fight dirty." },
          { condition: "Party focuses on Brahm and Joss", result: "Sella escapes. She's gone by the time the fight ends. She's always gone." },
          { condition: "Someone blocks Sella before she exits", result: "DC 14 Athletics or Acrobatics. On success she's cornered. She'll talk her way out or fight — Dagger +5, 1d4+2. She has Uncanny Dodge. She's built to escape." },
          { condition: "Ezrin is endangered", result: "He tries to protect the device, or freezes, or tries to help. Pick the one that creates the best moment. If he grabs the device to stabilize it himself — let him. DC 14 Arcana, his bonus is +6. On a failure the device advances one step." },
          { condition: "Brahm or Joss hits 0", result: "The other reassesses immediately. Joss suggests retreat. Brahm might disagree — one round of argument, then Joss runs regardless using Cunning Action." }
        ]
      },
      {
        type: "section-title",
        text: "The Device — Condition Track"
      },
      {
        type: "device-tracker"
      },
      {
        type: "body",
        content: "The device starts at Stable when the fight begins. Advance it one step whenever: a spell is cast within 10 ft. of it, someone slams into the table (knocked prone adjacent, failed Athletics check moving through), fire or lightning damage occurs in the room, or Ezrin fails his stabilization check. At Detonation every creature in the building makes a DC 16 Dexterity save — 10d6 fire damage on a failure, half on success. Viktor's AC means nothing against an explosion."
      },
      {
        type: "section-title",
        text: "Environmental Hazards — Roll d8 Each Round"
      },
      {
        type: "env-table"
      },
      {
        type: "section-title",
        text: "Viktor as a Goliath — Environmental Disadvantages"
      },
      {
        type: "clues",
        items: [
          "Tight space: moving more than 15 ft. in a straight line requires DC 12 Athletics or he clips a shelf — roll on hazard table immediately.",
          "Low clearance on the mezzanine level if he goes up: disadvantage on attack rolls if he's ducking under beams.",
          "The device table is at chest height on a normal human — waist height on Viktor. He can't use it as cover. Everyone else can.",
          "Crate-Slam from Brahm knocks Medium or smaller creatures prone — Viktor is Large. He is immune to this effect but Brahm doesn't know that yet.",
          "If Joss uses Smoke Vial: the cloud is 15 ft. radius. Viktor's space is Large. He cannot fully hide inside it. His position is always approximately known."
        ]
      },
      {
        type: "section-title",
        text: "Ezrin During the Fight"
      },
      {
        type: "body",
        content: "Ezrin is not a combatant. Each round roll a d4 on his behavior: 1 — he freezes against the wall, 2 — he tries to stabilize the device (DC 14 Arcana, +6), 3 — he grabs something to throw as a distraction (counts as Help action for one party member), 4 — he shouts the device's weak point to the party (advantage on next stabilization check). If he's directly threatened he curls over the device to protect it — any attack that hits him also hits the device and advances it one step."
      },
      {
        type: "section-title",
        text: "Combat If / Then"
      },
      {
        type: "ifthen",
        items: [
          { condition: "Party tries to stabilize device during combat", result: "DC 14 Arcana or Investigation as an action. Ezrin helping grants advantage. Success holds the current condition. Failure advances one step." },
          { condition: "Brahm uses Crate-Slam near the device", result: "If he misses and rolls a 1, the crate hits the device table — advance condition one step." },
          { condition: "Joss uses Flash Powder", result: "The alchemical flash within 10 ft. of the device — advance condition one step regardless of where it lands." },
          { condition: "Joss uses Smoke Vial", result: "Heavy obscurement makes targeting the device impossible. Ezrin cannot stabilize what he cannot see. If condition is Critical, this is now a problem." },
          { condition: "Party negotiates mid-fight", result: "Brahm won't. Joss might — DC 15 Persuasion if the device is at Agitated or worse and he's below half HP. He's smart enough to know what that hum means." },
          { condition: "Device reaches Detonation", result: "Three second warning — the hum becomes a shriek. Everyone who can move has one reaction to get out. Then 10d6 fire, DC 16 Dex save for half." }
        ]
      },
      {
        type: "section-title",
        text: "Stat Blocks"
      },
      {
        type: "fullstat",
        name: "Brahm, Sella's Hammer",
        meta: "Medium Humanoid (human), neutral evil",
        cr: "CR 5 (1,800 XP)",
        ac: "16 (studded leather, shield)",
        hp: "112 (15d8 + 45)",
        speed: "30 ft.",
        stats: { str: "18 (+4)", dex: "15 (+2)", con: "16 (+3)", int: "10 (+0)", wis: "12 (+1)", cha: "15 (+2)" },
        saves: "Str +7, Dex +5, Con +6",
        skills: "Athletics +10, Intimidation +5, Perception +4",
        senses: "Passive Perception 14",
        languages: "Common",
        traits: [
          { name: "Dead-Eyed Nerve", text: "Brahm has advantage on saving throws against being frightened." },
          { name: "Heavy-Handed", text: "A melee weapon deals one extra die of its damage when Brahm hits with it (included in the attack)." },
          { name: "Sella's Hammer", text: "Brahm does not bother hiding what he is anymore. He has advantage on Charisma (Intimidation) checks made against creatures that have seen him hurt, restrain, or threaten someone weaker than himself." }
        ],
        actions: [
          { name: "Multiattack", text: "Brahm makes three melee attacks or two ranged attacks." },
          { name: "Ironbound Maul", text: "Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 11 (2d6+4) bludgeoning, or 13 (2d8+4) bludgeoning if Brahm brings the full weight down with both hands." },
          { name: "Alchemist's Hook", text: "Ranged Weapon Attack: +7 to hit, range 20/60 ft., one target. Hit: 11 (2d6+4) piercing. A heavy iron tool used for dragging crates, bodies, and stolen alchemical cargo." },
          { name: "Crate-Slam", text: "Melee Weapon Attack: +7 to hit, reach 5 ft., one creature. Hit: 9 (2d4+4) bludgeoning. If the target is Medium or smaller, it must succeed on a DC 15 Strength saving throw or be knocked prone." }
        ],
        reactions: [
          { name: "Turn the Blow", text: "Brahm adds 3 to his AC against one melee attack that would hit him. He must see the attacker and be wielding a melee weapon or shield." }
        ],
        behavior: "Targets the most dangerous party member first. Fights dirty — Crate-Slam to knock prone, then Ironbound Maul with advantage. Uses Turn the Blow liberally. Doesn't run until Joss forces it."
      },
      {
        type: "fullstat",
        name: "Joss, Sella's Knife",
        meta: "Medium Humanoid (human), neutral evil",
        cr: "CR 4 (1,100 XP)",
        ac: "16 (studded leather)",
        hp: "91 (14d8 + 28)",
        speed: "30 ft., climb 30 ft.",
        stats: { str: "10 (+0)", dex: "18 (+4)", con: "14 (+2)", int: "13 (+1)", wis: "12 (+1)", cha: "14 (+2)" },
        saves: "Dex +6, Int +3",
        skills: "Acrobatics +6, Deception +4, Perception +3, Sleight of Hand +6, Stealth +8",
        senses: "Passive Perception 13",
        languages: "Common, Thieves' Cant",
        traits: [
          { name: "Evasion", text: "If Joss is subjected to a Dexterity saving throw to take half damage, he instead takes no damage on a success, and half on a failure." },
          { name: "Sneak Attack (1/Turn)", text: "Joss deals an extra 14 (4d6) damage when he hits a target with advantage on the attack roll, or when the target is within 5 ft. of one of his allies that isn't incapacitated." },
          { name: "Sella's Knife", text: "Advantage on Stealth checks in alleys, storehouses, workshops, and crowded streets. Advantage on Deception checks to pass stolen alchemical goods through inspections." }
        ],
        actions: [
          { name: "Multiattack", text: "Joss makes two weapon attacks." },
          { name: "Cutting Shortblade", text: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 7 (1d6+4) piercing." },
          { name: "Light Crossbow", text: "Ranged Weapon Attack: +6 to hit, range 80/320 ft., one target. Hit: 8 (1d8+4) piercing." },
          { name: "Flash Powder (Recharge 5-6)", text: "Joss throws a stolen alchemical packet within 30 ft. Each creature within 10 ft. must succeed on a DC 14 Constitution saving throw or be blinded until the end of its next turn. Area lightly obscured until Joss's next turn." },
          { name: "Smoke Vial", text: "Joss breaks a smoke vial within 30 ft. A 15-ft.-radius cloud heavily obscures the area for 1 minute or until dispersed by wind. Normally used to escape, split the party, or cover Brahm's advance." }
        ],
        bonus: [
          { name: "Cunning Action", text: "Joss takes the Dash, Disengage, or Hide action." }
        ],
        reactions: [
          { name: "Uncanny Dodge", text: "Joss halves the damage of one attack that hits him. He must be able to see the attacker." }
        ],
        behavior: "Positions near the exit on round one. Uses Smoke Vial early to split the party or cover a retreat. Sneak Attack whenever Brahm is adjacent to the target. Runs immediately if Brahm goes down — uses Cunning Action (Dash) to exit."
      },
      {
        type: "fullstat",
        name: "Thug",
        meta: "Medium Humanoid (any race), any non-good alignment",
        cr: "CR 1/2 (100 XP)",
        ac: "11 (leather armor)",
        hp: "32 (5d8 + 10)",
        speed: "30 ft.",
        stats: { str: "15 (+2)", dex: "11 (+0)", con: "14 (+2)", int: "10 (+0)", wis: "10 (+0)", cha: "11 (+0)" },
        saves: "",
        skills: "Intimidation +2",
        senses: "Passive Perception 10",
        languages: "Any one language (usually Common)",
        traits: [
          { name: "Pack Tactics", text: "The thug has advantage on an attack roll against a creature if at least one of the thug's allies is within 5 ft. of the creature and the ally isn't incapacitated." }
        ],
        actions: [
          { name: "Multiattack", text: "The thug makes two melee attacks." },
          { name: "Mace", text: "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6+2) bludgeoning." },
          { name: "Heavy Crossbow", text: "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing." }
        ],
        reactions: [],
        behavior: "Break and run if either Brahm or Joss falls. Not loyal — just paid. Use Pack Tactics by staying adjacent to Brahm."
      }
    ]
  },

  end: {
    eyebrow: "Session End",
    title: "The Coded Note",
    subtitle: "Found on Brahm or Joss after the fight",
    sections: [
      {
        type: "body",
        content: "After the fight, searching Brahm or Joss turns up a folded note, sealed with plain wax. Heavy paper. The cipher is unfamiliar — most of the content appears to be a delivery confirmation: quantities, a drop location, a date. Then one line that doesn't match the tone of the rest."
      },
      {
        type: "read-aloud",
        text: "The jelly goes to the Fishbone marker. Separate from the rest. Do not mention this to S."
      },
      {
        type: "body",
        content: "The party cannot fully decode the note this session. The cipher key will surface between adventures. For now it's a thread they can't pull yet."
      },
      {
        type: "section-title",
        text: "Story Rewards"
      },
      {
        type: "clues",
        items: [
          "Staget owes them. Future Watch interactions go more smoothly.",
          "Ezrin is safe, for now. What happens to him is an open question.",
          "Sella escaped again. The party knows her face. Next time won't be a surprise.",
          "The coded note: the Fishbone marker, Javowitz, and something Sella was never supposed to know about.",
          "Magic item packs — distribute via the app after the session."
        ]
      },
      {
        type: "section-title",
        text: "Open Threads for Next Adventure"
      },
      {
        type: "clues",
        items: [
          "Riker is still out there. The lab where components were being assembled is still operating.",
          "Sella escaped. She now knows the party is actively hunting Riker's operation.",
          "The Fishbone marker and Javowitz — a dead warlock's bargain still being honored.",
          "Ezrin Voss. What happens to a thirteen-year-old genius who just built a bomb by accident?",
          "The Radiant Watch seal. George's subplot continues in the background."
        ]
      }
    ]
  }
,

  npcs: {
    eyebrow: "Full Cast",
    title: "NPCs",
    subtitle: "Role, wants, voice, and use at the table",
    sections: [
      {
        type: "npc",
        name: "Captain Hyustus Staget",
        role: "City Watch, Known Ally",
        want: "Handle this cleanly. No more incident reports that go nowhere.",
        voice: "Professional and tired. Trusts the party more than he lets on.",
        keyline: "Bring them in breathing if you can manage it. I've got enough paperwork."
      },
      {
        type: "npc",
        name: "Durnan",
        role: "Barkeep, Yawning Portal",
        want: "Keep the Portal out of trouble. See nothing officially.",
        voice: "Slow, economical, never asks a question he doesn't already know the answer to.",
        keyline: "I run a bar, not a watch post. But I hear things."
      },
      {
        type: "npc",
        name: "Mira Coppervan",
        role: "Robbed Alchemist",
        want: "Get her shop made safe and her reagents back. Understand what was taken and why.",
        voice: "Controlled fury. Meticulous. Gives information like she's filing it.",
        keyline: "I know every bottle in this room. I know what's missing."
      },
      {
        type: "npc",
        name: "Ezrin Voss",
        role: "Brilliant Orphan, Unknowing Weapon-Maker",
        want: "A family. Sella's promise. Proof he deserves to be wanted.",
        voice: "Proud and earnest. Explains things with excitement. Hope is his default expression until it isn't.",
        keyline: "Are you my new parents? Sella said someone would come."
      },
      {
        type: "npc",
        name: "Brin",
        role: "Lookout — oldest orphan, de facto leader",
        want: "Keep Sal and Patch safe. Deliver for Ezrin. Doesn't trust strangers.",
        voice: "Defiant when cornered. Protective. Won't give up names but folds if Sal or Patch is threatened.",
        keyline: "We weren't doing anything. And I don't know who you are."
      },
      {
        type: "npc",
        name: "Sal",
        role: "Lock kid — the technician",
        want: "Finish the job right. Treat it like a puzzle, not a crime.",
        voice: "Quiet and focused. Doesn't panic. More likely to talk than Brin if approached calmly.",
        keyline: "It's a seven-pin tumbler. Give me thirty seconds."
      },
      {
        type: "npc",
        name: "Patch",
        role: "Bag kid — youngest, most nervous",
        want: "Get this over with. Go home. Stop shaking.",
        voice: "Jumpy. Talks too much when scared. Most likely to crack under any pressure at all.",
        keyline: "Brin said it would be fine. Brin said nobody would see us."
      },
      {
        type: "npc",
        name: "Brahm",
        role: "Sella's Hammer — muscle, enforcer",
        want: "Complete the job. Get paid. He doesn't ask questions about the why.",
        voice: "Blunt and efficient. Not stupid but not imaginative. Fights like someone who's done it professionally for twenty years.",
        keyline: "We don't have to do this the hard way."
      },
      {
        type: "npc",
        name: "Joss",
        role: "Sella's Knife — muscle, tactician",
        want: "Complete the job. Keep an exit open at all times.",
        voice: "Quieter than Brahm. Tactical. Always checking the room for ways out. Talks less, notices more.",
        keyline: "Brahm. We should go."
      },
      {
        type: "npc",
        name: "Sella",
        role: "Riker's Operative — manipulative, dangerous",
        want: "Deliver for Riker. Disappear before anyone can stop her. She cannot be told about the stone-eye jelly.",
        voice: "Composed and gracious until she isn't. Sinister smile that arrives a half-second too late, like it's practiced. Never raises her voice.",
        keyline: "I'm afraid I can't stay. But it was lovely to see you again."
      },
      {
        type: "npc",
        name: "George Ward (absent)",
        role: "Twilight Cleric, Party Member — present only via letter",
        want: "Protect his friends. Unravel the Radiant Watch corruption. Not get killed doing it.",
        voice: "Measured and careful. Chooses words because he knows some walls have ears.",
        keyline: "Walk in the light."
      }
    ]
  }
,

  locations: {
    eyebrow: "Fantastic Locations",
    title: "Locations",
    subtitle: "Every location in this adventure with evocative details and scene notes",
    sections: [
      {
        type: "section-title",
        text: "The Yawning Portal"
      },
      {
        type: "location",
        aspects: [
          "The great well in the center of the floor drops into darkness, ignored by regulars who stopped finding it remarkable years ago.",
          "Noise of a hundred conversations, clinking tankards, a low fire that never seems to go out.",
          "Durnan behind the bar, wiping a tankard he has wiped a hundred times, watching everything without appearing to watch anything."
        ]
      },
      {
        type: "body",
        content: "The party's first real lead. Durnan knows about Brahm and Joss. The woman with the sinister smile. The Tithemans name. Don't rush this scene — let Durnan make them work for it."
      },
      {
        type: "section-title",
        text: "Mira's Alchemical Sundries"
      },
      {
        type: "location",
        aspects: [
          "A single broken vial on the floor near the worktable — the smell of its contents still faint in the air.",
          "One drawer in the back counter left open, its contents undisturbed except for what was taken.",
          "Everything else exactly as Mira left it. That's what made her look twice."
        ]
      },
      {
        type: "body",
        content: "The shop looks almost normal — that's the point. One broken vial, one open drawer. Whoever did this was careful, but something went wrong on the way out. Mira noticed because she knows every inch of this room. Staget may be nearby outside. The kids are getting sloppy."
      },
      {
        type: "section-title",
        text: "Cinderfang Warehouse"
      },
      {
        type: "location",
        aspects: [
          "Massive stone building near the waterfront, several stories of stacked crates and iron-banded doors.",
          "Smell of salt water, tar, and the faint mineral tang of stored goods. Torches at the main entrance, darkness around the sides.",
          "A night watchman makes rounds every thirty minutes. Two side entrances, both locked. Loading dock faces the water."
        ]
      },
      {
        type: "body",
        content: "The stakeout location. Low expectations from Staget — his customs contact only flagged one manifest item. The kids show up anyway. This is where the tone shifts from investigation to something more complicated."
      },
      {
        type: "section-title",
        text: "Coppel & Sons, Three Daggers Alley"
      },
      {
        type: "location",
        aspects: [
          "Dusty abandoned storefront, the sign barely legible, windows dark and papered over from inside.",
          "A low hum, almost below hearing at the entrance, growing louder and more unsettling the deeper you go.",
          "The back room glows with faint blue-green light. Smells of ozone and something older — mineral, wrong."
        ]
      },
      {
        type: "body",
        content: "The climax location. Mention the hum the moment they enter — before they see anything. Ezrin's workspace is extraordinary: diagrams on every surface, a device that shouldn't exist built from stolen parts by a thirteen-year-old who thought he was doing something brilliant. This room should feel like a discovery, not just a confrontation."
      },
      {
        type: "section-title",
        text: "Crestfall Orphanage (referenced, not visited)"
      },
      {
        type: "location",
        aspects: [
          "Cold stone halls, children who go quiet when strangers arrive.",
          "Ezrin's corner room covered in chalk diagrams — still visible if the party visits after.",
          "The matron doesn't know what Ezrin was doing. She just knew he kept the other kids fed and out of trouble."
        ]
      },
      {
        type: "body",
        content: "The party probably won't visit this session but it exists. If they do go looking for Brin, Sal, and Patch afterward, this is where they end up. Good hook for next session if Ezrin's fate becomes a thread."
      }
    ]
  }
};
