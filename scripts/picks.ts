// The images picked to become 5-second clips (step C of the full run, media plan section 4).
// worlds and almaty clips get a motion line written from what each picked image shows, so a
// clip never adds weather or objects the image doesn't have; textures and ads use the motion
// planned with the image. Picked from the contact sheets on 2026-10-17: images where something
// clearly moves, a few per theme, in a mix of shapes, none flagged for text.

export interface PickedVideo {
  /** The image to animate. */
  key: string;
  /** worlds and almaty only: what moves, from what the image shows. */
  motion?: string;
}

export const PICKED_VIDEOS: readonly PickedVideo[] = [
  // worlds: city rain
  { key: "worlds-013", motion: "rain keeps falling on the canal, ripples spread across the water and the moored boats rock gently, static camera" },
  { key: "worlds-018", motion: "the cyclist pedals slowly across the wet crosswalk as rain falls and reflections shimmer on the road" },
  { key: "worlds-024", motion: "the paper lanterns sway gently as drizzle falls and their reflections ripple on the wet ground, slow push down the alley" },
  // mountains and roads
  { key: "worlds-049", motion: "the clouds drift slowly along the valley beside the road, slow aerial glide forward" },
  { key: "worlds-111", motion: "smoke rises and drifts from the chimney of the stone hut as the grass stirs in the wind, static camera" },
  { key: "worlds-245", motion: "the cable car glides slowly along its cable toward the peaks as soft light shifts on the slopes" },
  // deserts and canyons
  { key: "worlds-077", motion: "dust blows through the arched gateway and swirls across the ground, static camera" },
  { key: "worlds-182", motion: "dust drifts across the plain, the windmill turns and the water ripples, slow aerial glide" },
  { key: "worlds-188", motion: "the oryx walk steadily across the red dune from left to right as sand drifts at their hooves" },
  // forests and snow
  { key: "worlds-008", motion: "mist drifts across the pond as the moose lifts its head and steps slowly through the water" },
  { key: "worlds-040", motion: "sun rays shift through the trees, thin mist drifts over the lake and the reflections ripple gently" },
  { key: "worlds-123", motion: "the fox trots across the snow from right to left through the long tree shadows" },
  { key: "worlds-209", motion: "mist drifts through the beams of sunlight and leaves flutter in the trees, slow push toward the bridge" },
  // coasts and storms
  { key: "worlds-009", motion: "the wave curls and crashes onto the pebbles, and the foam rushes up the beach and drains back" },
  { key: "worlds-166", motion: "storm clouds roll over the white village as waves break against the rocks below, static camera" },
  { key: "worlds-180", motion: "the clear water ripples and flows through the cave toward the bright opening as light shimmers on the rock, slow push forward" },
  // underwater
  { key: "worlds-052", motion: "the sea lions glide through the water as the seagrass sways and light ripples down from the surface" },
  { key: "worlds-075", motion: "the school of silver fish swirls and turns together above the coral as light shimmers in the water" },
  // retro-future
  { key: "worlds-087", motion: "the glass-domed train glides along the track through the desert as the brush stirs in the warm light" },
  { key: "worlds-144", motion: "the ferry glides across the bay with its wake spreading behind it as clouds drift slowly" },
  { key: "worlds-174", motion: "the tall wind sculptures turn slowly in the breeze and the grass ripples across the hills" },
  // cozy interiors
  { key: "worlds-254", motion: "steam rises and curls from the round pool and the candle flames flicker, static camera" },
  { key: "worlds-461", motion: "the fire flickers in the stone fireplace and warm light shifts over the room, static camera" },
  // macro nature
  { key: "worlds-450", motion: "the spider web trembles in a light breeze and the dew drops glint, static camera" },
  { key: "worlds-053", motion: "the caterpillar crawls slowly along the leaf from left to right" },
  // food and drink
  { key: "worlds-014", motion: "espresso pours from the glass jug into the cup and the crema swirls, static camera" },
  { key: "worlds-081", motion: "cream pours slowly from the jug over the berries in the bowl, static camera" },
  { key: "worlds-098", motion: "steam rises and curls above the bowl of ramen, static camera" },
  // vehicles
  { key: "worlds-193", motion: "the cargo ship moves slowly across the grey sea from left to right as the storm clouds drift" },
  { key: "worlds-214", motion: "the hot air balloon sways as it fills and lifts a little while the grass ripples below" },
  // portraits
  { key: "worlds-026", motion: "the dancer turns slowly on one foot and her red dress swings with the spin, static camera" },
  { key: "worlds-063", motion: "the wind lifts the white gown and her hair as she turns slightly and sand blows across the dune" },
  // surreal
  { key: "worlds-028", motion: "the glowing whale swims slowly across the night sky above the rooftops, its tail moving gently" },
  { key: "worlds-138", motion: "the train glides across the still lake from right to left with its reflection following it" },
  { key: "worlds-273", motion: "water pours steadily off the edge of the floating island and the flowers sway gently, static camera" },

  // almaty
  { key: "almaty-023", motion: "the eagle glides across the valley with slow beats of its wings as the camera follows it" },
  { key: "almaty-037", motion: "the river rushes over the rocks toward the camera with spray and foam churning, static camera" },
  { key: "almaty-044", motion: "the flock of sheep grazes and moves slowly down the hillside in the evening light, static camera" },
  { key: "almaty-056", motion: "the waterfall pours into the gorge as spray rises from its base, static camera" },
  { key: "almaty-062", motion: "the cable car cabins glide up the cables above the drifting clouds" },
  { key: "almaty-067", motion: "the wild horses gallop across the steppe with dust trailing behind them, slow aerial follow" },
  { key: "almaty-052", motion: "fog drifts slowly through the valleys between the forested ridges, static aerial view" },
  { key: "almaty-071", motion: "mist drifts slowly over the water between the spruce trees as the morning light warms, static camera" },
  { key: "almaty-039", motion: "the wild tulips sway gently in the breeze across the steppe, static camera" },
  { key: "almaty-029", motion: "the snow leopard turns its head and steps slowly along the rocks, its long tail swaying" },

  // textures: motion as planned
  { key: "textures-04" },
  { key: "textures-05" },
  { key: "textures-06" },
  { key: "textures-07" },
  { key: "textures-12" },
  { key: "textures-13" },
  { key: "textures-14" },
  { key: "textures-18" },
  { key: "textures-19" },
  { key: "textures-20" },

  // ads: motion as planned
  { key: "ads-coffee-motion-01" },
  { key: "ads-coffee-motion-02" },
  { key: "ads-coffee-motion-03" },
  { key: "ads-sneakers-motion-01" },
  { key: "ads-sneakers-motion-02" },
  { key: "ads-sneakers-motion-03" },
  { key: "ads-headphones-motion-01" },
  { key: "ads-headphones-motion-02" },
  { key: "ads-perfume-motion-01" },
  { key: "ads-perfume-motion-02" },
];
