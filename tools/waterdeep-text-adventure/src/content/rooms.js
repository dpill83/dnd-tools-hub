export function createRooms() {
  return {
    drain: {
      name: 'DRAINAGE SHAFT',
      art: () => `
+---------------------------+
|      DRAINAGE SHAFT       |
+---------------------------+
|                           |
|   +-------------------+   |
|   |    IRON GRATE     |   |
|   |   (locked above)  |   |
|   +-------------------+   |
|                           |
|          [YOU]            |
|                           |
|   water flows south >>    |
+------------[S]------------+`,
      first: [
        'You are at the bottom of a drainage shaft.',
        'Ten feet above, an iron grate lets in grey Waterdeep light.',
        'It is locked from the street side. You came down chasing a suspect.',
        'That was an hour ago. The suspect is gone. You are not.',
        '',
        'Your lantern casts a sick yellow circle on the wet stone.',
        'Black water moves south through a low tunnel.',
        '',
        'Your WATCHMAN WHISTLE and BADGE are on your belt.',
        'A HARD RATION is in your pouch.',
        '',
        'Exits: SOUTH into the sewer tunnel. The grate above is locked.',
      ],
      look: [
        'A vertical shaft of old stone. The grate above is locked shut.',
        'Black water flows south through a low arch.',
        (ctx) =>
          ctx.state.flags.whistleUsed && !ctx.state.flags.won
            ? 'You have blown the whistle. Someone topside should have heard it. You need to get back here.'
            : 'Exits: SOUTH.',
      ],
      exits: { south: 'tunnel' },
      initialItems: [],
    },

    tunnel: {
      name: 'MAIN SEWER TUNNEL',
      art: () => `
           [N] to drain shaft
                  |
+---------------------------+
|       MAIN TUNNEL         |
+---------------------------+
|                           |
|  [CROWBAR against wall]   |
|                           |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|  ~ ~ ~ water channel ~ ~ ~|
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|                           |
+---+-------------------+---+
   [W]               [E]
  junction         collapsed`,
      first: [
        'The main channel. Waste-water runs along a central trough.',
        'The smell is remarkable. You breathe through your mouth.',
        '',
        'A RUSTED CROWBAR leans against the wall -- someone left it here.',
        'The tunnel splits. EAST leads toward a collapsed section.',
        'WEST leads toward the sound of something large moving in water.',
        'NORTH returns to the drain shaft.',
      ],
      look: [
        'The main sewer channel. Water moves west.',
        (ctx) => (ctx.getRoomItems('tunnel').includes('crowbar') ? 'A RUSTED CROWBAR leans against the wall.' : ''),
        'Exits: NORTH to the drain shaft, EAST to the collapsed section, WEST toward the junction.',
      ],
      exits: { north: 'drain', east: 'collapse', west: 'junction' },
      initialItems: ['crowbar'],
    },

    collapse: {
      name: 'COLLAPSED SECTION',
      art: () => `
+---------------------------+
|     COLLAPSED SECTION     |
+---------------------------+
|                           |
|  +---------------------+  |
|  | hollow in wall:     |  |
|  |   - wax-sealed letter  |
|  |   - sewer torch     |  |
|  +---------------------+  |
|                           |
|  RUBBLE ################  |
|  (passage blocked)        |
|                           |
+---[W]---------------------+
   to main tunnel`,
      first: [
        'The tunnel ceiling has caved in. Rubble blocks the far passage.',
        'A dead end -- almost.',
        '',
        'Behind a loose stone you notice a hollow in the wall.',
        'Inside: a WAX-SEALED LETTER and an unlit SEWER TORCH.',
        '',
        'This is a Shadow Thief dead drop. Someone has been using these tunnels.',
        '',
        'Exits: WEST back to the main tunnel.',
      ],
      look: [
        'Collapsed stone. Rubble chest-high against the far wall.',
        (ctx) => {
          const here = ctx.getRoomItems('collapse');
          return here.length > 0
            ? 'The hollow in the wall still holds: ' + here.map((k) => ctx.items[k]?.name || k).join(', ') + '.'
            : 'The hollow in the wall is empty.';
        },
        'Exits: WEST.',
      ],
      exits: { west: 'tunnel' },
      initialItems: ['letter', 'torch'],
    },

    junction: {
      name: 'FLOODED JUNCTION',
      art: (ctx) => `
           [E] to tunnel
                  |
+---------------------------+
|      FLOODED JUNCTION     |
+---------------------------+
|                           |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|  ~                      ~ |
|  ~  ${ctx.state.flags.ratsDead ? '                  ' : '[RAT] [RAT] [RAT]'}  ~ |
|  ~                      ~ |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|                           |
+------------[S]------------+
          deep channel`,
      first: [
        'A wide junction where three channels meet.',
        'The water is knee-deep here and black.',
        '',
        (ctx) => (ctx.state.flags.ratsDead ? 'The giant rats are dead. Their bodies float.' : 'THREE GIANT RATS are feeding on something in the water. They notice you.'),
        '',
        'Exits: EAST back to the tunnel, SOUTH toward the deep channel.',
      ],
      look: [
        'The flooded junction. Water from three directions.',
        (ctx) => (ctx.state.flags.ratsDead ? 'The rats are dead. It is quiet.' : 'The giant rats are between you and the south passage.'),
        'Exits: EAST, SOUTH.',
      ],
      exits: { east: 'tunnel', south: 'deepchannel' },
      initialItems: [],
    },

    deepchannel: {
      name: 'DEEP CHANNEL',
      art: (ctx) => `
           [N] to junction
                  |
+---------------------------+
|        DEEP CHANNEL       |
+---------------------------+
|                           |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|  ~                      ~ |
|  ~  ${ctx.state.flags.otyughDead ? '   [OTYUGH - dead]  ' : '     [OTYUGH]       '}  ~ |
|  ~                      ~ |
|  ~~~~~~~~~~~~~~~~~~~~~~~~ |
|                           |
|  iron door [S] >>         |
+---------------------------+`,
      first: [
        'The channel widens into a deep cistern. The water here is waist-high.',
        'The smell is suffocating.',
        '',
        (ctx) =>
          ctx.state.flags.otyughDead
            ? 'The otyugh is dead. It takes up most of the cistern.'
            : 'An OTYUGH squats in the far end -- a massive, tentacled thing that lives in filth. It is territorial.',
        '',
        'A SHADOW THIEF passage is carved into the south wall. The door is iron, slightly ajar.',
        'Exits: NORTH back to the junction, SOUTH to the stash room (the otyugh blocks the way).',
      ],
      look: [
        (ctx) =>
          ctx.state.flags.otyughDead
            ? 'The dead otyugh fills the cistern. You step over its tentacles.'
            : 'The otyugh regards you with three black eyes. It is not moving yet.',
        (ctx) => (ctx.state.flags.otyughDead ? 'Exits: NORTH, SOUTH.' : 'You cannot reach the south door while the otyugh lives.'),
      ],
      exits: {
        north: 'junction',
        south: (ctx) => (ctx.state.flags.otyughDead ? 'stash' : null),
      },
      initialItems: [],
    },

    stash: {
      name: 'SHADOW THIEF STASH ROOM',
      art: (ctx) => `
+---------------------------+
|   SHADOW THIEF STASH      |
+---------------------------+
|                           |
|  [CRATE]       [CRATE]    |
|                           |
|  [MAPS on wall]           |
|                           |
|  ${ctx.state.flags.thiefDead ? '[THIEF - dead]     ' : ctx.state.flags.thiefFled ? '[THIEF - fled]     ' : '[THIEF at table]   '}    |
|                           |
|  ladder up [N] >>         |
+------------[N]------------+
          to drain shaft`,
      first: [
        'A dry room carved out of the sewer wall. Crates. A hanging lantern.',
        'Maps pinned to stone. Routes marked in red ink.',
        '',
        (ctx) =>
          ctx.state.flags.thiefDead
            ? 'The Shadow Thief is dead on the floor.'
            : ctx.state.flags.thiefFled
              ? 'The room is empty. The thief ran.'
              : 'A SHADOW THIEF sits at a small table. He sees you the same moment you see him.',
        '',
        (ctx) => (!ctx.state.flags.thiefDead && !ctx.state.flags.thiefFled ? 'He goes for a blade at his hip.' : ''),
        '',
        'This is the route back. A ladder on the north wall leads up to a surface GRATE -- directly above the drain shaft.',
        'Exits: NORTH (ladder to drain shaft), SOUTH back to the deep channel.',
      ],
      look: [
        'Crates. Maps. A thief stash built for long use.',
        (ctx) =>
          ctx.state.flags.thiefDead ? 'The thief is dead.' : ctx.state.flags.thiefFled ? 'Empty. The thief is gone.' : 'The Shadow Thief watches you carefully.',
        'A ladder leads up to a surface grate. Exits: NORTH (up the ladder), SOUTH.',
      ],
      exits: { south: 'deepchannel', north: 'drain' },
      initialItems: [],
    },
  };
}
