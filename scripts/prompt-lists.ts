// The words behind every M5 prompt, per collection (the media plan in docs/, local only).
// scripts/prompts.ts turns them into generation jobs. A prompt reads: subject + light and time
// + camera + colors + style. The aspect ratio is a model parameter, never prompt text.
//
// Content rules: fictional adults only (no real or famous people, no children), no real brands,
// logos or readable text, no copyrighted characters, no names of artists or studios.
import type { CinemaStudioMove } from "./higgsfield-models.ts";

/** Something to picture, and how it should move when its image is animated. */
export interface Subject {
  text: string;
  motion: string;
}

/** The looks of the `worlds` collection; each prompt uses one. */
export const STYLES = {
  film: "35mm film still, natural grain",
  studio: "clean studio photograph, crisp detail",
  editorial: "soft editorial photograph, natural light",
  night: "moody cinematic night, deep shadows, glowing practical lights",
  painted: "dreamy painted look, soft brushwork, luminous color",
  fineArt: "surreal fine-art photograph, dreamlike and soft",
} as const;

export type StyleName = keyof typeof STYLES;

/**
 * One theme of `worlds`. Every light, camera, palette and style must suit every subject, so
 * any combination makes sense: no studio look outdoors, no close-ups of huge scenes, no
 * palette that only works by day. Subjects have no motion line: the videos are picked from the
 * finished images, and each picked image gets its motion written from what it shows.
 */
export interface WorldTheme {
  slug: string;
  subjects: string[];
  lights: string[];
  cameras: string[];
  palettes: string[];
  styles: StyleName[];
}

const CAMERAS_WIDE = ["aerial view", "wide-angle from eye level", "long lens compression", "low angle", "from a high vantage point"];

/** 12 themes × 29 subjects: 680 images use each subject once or twice. */
export const WORLD_THEMES: WorldTheme[] = [
  {
    slug: "city-rain",
    subjects: [
      "strings of paper lanterns glowing over a rain-soaked alley of wooden shutters",
      "a flooded boulevard reflecting a long row of streetlights",
      "a narrow alley of paper lanterns and dripping awnings",
      "a lone cyclist with a clear umbrella on a wet crosswalk",
      "a rooftop water tower above a glowing city in drizzle",
      "a corner café window fogged with condensation, warm light inside",
      "rain pouring off a stone archway onto worn steps",
      "an elevated train passing between apartment blocks",
      "a stepped street with puddles reflecting the lit windows",
      "a lone streetlamp mirrored in a flooded cobblestone lane",
      "a canal bridge in heavy rain with bicycles chained to the railings",
      "rain-beaded windows of a night train, city lights blurred beyond",
      "rain falling past the open edge of a concrete stairwell",
      "a crowd of umbrellas at a busy crossing",
      "a rooftop garden glowing under a steady drizzle",
      "a fire escape zigzagging down a brick building in the rain",
      "a red umbrella left on a wet bench under bare trees",
      "a covered footbridge over a busy rainy avenue",
      "a narrow canal lined with moored boats in steady rain",
      "a glass greenhouse on a rooftop, glowing in the rain",
      "rain falling through the light of a single lamp over a quiet courtyard",
      "a flower stall closing up under plastic sheets in the rain",
      "wet marble steps leading up to a tall wooden door with an umbrella stand",
      "a cobblestone square with a fountain overflowing in the rain",
      "a glass roof streaming with rain, seen from below",
      "an overpass dripping water onto a quiet street below",
      "a street of shuttered market stalls with puddles everywhere",
      "a stray cat sitting in a dry doorway on a wet street",
      "a riverside promenade with lamps reflected in the rain-pocked water",
    ],
    lights: ["at blue hour", "after midnight", "under sodium streetlights", "lit by warm windows and colored lamplight", "in the last light of dusk", "in thick fog and rain"],
    cameras: ["35mm lens at eye level", "low angle close to the wet ground", "long lens compression", "wide-angle from above", "shallow depth of field with heavy bokeh"],
    palettes: ["teal and amber tones", "magenta and cyan tones", "warm orange and deep blue", "desaturated colors with one red accent", "emerald and gold tones"],
    styles: ["film", "night", "painted"],
  },
  {
    slug: "mountains-roads",
    subjects: [
      "a winding mountain road disappearing into fog, one vintage car with its headlights on",
      "a switchback pass above a sea of clouds",
      "a lone hiker on a knife-edge ridge",
      "a stone mountain hut with smoke rising from the chimney",
      "a long straight road toward snow-capped peaks",
      "an old stone bridge over a glacial river",
      "a cable car crossing between two peaks",
      "an alpine lake mirroring jagged peaks",
      "a lone motorcycle at the mouth of a mountain tunnel",
      "mountain goats on a steep scree slope",
      "an observatory dome on a bare summit",
      "a gravel road through golden larch trees",
      "a waterfall pouring off a cliff into a green valley",
      "a small camper van parked at a mountain overlook, seen from far above",
      "a monastery perched on a cliff above a gorge",
      "a wooden footbridge over a roaring gorge",
      "yaks grazing on a high plateau below snowy peaks",
      "a glacier tongue spilling into a rocky valley",
      "terraced fields climbing a steep mountainside",
      "an empty ski lift crossing a grassy autumn slope",
      "a lone pine on a granite outcrop",
      "a mountain village of stone houses with smoke from the chimneys",
      "a hairpin road traced by the light trails of passing cars",
      "a rope bridge strung between two cliffs",
      "a high mountain lake with a small island of pines",
      "a portaledge tent hanging on a sheer granite wall",
      "a dam holding back a turquoise reservoir",
      "a red-roofed rescue hut on a snowy ridge",
      "a narrow-gauge railway winding along a cliff",
    ],
    lights: ["at first light", "at golden hour", "under low overcast clouds", "in clear light after rain", "at sunset with alpenglow", "under a full moon"],
    cameras: CAMERAS_WIDE,
    palettes: ["soft muted colors", "sage and slate tones", "warm gold and cool blue", "deep greens and stone grey", "pink alpenglow and indigo"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "deserts-canyons",
    subjects: [
      "wind-carved sandstone canyon walls glowing with reflected light",
      "rippled dunes with a single line of footprints",
      "a camel caravan crossing a salt flat",
      "a lone water tower beside an empty desert highway",
      "a red rock arch framing the horizon",
      "a dry riverbed with cracked mud patterns",
      "a lone acacia tree on an empty plain",
      "an abandoned adobe village half buried in sand",
      "a hot air balloon drifting over sandstone towers",
      "a slot canyon with a beam of light reaching the floor",
      "a desert oasis with palms reflected in still water",
      "a white gypsum dune field with sharp shadows",
      "a winding river at the bottom of a deep canyon",
      "a canvas tent pitched on a quiet mesa",
      "a lone road cutting through a field of red rock spires",
      "an abandoned car half buried in drifting sand",
      "a herd of oryx crossing a red dune",
      "a dry waterfall carved into a canyon wall",
      "a mesa casting a long shadow across the plain",
      "a cluster of giant cacti on a rocky hillside",
      "a stone watchtower ruin on a desert ridge",
      "a salt lake crusted in hexagonal patterns",
      "an empty wooden raft tied at a bend of a canyon river",
      "ancient rock carvings on a sun-baked boulder",
      "a ruined caravanserai with arched gateways",
      "a valley of hoodoo rock pillars",
      "a lone windmill pumping water on a dry ranch",
      "a road winding through badlands of striped hills",
      "a single camel resting in the shade of a dune",
    ],
    lights: ["at sunrise", "at golden hour", "under harsh noon sun with hard shadows", "at dusk under a purple sky", "under a starry night sky", "in a passing dust storm"],
    cameras: ["aerial view", "wide-angle from the ground", "long lens compression", "low angle", "from a high vantage point"],
    palettes: ["terracotta and dusty teal", "sand and rose tones", "burnt orange and violet", "warm amber and deep blue", "ochre and charcoal"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "forests-snow",
    subjects: [
      "a narrow path through a misty pine forest",
      "a red wooden cabin half buried in snow",
      "a frozen lake with cracks running to the horizon",
      "a red fox trotting through fresh snow",
      "a deer standing between white birch trunks",
      "an old-growth forest of moss and giant ferns",
      "snow-laden spruce trees below a steep mountain",
      "a wooden boardwalk crossing a foggy bog",
      "a snowy owl perched on a frosted branch",
      "a forest stream winding between snowy banks",
      "an autumn beech forest carpeted with copper leaves",
      "a sled dog team resting beside a frozen trail",
      "a waterfall frozen into blue icicles",
      "a ring of standing stones in a snowy clearing",
      "a lynx resting on a fallen log",
      "a moose wading through a misty pond",
      "a woodpile stacked against a log cabin wall",
      "a mountain stream tumbling over mossy boulders",
      "a lone birch with golden leaves in a dark spruce forest",
      "a wooden watchtower above a sea of pine trees",
      "a winding forest road covered in fallen needles",
      "a brown bear crossing a shallow river",
      "a clearing full of foxgloves and ferns",
      "a mossy stone bridge in a beech forest",
      "a hollow ancient oak with roots like a cave",
      "a snowshoe trail winding between snow-covered firs",
      "wild boar foraging among fallen leaves",
      "a forest lake reflecting golden larches",
      "a woodpecker on a frosted tree trunk",
    ],
    lights: ["at dawn", "in soft overcast light", "in drifting mist", "with sun rays through the trees", "at blue hour", "at golden hour"],
    cameras: ["wide-angle at eye level", "long lens compression", "low angle from the ground", "aerial view", "framed through the branches"],
    palettes: ["pine green and cool grey", "soft grey and rust", "muted earth tones", "moss green and amber", "pale gold and slate blue"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "coasts-storms",
    subjects: [
      "a lighthouse on a cliff as waves break against the rocks",
      "a black sand beach with sea stacks offshore",
      "a storm front rolling in over the open ocean",
      "a wooden pier stretching into a calm sea",
      "a small fishing boat riding a huge wave",
      "tide pools full of starfish and anemones",
      "white cliffs above a turquoise bay",
      "a row of beach huts with colorful doors",
      "a humpback whale breaching near a rocky island",
      "a sea cave opening onto bright water",
      "a stone harbor wall with waves bursting over it",
      "a lone sailboat on a glassy sea",
      "sand dunes meeting a wild northern beach",
      "a fishing village of stilt houses over the water",
      "a weathered wooden lookout tower on an empty beach",
      "a rusted shipwreck stranded on a sandbar",
      "puffins standing on a grassy sea cliff",
      "a tidal island with a causeway half under water",
      "a coastal road hugging the cliffs",
      "basalt columns along the shore with waves surging between them",
      "a seaside swimming pool carved into the rocks",
      "fishing nets and buoys piled on a stone quay",
      "a red buoy rocking in choppy water",
      "a cliffside village of white houses above the sea",
      "seals resting on rocks at low tide",
      "a long breakwater with a small beacon at its end",
      "a cove of turquoise water framed by pine trees",
      "surf rolling onto a beach of round pebbles",
      "a wooden boat shed on stilts at the water's edge",
    ],
    lights: ["at golden hour", "under a dramatic storm sky", "in soft morning haze", "at sunset", "in bright midday light", "at blue hour"],
    cameras: ["aerial view", "wide-angle at water level", "long lens compression", "low angle from the rocks", "from the clifftop"],
    palettes: ["deep teal and white", "turquoise and sand tones", "slate grey and foam white", "coral and aqua", "indigo and silver"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "underwater",
    subjects: [
      "a coral reef with a school of silver fish",
      "a sea turtle gliding through clear blue water",
      "a swaying kelp forest",
      "a shipwreck resting on the sandy seafloor",
      "a manta ray gliding over white sand",
      "jellyfish drifting in deep blue water",
      "an octopus resting on a rock among sea urchins",
      "a seagrass meadow with a small seahorse",
      "a sunken stone arch covered in soft coral",
      "a pod of dolphins swimming just below the surface",
      "an underwater cave with a beam of light from above",
      "a giant clam on a reef ledge",
      "a swirling school of sardines",
      "sea lions playing in a kelp bed",
      "a reef shark cruising along a coral wall",
      "a moray eel peering out of a rock crevice",
      "a lionfish hovering near a coral head",
      "a field of garden eels rising from the sand",
      "a sunken vintage car overgrown with coral",
      "a cuttlefish shifting colors over the reef",
      "a wall of barracuda hanging in the current",
      "a whale shark gliding past with small fish at its side",
      "a submerged stone staircase leading into the deep",
      "an old anchor resting on a sandy slope among sea fans",
      "a forest of giant sea fans",
      "a pod of orcas gliding through green water",
      "mangrove roots underwater with small fish between them",
      "a coral garden on a shallow reef top",
      "a sunken airplane wreck resting on white sand",
    ],
    lights: ["with sun rays from the surface", "in clear tropical light", "in deep blue twilight", "in soft diffused light", "in shimmering caustic light", "in emerald green water"],
    cameras: ["wide-angle lens", "looking up toward the surface", "at eye level with the subject", "wide shot from below", "from slightly above"],
    palettes: ["deep teal and white", "turquoise and gold", "cobalt and silver", "coral and aqua", "emerald and sand"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "retro-future",
    subjects: [
      "a monorail curving between towers with rounded windows",
      "a sky harbor where airships dock at a tall spire",
      "a garden city under a giant glass dome",
      "a glass observation deck with a fin-shaped roof above a canyon",
      "a plaza of chrome sculptures and fountains",
      "a floating market of hover boats on a canal",
      "a city of towers on stilts above the sea",
      "a saucer-shaped house on stilts above a pine forest",
      "a space elevator rising from a desert city",
      "pastel towers linked by walkways in the air",
      "a streamlined train arriving at an open-air elevated station",
      "a seaside resort of saucer-shaped hotels",
      "a spiral library tower with book drones circling it",
      "terraced towers wrapped in hanging gardens",
      "a rocket launch tower beside a seaside town",
      "a hover-car ferry crossing a glassy bay",
      "a glass-domed train crossing a desert",
      "a rooftop landing pad with a parked flying car",
      "a greenhouse colony on a red desert planet",
      "an underwater hotel with glowing round portholes",
      "a boulevard of rounded towers and palm trees",
      "a solar sail ship docked at a mountain port",
      "a museum hall of giant satellites under a glass roof",
      "a suspended highway looping between skyscrapers",
      "a farm of tall wind sculptures on rolling hills",
      "a floating island city tethered by cables",
      "a factory where rounded robots assemble hover cars",
      "a lighthouse beaming light up into space",
      "pneumatic tube pods crossing a canyon on glass rails",
    ],
    lights: ["at golden hour", "at night with glowing windows", "in pale morning haze", "under twin moons", "at sunset", "in bright clean daylight"],
    cameras: CAMERAS_WIDE,
    palettes: ["mint and coral", "chrome and sky blue", "cream and teal", "sunset orange and lilac", "white and sea-glass green"],
    styles: ["film", "painted"],
  },
  {
    slug: "cozy-interiors",
    subjects: [
      "a window seat with a steaming cup and a knitted blanket",
      "a woodworking workshop with shavings on the bench",
      "a library with rolling ladders and green reading lamps",
      "a reading nook under a sloped attic window",
      "a ceramics studio with shelves of drying bowls",
      "a small bakery kitchen with loaves cooling on racks",
      "a listening corner with a turntable and two worn armchairs",
      "a greenhouse study with plants climbing the walls",
      "a bicycle repair shop with wheels hanging from the ceiling",
      "a mountain lodge living room with a stone fireplace",
      "a watchmaker's desk with tiny tools and a magnifier",
      "a tea room with low tables and paper screens",
      "a florist's worktable crowded with buckets of tulips",
      "a sleeper train cabin with a fold-down table by the window",
      "a kitchen with copper pans hanging over a farmhouse table",
      "a tailor's workroom with bolts of fabric and a sewing machine",
      "a houseboat cabin with a small stove and round windows",
      "a bookbinder's bench with leather and spools of thread",
      "a music room with an upright piano and a cello in its case",
      "a cabin loft bed under a skylight",
      "a painter's studio with canvases leaning against the walls",
      "a cellar with cheese wheels ripening on wooden shelves",
      "a breakfast nook with a window onto a garden",
      "a cabinet of curiosities with shells and minerals",
      "a bathhouse with steam and blue tiles",
      "a stained glass workshop with colored light on the bench",
      "a candle maker's workroom with dipped candles hanging in rows",
      "a hat maker's workshop with felt hats on wooden blocks",
      "a sunroom full of plants with a hammock in the corner",
    ],
    lights: ["in warm morning light", "lit by lamps on a rainy evening", "in soft afternoon light", "at golden hour", "by candlelight", "on a snowy afternoon"],
    cameras: ["35mm lens at eye level", "wide-angle from the doorway", "close detail with shallow depth of field", "45-degree view from a corner", "seen through an open doorway"],
    palettes: ["warm wood and cream", "olive and brass tones", "terracotta and linen", "deep green and gold", "honey and charcoal"],
    styles: ["film", "editorial", "painted"],
  },
  {
    slug: "macro-nature",
    subjects: [
      "dew drops on a spider web",
      "a jumping spider with iridescent eyes on a leaf",
      "a bee dusted with pollen on a lavender flower",
      "frost crystals growing on a fallen leaf",
      "the veins of a dragonfly wing",
      "moss and tiny mushrooms on a fallen log",
      "a snail climbing a wet stem",
      "a ladybird on a blade of grass",
      "a fern frond unfurling",
      "raindrops beading on a round leaf",
      "the scales of a butterfly wing",
      "a dandelion seed head",
      "a tree frog on a bright green leaf",
      "air bubbles trapped in a frozen pond",
      "a hoverfly on a yellow daisy",
      "pollen on the stamens of a lily",
      "a caterpillar with bright spines on a leaf",
      "ice needles on a frozen twig",
      "the eye of a chameleon",
      "a praying mantis on a green stem",
      "the gills under a wild mushroom cap",
      "a seed pod bursting open",
      "a dew-covered damselfly",
      "the spiral of a succulent plant",
      "lichen and moss on a grey stone",
      "an ant carrying a leaf fragment",
      "the eye pattern of a peacock feather",
      "the scales of a pine cone",
      "a water drop falling from the tip of a leaf",
    ],
    lights: ["backlit by a low sun", "in soft morning light", "just after rain", "in dappled forest light", "in golden evening light", "in cool overcast light"],
    cameras: ["macro lens, ultra sharp detail", "macro with soft bokeh", "extreme close-up", "macro at eye level with the subject", "close-up against a dark background"],
    palettes: ["golden backlit tones", "emerald and silver", "violet and gold", "frost blue and white", "warm amber and green"],
    styles: ["editorial", "film", "painted"],
  },
  {
    slug: "food-drink",
    subjects: [
      "a bowl of ramen with steam rising",
      "a rustic sourdough loaf torn open",
      "espresso being poured into a ceramic cup",
      "a table of summer fruit, figs and cherries",
      "dumplings in a bamboo steamer",
      "a glass of iced tea with condensation",
      "a stack of pancakes with honey dripping down",
      "a market crate of heirloom tomatoes",
      "a chocolate cake with one slice being lifted",
      "fresh pasta dusted with flour on a wooden board",
      "a glass teapot with dried flowers opening in the tea",
      "skewers sizzling on a small charcoal grill",
      "cream being poured over a bowl of berries",
      "red apples in a woven basket on a wooden table",
      "a bowl of plov with golden carrots and lamb",
      "round flatbreads with stamped patterns, fresh from the oven",
      "tea being poured into a small ceramic bowl",
      "a cheese board with grapes and honeycomb",
      "a lemon tart with a glossy top",
      "sushi on a dark slate",
      "a spoonful of apricot jam over a small ceramic bowl",
      "a steaming bowl of dumpling soup with herbs",
      "a glass of sparkling lemonade with mint",
      "croissants on a cooling rack dusted with sugar",
      "a summer salad of tomatoes and burrata",
      "a pizza with a blistered crust on a wooden peel",
      "chocolate truffles dusted with cocoa",
      "scoops of pistachio ice cream starting to melt",
      "dried fruit and nuts on a brass tray",
    ],
    lights: ["with single window light from the left", "in bright morning light", "in moody low light", "in warm evening light", "in soft diffused light", "in hard sunlight with crisp shadows"],
    cameras: ["45-degree angle with shallow depth of field", "close-up macro", "eye level with a long lens", "low angle at table height", "three-quarter view"],
    palettes: ["dark walnut and cream", "linen and terracotta", "deep green and copper", "pastel pink and white", "charcoal and warm gold"],
    styles: ["editorial", "studio", "film"],
  },
  {
    slug: "vehicles",
    subjects: [
      "an old steam locomotive puffing through a snowy mountain pass",
      "a small vintage car far below on a coastal road, seen from the cliffs",
      "a motorcycle silhouetted against the sunset on an empty plateau road",
      "a seaplane far off across a mirror-calm lake",
      "a horse-drawn hay wagon in a wheat field",
      "a passenger train crossing a stone viaduct",
      "a canvas-topped wooden caravan beside a forest lake",
      "a cargo ship far out at sea under a towering cloud",
      "an old tram rolling through a tunnel of autumn trees",
      "a hydrofoil speeding across a blue bay",
      "a motorcycle with a sidecar far down a country lane",
      "a wooden sailboat under full sail",
      "a small propeller plane banking over a patchwork of fields",
      "a red funicular climbing a steep hillside",
      "a gondola lift gliding over a misty valley",
      "a yellow tram climbing a cobbled hill",
      "a snowcat grooming a ski slope",
      "a small wooden rowing boat drifting on a grey sea, gulls wheeling overhead",
      "a vintage bicycle with a basket of bread against a wall",
      "a vintage motorboat cutting a wake across a quiet lake",
      "a hot air balloon being inflated in a field",
      "a cable ferry crossing a wide river",
      "a small truck far down a road between lavender fields, seen from above",
      "a mint-green rowboat tied at a stone jetty",
      "a biplane flying low over fields",
      "a freight train crossing a high desert bridge",
      "a dust cloud trailing a distant car on a long gravel road",
      "a narrowboat drifting through morning mist on a canal",
      "an airship drifting over rolling green hills",
    ],
    lights: ["at golden hour", "in morning fog", "under stormy skies", "at blue hour", "in bright clean daylight", "at dusk"],
    cameras: ["wide-angle at eye level", "low angle", "long lens compression", "three-quarter view", "aerial view"],
    palettes: ["faded film colors", "red and slate", "cream and racing green", "teal and orange", "soft pastel tones"],
    styles: ["film", "editorial"],
  },
  {
    slug: "portraits",
    subjects: [
      "editorial portrait of a woman in her thirties in a wool coat on a snowy street",
      "a dancer in her twenties in a flowing red dress, mid-spin",
      "a woman in her thirties in a sculptural white gown in the desert wind",
      "an older woman with silver hair in a tailored blazer",
      "a cellist in her forties playing in an empty concert hall",
      "a model in her twenties in an oversized knit sweater in a windswept field",
      "a woman in her fifties in a hand-embroidered jacket against a painted wall",
      "a woman in her forties in a silk headscarf and sunglasses in a vintage convertible",
      "a woman in her twenties with short bleached hair in a leather jacket in a tiled doorway",
      "a woman in her sixties with laugh lines in a bright knitted cardigan in her garden",
      "a potter in her thirties with clay on her hands at the wheel",
      "a woman in her forties with dark curly hair in a tailored suit on a city staircase",
      "a woman in her twenties with long braids in a sunflower field",
      "a falconer in her thirties with a hooded falcon on her gloved arm on a windy hill",
      "a woman in her fifties in a wide-brimmed hat in a vineyard",
      "portrait of a man in his sixties with a silver beard in a linen suit",
      "a man in his twenties in a yellow raincoat",
      "a chef in his forties in a white apron plating a dish",
      "a man in his thirties in a long trench coat on a train platform",
      "a luthier in his fifties restringing a guitar in his workshop",
      "a man in his twenties with curly hair in a denim jacket on a city rooftop",
      "a man in his forties with a shaved head in a charcoal turtleneck against a concrete wall",
      "an older man with a white mustache in a flat cap at a fishing harbor",
      "a man in his thirties with freckles and red hair in a fisherman's sweater by the sea",
      "a man in his fifties in round glasses by a rain-streaked window",
      "a dancer in his twenties mid-leap in an empty studio",
      "a man in his thirties with a long braid in an embroidered coat in a snowy field",
      "a beekeeper in his sixties holding a honeycomb frame",
      "a cyclist in his thirties in a rain jacket resting on a mountain road",
    ],
    lights: ["in soft daylight", "at golden hour", "in overcast light", "at blue hour", "with dramatic side light", "in warm window light"],
    cameras: ["85mm lens", "50mm lens at eye level", "full-length shot with a 35mm lens", "close-up portrait", "low angle"],
    palettes: ["muted earth tones", "cream and camel tones", "bold red and black", "pastel blue and sand", "monochrome with one color accent"],
    styles: ["editorial", "film"],
  },
  {
    slug: "surreal",
    subjects: [
      "floating glass spheres refracting a soft gradient",
      "a spiral staircase rising into the clouds",
      "a door standing alone in the middle of a desert",
      "an upside-down city reflected in a calm sea",
      "a giant moon resting on a field of wheat",
      "paper boats floating through a flooded library",
      "a whale swimming through the sky above rooftops",
      "a house balanced on a rock pillar above the sea",
      "liquid chrome waves frozen in mid-air",
      "a forest growing inside a glass bottle",
      "an endless corridor of pastel arches",
      "clouds drifting through an empty living room",
      "a tree with glowing lanterns instead of leaves",
      "a paper hot air balloon over an ink-wash sea",
      "a ladder leaning against a cloud",
      "a lone swing hanging from the moon over the sea",
      "a train gliding across the surface of a calm lake",
      "giant dandelion seeds carrying tiny houses through the air",
      "a giant goldfish floating above a quiet street",
      "a floating island with a waterfall pouring off its edge",
      "a grand piano on a beach at the edge of the tide",
      "a field of lightbulbs glowing like flowers",
      "stairs leading down into a pool of stars",
      "a rowboat drifting on a sea of clouds",
      "a lighthouse standing in a giant teacup on the ocean",
      "a forest of trees hanging upside down from the sky",
      "a door frame on a hill opening onto a night sky",
      "a deer made of glowing branches in a misty field",
      "a street where the buildings fold up like paper",
    ],
    lights: ["in soft diffused light", "at golden hour", "under a pale lilac sky", "with a soft inner glow", "at dusk", "in pale pastel light"],
    cameras: ["wide shot with negative space", "centered symmetrical composition", "low angle", "dramatic wide-angle", "eye-level view from a distance"],
    palettes: ["peach and lilac", "cobalt and gold", "pastel mint and pink", "monochrome cream", "deep teal and coral"],
    styles: ["fineArt", "painted"],
  },
];

/** A `camera-moves` scene: one image, animated with each move. */
export interface CameraScene {
  slug: string;
  image: string;
  /** What the move centers on, what it reveals, what keeps moving, and what bullet time freezes. */
  focus: string;
  context: string;
  ambient: string;
  frozen: string;
}

export const CAMERA_SCENES: CameraScene[] = [
  {
    slug: "lighthouse",
    image: "a white lighthouse on a stormy cliff, huge waves breaking on the rocks below, dark storm clouds, its beam cutting through the rain",
    focus: "the lighthouse",
    context: "the stormy cliffs and the sea",
    ambient: "waves crash below and storm clouds move",
    frozen: "the breaking waves and the spray hang frozen in the air",
  },
  {
    slug: "red-car",
    image: "a small red vintage car on a winding mountain road far below, seen from high above, snowy peaks all around, late afternoon sun",
    focus: "the small red car",
    context: "the winding road and the peaks",
    ambient: "dust lifts from the road and clouds drift over the peaks",
    frozen: "the dust from the road hangs frozen in the air",
  },
  {
    slug: "neon-alley",
    image: "a narrow alley at night after rain, glowing with colored light from out-of-focus neon, a glowing red doorway at its far end, puddles reflecting the colors, steam rising from a vent",
    focus: "the glowing red doorway",
    context: "the whole alley",
    ambient: "steam drifts and neon light flickers in the puddles",
    frozen: "the steam and the dripping water hang frozen in the air",
  },
  {
    slug: "snow-leopard-statue",
    image: "a stone statue of a snow leopard in a quiet courtyard, old trees around it, light snow falling, soft overcast light",
    focus: "the snow leopard statue",
    context: "the snowy courtyard",
    ambient: "snow falls softly",
    frozen: "the falling snowflakes hang frozen in the air",
  },
];

export const CAMERA_SCENE_STYLE = "cinematic wide shot, film still";

export interface CameraMove {
  slug: string;
  /** The Cinema Studio `camera_movement` for the scene made with presets. */
  preset: CinemaStudioMove;
  /** The move in words, for Kling, which has no camera setting. */
  prompt: (scene: CameraScene) => string;
  /** Kling didn't show this move in the tests, so only the preset scene has it. */
  presetOnly?: true;
}

/**
 * The 8 camera moves. Every Kling move starts from the image itself: no full orbits, no whip
 * pans that land elsewhere. The preset-only moves keep their Kling prompt: the tests used it.
 */
export const CAMERA_MOVES: CameraMove[] = [
  { slug: "dolly-in", preset: "dolly-in", prompt: (s) => `Slow, steady dolly in toward ${s.focus} while ${s.ambient}` },
  { slug: "dolly-out", preset: "dolly-out", prompt: (s) => `Slow, steady dolly out from ${s.focus}, revealing ${s.context}, while ${s.ambient}` },
  {
    slug: "orbit",
    preset: "drone-orbit",
    prompt: (s) => `The camera arcs about 90 degrees around ${s.focus} in one smooth move while ${s.ambient}`,
    presetOnly: true,
  },
  { slug: "crane-up", preset: "crane-up", prompt: (s) => `The camera rises smoothly above ${s.focus} to reveal ${s.context}, while ${s.ambient}` },
  { slug: "crash-zoom", preset: "crush-zoom", prompt: (s) => `Sudden fast crash zoom into ${s.focus}, then hold, while ${s.ambient}`, presetOnly: true },
  { slug: "whip-pan", preset: "whip-pan", prompt: (s) => `The camera holds on ${s.focus}, then whips fast to the side with motion blur` },
  {
    slug: "dolly-zoom",
    preset: "dolly-zoom",
    prompt: (s) => `Dolly zoom: the camera pulls back while zooming in, so ${s.focus} stays the same size and the background stretches`,
    presetOnly: true,
  },
  {
    slug: "bullet-time",
    preset: "bullet-time",
    prompt: (s) => `Bullet time: ${s.frozen}, and the camera glides in a slow arc around ${s.focus}`,
    presetOnly: true,
  },
];

/**
 * The story's hero. Shots call it "the robot", get this description as a sentence of its own,
 * and use the hero sheet as a reference image, so it stays the same robot.
 */
export const STORY_HERO =
  "a small round orange delivery robot with glowing blue eyes, two rubber wheels and a wicker basket on top";

/** One style line for the whole story (no studio names). */
export const STORY_STYLE =
  "stylized 3D animated film look, soft global illumination, warm orange and teal palette, gentle depth of field";

/** Time and weather, so the cut stays continuous: rain in the city, then a clear, snowy climb. */
const CITY_NIGHT = "at night in light rain";
const SNOW_NIGHT = "on a cold clear night with light snow";

/** The robot carries a glowing apple across a city at night to a house in the mountains. */
export const STORY_SHOTS: { shot: string; image: string; when: string; motion: string }[] = [
  { shot: "01-wide", image: "Wide shot of a city of low apartment blocks and poplar trees, snowy mountains glowing behind it, streetlights turning on", when: "at dusk", motion: "Streetlights flicker on one by one as clouds drift over the mountains, slow push-in" },
  { shot: "02-medium", image: "Medium shot of the robot rolling out of a small workshop door onto the street, warm light from inside", when: CITY_NIGHT, motion: "The robot rolls out through the door onto the street as the camera follows" },
  { shot: "03-closeup", image: "Close-up of the face of the robot, its eyes lighting up blue", when: CITY_NIGHT, motion: "Its eyes flicker and light up bright blue, and it tilts its head" },
  { shot: "04-insert", image: "Insert shot of a glowing golden apple being placed into the basket of the robot by a hand in a knitted sleeve", when: CITY_NIGHT, motion: "A hand gently places the glowing apple into the basket, light spilling over the rim" },
  { shot: "05-wide", image: "Wide shot of a street with colorful shop lights blurred into soft bokeh and reflected on wet asphalt, the robot small in the frame", when: CITY_NIGHT, motion: "Rain falls as the robot rolls along the street and the reflections ripple" },
  { shot: "06-tracking", image: "Tracking shot alongside the robot rolling past parked cars and puddles", when: CITY_NIGHT, motion: "The camera tracks alongside the robot as it rolls forward, rain streaking past" },
  { shot: "07-medium", image: "Medium shot of the robot stopping at a big puddle at the bottom of stone stairs", when: CITY_NIGHT, motion: "The robot slows at the puddle and looks up the stairs as raindrops ripple the water" },
  { shot: "08-closeup", image: "Close-up of the wheels of the robot splashing through a puddle", when: CITY_NIGHT, motion: "The wheels roll through the puddle and water splashes up in slow motion" },
  { shot: "09-cutaway", image: "A ginger cat watching from a lit apartment window with rain on the glass", when: CITY_NIGHT, motion: "The cat follows something with its eyes and its tail flicks" },
  { shot: "10-wide", image: "Wide shot of a tram passing on an avenue while the robot waits at the crossing", when: CITY_NIGHT, motion: "The tram passes through the frame while the robot waits, then starts to roll" },
  { shot: "11-crane-up", image: "High view above the robot rolling up a steep hillside street, the city lights spreading out below toward the mountains", when: "on a cold clear night", motion: "Crane up from the robot to reveal the city lights below" },
  { shot: "12-wide", image: "Wide shot of the robot climbing a winding road toward snowy mountains, the city lights behind", when: SNOW_NIGHT, motion: "The robot climbs the road as the camera slowly follows from behind" },
  { shot: "13-closeup", image: "Close-up of the glowing apple in the basket of the robot, glowing brighter in the cold air", when: SNOW_NIGHT, motion: "The apple pulses brighter as snowflakes start to fall around it" },
  { shot: "14-medium", image: "Medium shot of the warm wooden door of a mountain house opening, a hand in a wool sleeve reaching for the apple in the basket of the robot", when: SNOW_NIGHT, motion: "The door opens, warm light spills out, and a hand takes the apple" },
  { shot: "15-wide", image: "Wide shot of the robot rolling away down a snowy road under bright stars and snowy peaks", when: "on a cold clear night", motion: "The robot rolls away into the distance as the stars twinkle, slow pull back" },
];

/** Same scene by day and by night, for the compare slider. The night image re-lights the day one. */
export const DAY_NIGHT_SCENES = [
  "a lakeside village with wooden piers",
  "a town square with a fountain and old trees",
  "a mountain road with a lone roadside café",
  "a seaside boardwalk with a carousel",
  "a mountain railway platform",
];

/** One clear subject, so the framing difference between ratios is easy to see. */
export const RATIO_SCENES = [
  "an adult in a yellow coat at the end of a wooden pier on a misty lake, seen from behind",
  "a blue bicycle leaning against a sunlit ochre wall",
  "a small wooden cabin in a snowy mountain meadow",
  "a lighthouse on a rocky point under a clear sky",
  "a red umbrella in the middle of a rainy cobblestone square",
  "a lone tree on a hill in a field of golden wheat",
  "a sailboat on a calm turquoise sea",
  "a small vintage camper van far away on a straight desert road",
  "a ginger cat sitting on a windowsill between potted plants",
  "a hot air balloon over green rolling hills",
];

export const RATIO_STYLE = "clean editorial photograph, natural light, the subject clearly placed in the frame";

/**
 * An Almaty topic. Landscapes use the shared lights, cameras and style; topics that aren't
 * landscapes (animals, buildings, close-ups, the market) bring their own.
 */
export interface AlmatyTopic {
  text: string;
  lights?: string[];
  cameras?: string[];
  style?: string;
}

export const ALMATY_LIGHTS = ["at dawn", "at golden hour", "at blue hour", "in soft overcast light", "in clear morning light", "at sunset"];
export const ALMATY_CAMERAS = ["aerial view", "wide-angle", "long lens compression", "low angle", "from a high ridge"];
export const ALMATY_STYLE = "fine-art landscape photograph, natural color, crisp detail";

const ANIMAL_CAMERAS = ["long lens compression", "low angle", "from a high ridge", "telephoto at eye level"];
const BUILDING_CAMERAS = ["wide-angle at street level", "low angle", "long lens compression", "frontal symmetrical view"];
const ARCHITECTURE_STYLE = "fine-art architecture photograph, natural color, crisp detail";
const STILL_LIFE = {
  lights: ["in soft window light", "in warm evening light", "in soft daylight"],
  cameras: ["top-down view", "close-up", "45-degree angle"],
  style: "fine-art still life photograph, natural color, crisp detail",
};

/** Almaty and the steppe: 35 topics, 3 or 4 images each. Landscapes, nature and places, no people. */
export const ALMATY_TOPICS: AlmatyTopic[] = [
  { text: "snow-capped Tian Shan peaks rising above a city" },
  { text: "Big Almaty Lake, turquoise water below rocky peaks" },
  { text: "Charyn Canyon, red rock walls above a winding river" },
  { text: "one of the Kolsai lakes, surrounded by dark spruce forest" },
  { text: "Kaindy Lake, the trunks of a sunken spruce forest rising from turquoise water" },
  { text: "the Singing Dunes of Altyn-Emel, a lone dune between rocky mountains" },
  { text: "the Assy plateau, green pastures under rolling mountains" },
  { text: "a waterfall in the Turgen gorge, framed by green slopes" },
  { text: "a mountain river rushing through a spruce forest" },
  { text: "spruce forests on the slopes of the Ile-Alatau mountains in fog" },
  { text: "the winding road to the high mountains above the city" },
  { text: "a cable car rising above the clouds toward snowy ski slopes" },
  { text: "wild horses running across the open steppe" },
  { text: "wild tulips blooming across the spring steppe" },
  { text: "the steppe under the first snow of winter" },
  { text: "white yurts in a green mountain meadow" },
  { text: "a flock of sheep moving across a mountain pasture" },
  { text: "an apple orchard in bloom with mountains behind" },
  { text: "an apple orchard in autumn, red apples on the branches" },
  { text: "an avenue of tall poplars in golden autumn", cameras: BUILDING_CAMERAS },
  { text: "a snow leopard on a rocky mountain ledge", cameras: ANIMAL_CAMERAS },
  { text: "a golden eagle gliding over a mountain valley" },
  { text: "saiga antelopes crossing the open steppe", cameras: ANIMAL_CAMERAS },
  { text: "camels resting on the shore of Lake Balkhash", cameras: ANIMAL_CAMERAS },
  { text: "ancient petroglyphs of animals on dark boulders", cameras: ["close-up", "low angle", "wide-angle"] },
  { text: "a modernist building with a large abstract mosaic mural inspired by Soviet-era design", cameras: BUILDING_CAMERAS, style: ARCHITECTURE_STYLE },
  { text: "Soviet-era apartment blocks with mosaic panels, the mountains rising behind", cameras: BUILDING_CAMERAS, style: ARCHITECTURE_STYLE },
  { text: "a colorful wooden cathedral in a snowy park", cameras: BUILDING_CAMERAS, style: ARCHITECTURE_STYLE },
  {
    text: "a trolleybus small in the frame on a snowy avenue, the mountains behind",
    lights: ["on a winter morning", "at blue hour", "in falling snow"],
    cameras: ["wide-angle at street level", "long lens compression", "from a high window"],
    style: "fine-art city photograph, natural color, crisp detail",
  },
  {
    text: "crates of apricots, melons and dried fruit piled high at a market stall",
    lights: ["in soft morning light", "in warm afternoon light", "under hanging lamps"],
    cameras: ["at eye level", "from above the stalls", "35mm lens"],
    style: "documentary photograph, natural color, crisp detail",
  },
  {
    text: "a city at night with the mountains behind it",
    lights: ["at blue hour", "after dark under a clear sky", "on a winter night after snowfall", "at night with mist on the mountains", "just after sunset", "under a full moon"],
  },
  { text: "a high-mountain ice rink lit up below snowy slopes", lights: ["at night under floodlights", "at blue hour", "at night in falling snow"] },
  { text: "a mountain hut under a sky full of stars", lights: ["under a starry night sky", "at blue hour", "just after sunset"] },
  { text: "a felt carpet with bold traditional patterns", ...STILL_LIFE },
  { text: "a dombra resting on a felt carpet", ...STILL_LIFE },
];

/** Building blocks for transitions and film looks. */
export const TEXTURES: Subject[] = [
  { text: "16mm film grain and dust specks on pure black", motion: "the grain flickers and dust specks drift" },
  { text: "a warm orange light leak bleeding across black film", motion: "the light leak slowly pulses and drifts" },
  { text: "a soft red and gold light leak with a gentle lens flare", motion: "the light leak breathes and slides across the frame" },
  { text: "thin wisps of white smoke on black", motion: "the smoke curls and drifts upward" },
  { text: "dense white fog drifting across a black background", motion: "the fog rolls slowly across the frame" },
  { text: "blue ink blooming in clear water", motion: "the ink blooms and swirls outward" },
  { text: "red ink clouds swirling in water", motion: "the ink clouds swirl and spread" },
  { text: "dust particles floating in a single beam of light", motion: "the dust floats slowly through the beam" },
  { text: "a blue anamorphic lens flare streak on black", motion: "the flare streak glides slowly sideways" },
  { text: "a soft peach to lilac gradient with fine grain", motion: "the gradient slowly shifts" },
  { text: "a deep teal to black gradient with film grain", motion: "the gradient breathes as the grain flickers" },
  { text: "rain streaks on a dark window with bokeh lights behind", motion: "raindrops run down the glass" },
  { text: "orange sparks falling on black", motion: "the sparks fall and fade" },
  { text: "out-of-focus warm city lights as soft bokeh", motion: "the bokeh lights drift and twinkle" },
  { text: "fine scratches and dust on old black film, close up", motion: "the scratches and dust flicker and jitter" },
  { text: "frosted cracked glass backlit in cool light", motion: "the light slowly moves behind the glass" },
  { text: "warm off-white paper with subtle fibers", motion: "soft light slowly passes over the paper" },
  { text: "glowing embers and ash drifting upward on black", motion: "the embers rise and drift" },
  { text: "swirls of liquid gold in macro", motion: "the liquid gold slowly swirls" },
  { text: "soft caustic light from water dancing on a white wall", motion: "the caustic light dances across the wall" },
];

export const TEXTURE_STYLE = "high-detail texture for compositing, clean background";
/** Added to every texture video. Loops are made in editing (a crossfade), not asked of the model. */
export const TEXTURE_MOTION_STYLE = "static camera, slow movement";

/** The `ads` collection's fictional brand. The name is never in a prompt: AI text looks broken. */
export const AD_BRAND = { name: "Aralune", look: "sage green, cream and copper" };

/** A 16:9 setup for a video; `scene` shots use the lifestyle style instead of the studio one. */
export interface AdShot extends Subject {
  scene?: boolean;
}

/**
 * One product. Its hero packshot is generated first; every other image of it uses the hero as
 * a reference, so it is the same product everywhere.
 */
export interface AdProduct {
  slug: string;
  /** The product as it appears in its prompts, unbranded. */
  item: string;
  /** How the group shots name it. */
  short: string;
  heroBackground: string;
  /** Three more packshots, one per background. */
  backgrounds: string[];
  /** An angle and a close detail. */
  details: string[];
  /** Lifestyle scenes. */
  scenes: string[];
  /** 16:9 shots for videos; most move sideways across the frame, for Batch Reframe. */
  inMotion: AdShot[];
}

export const AD_PRODUCTS: AdProduct[] = [
  {
    slug: "coffee",
    item: "a matte sage-green paper coffee bag with a folded top and a copper clip, beside a cream ceramic cup",
    short: "the coffee bag and cup",
    heroBackground: "warm cream",
    backgrounds: ["terracotta", "deep teal", "butter yellow"],
    details: ["a top-down view of the bag and cup with coffee beans scattered around them", "a macro detail of the bag's matte texture and copper clip"],
    scenes: ["on a sunny café table by a window", "on a wooden counter in a mountain cabin kitchen", "on a picnic blanket in an apple orchard", "on a desk beside a ceramic pencil cup and a plant"],
    inMotion: [
      { text: "a cream cup of coffee on a long wooden bar, plain sage wall behind", motion: "the cup slides steadily from left to right along the bar as steam trails behind it" },
      { text: "coffee being poured from a copper kettle into a cream cup, side view on a plain sage background", motion: "coffee pours steadily into the cup as steam rises and the camera slides from left to right" },
      { text: "coffee beans falling around the sage-green coffee bag on a plain background", motion: "coffee beans fall and bounce past the bag" },
    ],
  },
  {
    slug: "sneakers",
    item: "a plain cream and sage knit sneaker with copper eyelets",
    short: "the knit sneaker",
    heroBackground: "pale sage",
    backgrounds: ["sky blue", "terracotta", "charcoal"],
    details: ["a side profile of the sneaker showing its sole and heel", "a macro detail of the knit texture and copper eyelets"],
    scenes: ["on a wet city street at dusk", "on a rock on a mountain trail", "on the edge of a running track", "on a sunlit concrete staircase"],
    inMotion: [
      { text: "a single knit sneaker mid-bounce on a plain cream background", motion: "the sneaker bounces from the left edge of the frame to the right edge" },
      { text: "legs in cream knit sneakers walking along a sunny concrete wall, low side view", motion: "the legs stride from left to right across the frame along the wall", scene: true },
      { text: "a knit sneaker landing in a splash of water, plain blue background", motion: "the sneaker drops into the water and the splash rises" },
    ],
  },
  {
    slug: "headphones",
    item: "smooth cream over-ear wireless headphones with copper details",
    short: "the headphones",
    heroBackground: "warm cream",
    backgrounds: ["deep teal", "coral", "slate grey"],
    details: ["the headphones folded flat, seen from above", "a macro detail of the copper hinge and the cushion stitching"],
    scenes: ["on a desk by a rainy window", "hanging on a chair in a sunny studio apartment", "on a train seat with mountains outside", "on a stack of vinyl records"],
    inMotion: [
      { text: "cream headphones floating against a soft sage gradient", motion: "the headphones float from left to right across the frame while slowly rotating" },
      { text: "cream headphones resting on the right side of a long glossy table", motion: "the headphones glide from right to left across the glossy table" },
      { text: "cream headphones floating above water with sound-wave ripples beneath them", motion: "ripples spread across the water under the floating headphones" },
    ],
  },
  {
    slug: "perfume",
    item: "a faceted glass perfume bottle with a copper cap",
    short: "the perfume bottle",
    heroBackground: "pale pink",
    backgrounds: ["warm cream", "deep teal", "amber"],
    details: ["the bottle seen from a low angle with light shining through its facets", "a macro detail of the faceted glass and the copper cap"],
    scenes: ["on travertine stone in hard sunlight", "among white flowers on a windowsill", "on a marble bathroom shelf", "on sand at the edge of the sea"],
    inMotion: [
      { text: "a perfume bottle suspended in clear water with rising bubbles, plain background", motion: "the bottle drifts from left to right through the water as bubbles rise" },
      { text: "a perfume bottle with silk fabric falling around it, plain cream background", motion: "silk fabric falls slowly around the bottle" },
      { text: "a perfume bottle on a mirror stand", motion: "the bottle turns slowly as light sweeps across the glass" },
    ],
  },
];

/** The brand family together: 4 studio settings, then 4 lifestyle ones. */
export const AD_GROUP_PACKSHOTS = [
  "arranged in a neat row on a plain warm cream background",
  "on stacked sage and terracotta plinths",
  "in a top-down layout on a plain deep teal background",
  "in a soft copper-toned set with arches",
];
export const AD_GROUP_SCENES = [
  "packed in an open weekend bag on a linen bed",
  "on a sunny shelf in a minimalist apartment",
  "on a picnic blanket in an apple orchard",
  "on a wooden bench by a mountain lake",
];

// No "no text or logos": naming what to avoid tends to put it in the picture. Products are
// described as plain and unmarked instead.
export const AD_PACKSHOT_STYLE = "clean studio product photograph, crisp detail, soft shadows, plain unmarked surfaces";
export const AD_SCENE_STYLE = "editorial lifestyle photograph, natural light";
