import { getRouteHubById } from "@/components/dashboard/assessment/steps/routeHubs";

export type RailRouteCoordinate = [number, number];

export interface RailRouteNode {
  id: string;
  kind: "rail_terminal";
  lat: number;
  lng: number;
  hubId: string;
}

export interface RailRouteEdge {
  costMultiplier: number;
  fromId: string;
  geometry: RailRouteCoordinate[];
  id: string;
  toId: string;
}

type RailRouteEdgeSeed = {
  bidirectional?: boolean;
  costMultiplier?: number;
  fromId: string;
  id: string;
  toId: string;
  via?: RailRouteCoordinate[];
};

const createTerminalNode = (hubId: string): RailRouteNode => {
  const hub = getRouteHubById(hubId);
  if (!hub || hub.kind !== "rail_terminal") {
    throw new Error(`Rail route terminal hub not found: ${hubId}`);
  }

  return {
    id: hubId,
    kind: "rail_terminal",
    lat: hub.lat,
    lng: hub.lng,
    hubId
  };
};

const edge = (
  id: string,
  fromId: string,
  toId: string,
  via: RailRouteCoordinate[] = [],
  options: Pick<RailRouteEdgeSeed, "bidirectional" | "costMultiplier"> = {}
): RailRouteEdgeSeed => ({
  id,
  fromId,
  toId,
  via,
  bidirectional: options.bidirectional ?? true,
  costMultiplier: options.costMultiplier
});

const RAIL_ROUTE_TERMINAL_HUB_IDS = [
  "SONG_THAN",
  "KIM_LIEN_RAIL",
  "GIAP_BAT",
  "YEN_VIEN",
  "LAO_CAI_RAIL",
  "DONG_DANG_RAIL",
  "NANNING_RAIL",
  "GUANGZHOU_RAIL",
  "SHENZHEN_RAIL",
  "SHANGHAI_RAIL",
  "CHENGDU_QBJ",
  "XIAN_RAIL",
  "KHORGOS",
  "ALASHANKOU",
  "MALASZEWICZE",
  "BILK",
  "DUISBURG",
  "HAMBURG_BILL",
  "VIENNA_SOUTH",
  "TASHKENT_RAIL",
  "APRIN_RAIL",
  "HALKALI"
] as const;

export const RAIL_ROUTE_TERMINALS = RAIL_ROUTE_TERMINAL_HUB_IDS.map((hubId) =>
  createTerminalNode(hubId)
);

export const RAIL_ROUTE_NODE_BY_ID = RAIL_ROUTE_TERMINALS.reduce<Record<string, RailRouteNode>>(
  (accumulator, node) => {
    accumulator[node.id] = node;
    return accumulator;
  },
  {}
);

const RAIL_ROUTE_EDGE_SEEDS: RailRouteEdgeSeed[] = [
  edge("song-than-kim-lien", "SONG_THAN", "KIM_LIEN_RAIL", [
    [107.25, 11.2],
    [108.0, 12.8],
    [108.16, 15.2]
  ]),
  edge("kim-lien-giap-bat", "KIM_LIEN_RAIL", "GIAP_BAT", [
    [107.5, 17.8],
    [106.9, 19.3],
    [105.95, 20.7]
  ]),
  edge("giap-bat-yen-vien", "GIAP_BAT", "YEN_VIEN", [[105.88, 21.03]]),
  edge("yen-vien-dong-dang", "YEN_VIEN", "DONG_DANG_RAIL", [
    [106.18, 21.28],
    [106.46, 21.55]
  ]),
  edge("yen-vien-lao-cai", "YEN_VIEN", "LAO_CAI_RAIL", [
    [105.28, 21.55],
    [104.72, 21.9],
    [104.18, 22.28]
  ]),
  edge("dong-dang-nanning", "DONG_DANG_RAIL", "NANNING_RAIL", [
    [107.55, 22.0],
    [108.0, 22.25]
  ]),
  edge("lao-cai-chengdu", "LAO_CAI_RAIL", "CHENGDU_QBJ", [
    [103.42, 23.78],
    [102.7, 25.08],
    [102.48, 27.18],
    [103.45, 29.2]
  ]),
  edge("nanning-guangzhou", "NANNING_RAIL", "GUANGZHOU_RAIL", [
    [109.4, 23.0],
    [111.1, 23.15]
  ]),
  edge("nanning-shenzhen", "NANNING_RAIL", "SHENZHEN_RAIL", [
    [109.5, 22.92],
    [111.7, 22.85],
    [113.18, 22.62]
  ]),
  edge("nanning-shanghai", "NANNING_RAIL", "SHANGHAI_RAIL", [
    [110.8, 24.7],
    [113.5, 27.1],
    [117.4, 29.6],
    [119.8, 30.8]
  ]),
  edge("nanning-xian", "NANNING_RAIL", "XIAN_RAIL", [
    [108.9, 25.8],
    [108.9, 29.2],
    [108.95, 32.1]
  ]),
  edge("chengdu-xian", "CHENGDU_QBJ", "XIAN_RAIL", [
    [105.5, 31.55],
    [107.05, 33.22]
  ]),
  edge("xian-khorgos", "XIAN_RAIL", "KHORGOS", [
    [103.55, 36.2],
    [94.5, 40.1],
    [85.3, 43.65]
  ]),
  edge("chengdu-alashankou", "CHENGDU_QBJ", "ALASHANKOU", [
    [101.7, 34.4],
    [92.4, 39.25],
    [84.2, 44.8]
  ]),
  edge("khorgos-tashkent", "KHORGOS", "TASHKENT_RAIL", [
    [75.1, 43.2],
    [71.2, 41.8]
  ]),
  edge("tashkent-aprin", "TASHKENT_RAIL", "APRIN_RAIL", [
    [65.1, 39.7],
    [58.2, 36.95],
    [53.0, 36.0]
  ]),
  edge("aprin-halkali", "APRIN_RAIL", "HALKALI", [
    [44.3, 39.1],
    [35.8, 39.3],
    [29.8, 40.8]
  ]),
  edge("halkali-vienna", "HALKALI", "VIENNA_SOUTH", [
    [25.2, 42.5],
    [21.0, 44.4],
    [17.0, 46.2]
  ]),
  edge("khorgos-malaszewicze", "KHORGOS", "MALASZEWICZE", [
    [69.7, 48.2],
    [56.0, 52.5],
    [41.0, 53.8],
    [29.5, 52.7]
  ]),
  edge("alashankou-bilk", "ALASHANKOU", "BILK", [
    [73.8, 47.6],
    [58.0, 48.2],
    [41.5, 47.8],
    [27.0, 47.45]
  ]),
  edge("malaszewicze-duisburg", "MALASZEWICZE", "DUISBURG", [
    [19.6, 52.0],
    [14.0, 52.0],
    [9.2, 51.58]
  ]),
  edge("bilk-vienna", "BILK", "VIENNA_SOUTH", [[17.55, 47.85]]),
  edge("bilk-duisburg", "BILK", "DUISBURG", [
    [15.6, 48.6],
    [11.5, 49.5],
    [8.25, 50.55]
  ]),
  edge("duisburg-hamburg-bill", "DUISBURG", "HAMBURG_BILL", [
    [7.7, 52.0],
    [8.65, 53.0],
    [9.6, 53.35]
  ])
];

const buildRouteEdge = (seed: RailRouteEdgeSeed): RailRouteEdge => {
  const fromNode = RAIL_ROUTE_NODE_BY_ID[seed.fromId];
  const toNode = RAIL_ROUTE_NODE_BY_ID[seed.toId];

  if (!fromNode || !toNode) {
    throw new Error(`Rail route edge references unknown node: ${seed.id}`);
  }

  return {
    id: seed.id,
    fromId: seed.fromId,
    toId: seed.toId,
    costMultiplier: seed.costMultiplier ?? 1,
    geometry: [
      [fromNode.lng, fromNode.lat],
      ...(seed.via || []),
      [toNode.lng, toNode.lat]
    ]
  };
};

const RAIL_ROUTE_EDGES_INTERNAL = RAIL_ROUTE_EDGE_SEEDS.flatMap((seed) => {
  const forward = buildRouteEdge(seed);
  if (seed.bidirectional === false) {
    return [forward];
  }

  return [
    forward,
    {
      ...forward,
      id: `${seed.id}__reverse`,
      fromId: seed.toId,
      toId: seed.fromId,
      geometry: [...forward.geometry].reverse()
    }
  ];
});

export const RAIL_ROUTE_EDGES = RAIL_ROUTE_EDGES_INTERNAL;
