import { getRouteHubById } from "@/components/dashboard/assessment/steps/routeHubs";

export type SeaRouteCoordinate = [number, number];

export interface SeaRouteNode {
  id: string;
  kind: "port" | "waypoint";
  lat: number;
  lng: number;
  hubId?: string;
}

export interface SeaRouteEdge {
  costMultiplier: number;
  fromId: string;
  geometry: SeaRouteCoordinate[];
  id: string;
  toId: string;
}

type SeaRouteEdgeSeed = {
  bidirectional?: boolean;
  costMultiplier?: number;
  fromId: string;
  id: string;
  toId: string;
  via?: SeaRouteCoordinate[];
};

const createPortNode = (hubId: string): SeaRouteNode => {
  const hub = getRouteHubById(hubId);
  if (!hub || hub.kind !== "port") {
    throw new Error(`Sea route port hub not found: ${hubId}`);
  }

  return {
    id: hubId,
    kind: "port",
    lat: hub.lat,
    lng: hub.lng,
    hubId
  };
};

const createWaypointNode = (
  id: string,
  lat: number,
  lng: number
): SeaRouteNode => ({
  id,
  kind: "waypoint",
  lat,
  lng
});

const edge = (
  id: string,
  fromId: string,
  toId: string,
  via: SeaRouteCoordinate[] = [],
  options: Pick<SeaRouteEdgeSeed, "bidirectional" | "costMultiplier"> = {}
): SeaRouteEdgeSeed => ({
  id,
  fromId,
  toId,
  via,
  bidirectional: options.bidirectional ?? true,
  costMultiplier: options.costMultiplier
});

const SEA_ROUTE_PORT_HUB_IDS = [
  "CAT_LAI",
  "CAI_MEP",
  "LACH_HUYEN",
  "TIEN_SA",
  "QUY_NHON",
  "DUNG_QUAT",
  "PORT_SIN",
  "PORT_KLANG",
  "TANJUNG_PELEPAS",
  "COLOMBO",
  "YANTIAN",
  "PORT_HKG",
  "NANSHA",
  "SHANGHAI_PORT",
  "NINGBO",
  "QINGDAO",
  "BUSAN_PORT",
  "INCHEON_PORT",
  "GWANGYANG_PORT",
  "ULSAN_PORT",
  "POHANG_PORT",
  "TOKYO_PORT",
  "YOKOHAMA",
  "NAGOYA_PORT",
  "KOBE_PORT",
  "OSAKA_PORT",
  "HAKATA_PORT",
  "PIRAEUS",
  "ROTTERDAM",
  "ANTWERP",
  "HAMBURG",
  "PORT_LA",
  "PORT_LB",
  "PORT_NYNJ"
] as const;

const SEA_ROUTE_WAYPOINTS: SeaRouteNode[] = [
  createWaypointNode("SAIGON_ESTUARY", 10.46, 107.18),
  createWaypointNode("VUNG_TAU_APPROACH", 10.24, 107.72),
  createWaypointNode("VN_SOUTH_LANE", 10.6, 109.6),
  createWaypointNode("VN_CENTRAL_LANE", 14.8, 109.9),
  createWaypointNode("SCS_SOUTH", 7.5, 109.0),
  createWaypointNode("SCS_CENTRAL", 13.5, 114.0),
  createWaypointNode("HAINAN_EAST", 19.0, 111.5),
  createWaypointNode("LUZON_STRAIT", 20.5, 121.3),
  createWaypointNode("EAST_CHINA_SEA", 29.0, 125.5),
  createWaypointNode("KOREA_STRAIT", 33.9, 128.8),
  createWaypointNode("MALACCA_EAST", 1.7, 103.7),
  createWaypointNode("MALACCA_WEST", 5.6, 100.2),
  createWaypointNode("ARABIAN_SEA", 14.5, 66.5),
  createWaypointNode("GULF_ADEN", 12.5, 49.0),
  createWaypointNode("RED_SEA_SOUTH", 15.2, 43.8),
  createWaypointNode("RED_SEA_NORTH", 23.0, 36.0),
  createWaypointNode("SUEZ_SOUTH", 29.7, 32.55),
  createWaypointNode("SUEZ_NORTH", 31.2, 32.35),
  createWaypointNode("MEDITERRANEAN_EAST", 34.5, 27.5),
  createWaypointNode("MEDITERRANEAN_CENTRAL", 36.0, 15.0),
  createWaypointNode("GIBRALTAR", 35.95, -5.6),
  createWaypointNode("BAY_OF_BISCAY", 44.5, -8.5),
  createWaypointNode("ENGLISH_CHANNEL", 49.8, 0.0),
  createWaypointNode("NORTH_SEA_GATE", 52.4, 2.7),
  createWaypointNode("NORTH_PACIFIC_WEST", 35.0, 145.0),
  createWaypointNode("NORTH_PACIFIC_CENTRAL", 40.0, 170.0),
  createWaypointNode("NORTH_PACIFIC_EAST", 38.5, -150.0),
  createWaypointNode("SOCAL_APPROACH", 33.0, -126.0),
  createWaypointNode("TROPICAL_PACIFIC_WEST", 17.0, 145.0),
  createWaypointNode("TROPICAL_PACIFIC_CENTRAL", 14.0, 175.0),
  createWaypointNode("TROPICAL_PACIFIC_EAST", 10.0, -130.0),
  createWaypointNode("PANAMA_PACIFIC", 8.9, -79.55),
  createWaypointNode("PANAMA_CARIBBEAN", 9.35, -79.92),
  createWaypointNode("CARIBBEAN_NORTH", 19.0, -72.0),
  createWaypointNode("US_EAST_APPROACH", 33.0, -70.0)
];

export const SEA_ROUTE_PORTS = SEA_ROUTE_PORT_HUB_IDS.map((hubId) => createPortNode(hubId));

const SEA_ROUTE_NODES = [...SEA_ROUTE_PORTS, ...SEA_ROUTE_WAYPOINTS];

export const SEA_ROUTE_NODE_BY_ID = SEA_ROUTE_NODES.reduce<Record<string, SeaRouteNode>>(
  (accumulator, node) => {
    accumulator[node.id] = node;
    return accumulator;
  },
  {}
);

const SEA_ROUTE_EDGE_SEEDS: SeaRouteEdgeSeed[] = [
  edge("cat-lai-saigon-estuary", "CAT_LAI", "SAIGON_ESTUARY", [
    [106.84, 10.72],
    [106.94, 10.64],
    [107.05, 10.56]
  ]),
  edge("saigon-estuary-vung-tau", "SAIGON_ESTUARY", "VUNG_TAU_APPROACH", [
    [107.3, 10.39],
    [107.5, 10.28]
  ]),
  edge("cai-mep-vung-tau", "CAI_MEP", "VUNG_TAU_APPROACH", [
    [107.12, 10.5],
    [107.28, 10.41],
    [107.48, 10.31]
  ]),
  edge("vung-tau-vn-south", "VUNG_TAU_APPROACH", "VN_SOUTH_LANE", [
    [108.2, 10.3],
    [108.95, 10.42]
  ]),
  edge("quy-nhon-vn-central", "QUY_NHON", "VN_CENTRAL_LANE", [[109.6, 13.4]]),
  edge("dung-quat-vn-central", "DUNG_QUAT", "VN_CENTRAL_LANE", [[109.2, 15.0]]),
  edge("tien-sa-vn-central", "TIEN_SA", "VN_CENTRAL_LANE", [[109.1, 16.1]]),
  edge("lach-huyen-hainan-east", "LACH_HUYEN", "HAINAN_EAST", [
    [108.7, 20.7],
    [110.0, 20.0]
  ]),
  edge("lach-huyen-east-china-sea", "LACH_HUYEN", "EAST_CHINA_SEA", [
    [112.0, 22.0],
    [118.0, 25.5]
  ]),
  edge("vn-south-vn-central", "VN_SOUTH_LANE", "VN_CENTRAL_LANE", [[109.8, 12.0]]),
  edge("vn-central-scs-central", "VN_CENTRAL_LANE", "SCS_CENTRAL", [[112.0, 14.2]]),
  edge("vn-south-scs-south", "VN_SOUTH_LANE", "SCS_SOUTH", [[108.5, 8.8]]),
  edge("vn-south-scs-central", "VN_SOUTH_LANE", "SCS_CENTRAL", [
    [111.0, 11.5]
  ]),
  edge("scs-south-scs-central", "SCS_SOUTH", "SCS_CENTRAL", [[111.5, 10.2]]),
  edge("hainan-east-scs-central", "HAINAN_EAST", "SCS_CENTRAL", [[113.0, 16.5]]),
  edge("scs-central-yantian", "SCS_CENTRAL", "YANTIAN", [
    [115.0, 17.5],
    [114.8, 20.5]
  ]),
  edge("yantian-port-hkg", "YANTIAN", "PORT_HKG", [[114.5, 22.3]]),
  edge("yantian-nansha", "YANTIAN", "NANSHA", [[113.9, 22.7]]),
  edge("yantian-shanghai", "YANTIAN", "SHANGHAI_PORT", [
    [117.0, 24.0],
    [120.0, 28.0]
  ]),
  edge("shanghai-ningbo", "SHANGHAI_PORT", "NINGBO", [[121.7, 30.6]]),
  edge("east-china-sea-shanghai", "EAST_CHINA_SEA", "SHANGHAI_PORT", [[123.0, 30.5]]),
  edge("east-china-sea-qingdao", "EAST_CHINA_SEA", "QINGDAO", [[123.0, 34.0]]),
  edge("scs-central-luzon", "SCS_CENTRAL", "LUZON_STRAIT", [
    [118.0, 16.5],
    [120.0, 18.5]
  ]),
  edge("luzon-east-china-sea", "LUZON_STRAIT", "EAST_CHINA_SEA", [[123.5, 24.0]]),
  edge("east-china-sea-korea-strait", "EAST_CHINA_SEA", "KOREA_STRAIT", [
    [127.0, 31.5]
  ]),
  edge("korea-strait-busan", "KOREA_STRAIT", "BUSAN_PORT", [[129.0, 34.7]]),
  edge("east-china-sea-incheon", "EAST_CHINA_SEA", "INCHEON_PORT", [[125.5, 35.5]]),
  edge("korea-strait-gwangyang", "KOREA_STRAIT", "GWANGYANG_PORT", [[128.2, 34.4]]),
  edge("korea-strait-ulsan", "KOREA_STRAIT", "ULSAN_PORT", [[129.2, 35.0]]),
  edge("korea-strait-pohang", "KOREA_STRAIT", "POHANG_PORT", [[129.3, 35.5]]),
  edge("east-china-sea-yokohama", "EAST_CHINA_SEA", "YOKOHAMA", [
    [130.0, 32.5],
    [136.0, 34.5]
  ]),
  edge("east-china-sea-tokyo", "EAST_CHINA_SEA", "TOKYO_PORT", [
    [130.0, 32.8],
    [137.0, 35.0]
  ]),
  edge("yokohama-tokyo", "YOKOHAMA", "TOKYO_PORT", [[139.0, 35.5]]),
  edge("yokohama-nagoya", "YOKOHAMA", "NAGOYA_PORT", [[138.0, 35.2]]),
  edge("east-china-sea-osaka", "EAST_CHINA_SEA", "OSAKA_PORT", [
    [133.5, 34.0]
  ]),
  edge("east-china-sea-kobe", "EAST_CHINA_SEA", "KOBE_PORT", [[133.0, 33.5]]),
  edge("korea-strait-hakata", "KOREA_STRAIT", "HAKATA_PORT", [[130.1, 33.8]]),
  edge("scs-south-malacca-east", "SCS_SOUTH", "MALACCA_EAST", [[105.5, 5.0]]),
  edge("malacca-east-port-sin", "MALACCA_EAST", "PORT_SIN", [[103.5, 1.4]]),
  edge("malacca-east-tanjung", "MALACCA_EAST", "TANJUNG_PELEPAS", [[103.2, 1.5]]),
  edge("malacca-east-port-klang", "MALACCA_EAST", "PORT_KLANG", [[102.4, 2.7]]),
  edge("malacca-east-west", "MALACCA_EAST", "MALACCA_WEST", [
    [102.3, 3.0],
    [101.0, 5.0]
  ]),
  edge("malacca-west-colombo", "MALACCA_WEST", "COLOMBO", [
    [93.0, 8.0],
    [85.0, 7.5]
  ]),
  edge("colombo-arabian-sea", "COLOMBO", "ARABIAN_SEA", [
    [74.0, 8.8],
    [69.0, 12.0]
  ]),
  edge("arabian-sea-gulf-aden", "ARABIAN_SEA", "GULF_ADEN", [
    [59.0, 15.0],
    [53.0, 13.5]
  ]),
  edge("gulf-aden-red-sea-south", "GULF_ADEN", "RED_SEA_SOUTH", [[44.5, 12.7]]),
  edge("red-sea-south-north", "RED_SEA_SOUTH", "RED_SEA_NORTH", [[39.0, 19.0]]),
  edge("red-sea-north-suez-south", "RED_SEA_NORTH", "SUEZ_SOUTH", [[34.0, 27.2]]),
  edge("suez-south-north", "SUEZ_SOUTH", "SUEZ_NORTH", [[32.45, 30.5]]),
  edge("suez-north-med-east", "SUEZ_NORTH", "MEDITERRANEAN_EAST", [[29.8, 32.7]]),
  edge("med-east-piraeus", "MEDITERRANEAN_EAST", "PIRAEUS", [[25.4, 36.0]]),
  edge("med-east-med-central", "MEDITERRANEAN_EAST", "MEDITERRANEAN_CENTRAL", [
    [21.0, 35.7]
  ]),
  edge("med-central-gibraltar", "MEDITERRANEAN_CENTRAL", "GIBRALTAR", [
    [8.0, 36.0],
    [0.5, 36.0],
    [-2.5, 35.9]
  ]),
  edge("gibraltar-biscay", "GIBRALTAR", "BAY_OF_BISCAY", [[-8.5, 42.5]]),
  edge("biscay-channel", "BAY_OF_BISCAY", "ENGLISH_CHANNEL", [[-4.0, 47.0]]),
  edge("channel-north-sea", "ENGLISH_CHANNEL", "NORTH_SEA_GATE", [[1.0, 51.0]]),
  edge("north-sea-rotterdam", "NORTH_SEA_GATE", "ROTTERDAM", [[3.6, 52.0]]),
  edge("north-sea-antwerp", "NORTH_SEA_GATE", "ANTWERP", [[3.7, 51.7]]),
  edge("north-sea-hamburg", "NORTH_SEA_GATE", "HAMBURG", [[6.0, 54.0]]),
  edge("luzon-north-pacific-west", "LUZON_STRAIT", "NORTH_PACIFIC_WEST", [
    [130.0, 24.0],
    [137.0, 29.0]
  ]),
  edge("north-pacific-west-central", "NORTH_PACIFIC_WEST", "NORTH_PACIFIC_CENTRAL", [
    [156.0, 38.0],
    [165.0, 40.0]
  ]),
  edge("north-pacific-central-east", "NORTH_PACIFIC_CENTRAL", "NORTH_PACIFIC_EAST", [
    [-170.0, 40.5],
    [-160.0, 39.5]
  ]),
  edge("north-pacific-east-socal", "NORTH_PACIFIC_EAST", "SOCAL_APPROACH", [
    [-140.0, 36.0],
    [-132.0, 34.0]
  ]),
  edge("socal-port-la", "SOCAL_APPROACH", "PORT_LA", [
    [-121.0, 32.9],
    [-119.5, 33.3]
  ]),
  edge("socal-port-lb", "SOCAL_APPROACH", "PORT_LB", [
    [-121.0, 32.9],
    [-119.4, 33.3]
  ]),
  edge("luzon-tropical-west", "LUZON_STRAIT", "TROPICAL_PACIFIC_WEST", [
    [131.0, 18.5],
    [138.0, 17.5]
  ]),
  edge("tropical-west-central", "TROPICAL_PACIFIC_WEST", "TROPICAL_PACIFIC_CENTRAL", [
    [160.0, 16.0]
  ]),
  edge("tropical-central-east", "TROPICAL_PACIFIC_CENTRAL", "TROPICAL_PACIFIC_EAST", [
    [-160.0, 12.0],
    [-145.0, 10.0]
  ]),
  edge("tropical-east-panama-pacific", "TROPICAL_PACIFIC_EAST", "PANAMA_PACIFIC", [
    [-115.0, 9.5],
    [-95.0, 8.5],
    [-84.5, 8.7]
  ]),
  edge("panama-pacific-caribbean", "PANAMA_PACIFIC", "PANAMA_CARIBBEAN", [
    [-79.7, 9.05]
  ]),
  edge("panama-caribbean-caribbean-north", "PANAMA_CARIBBEAN", "CARIBBEAN_NORTH", [
    [-77.0, 11.0],
    [-74.0, 14.5]
  ]),
  edge("caribbean-north-us-east", "CARIBBEAN_NORTH", "US_EAST_APPROACH", [
    [-72.0, 24.0],
    [-70.5, 31.0]
  ]),
  edge("us-east-port-nynj", "US_EAST_APPROACH", "PORT_NYNJ", [
    [-71.0, 36.0],
    [-74.0, 40.0]
  ])
];

const buildRouteEdge = (seed: SeaRouteEdgeSeed): SeaRouteEdge => {
  const fromNode = SEA_ROUTE_NODE_BY_ID[seed.fromId];
  const toNode = SEA_ROUTE_NODE_BY_ID[seed.toId];

  if (!fromNode || !toNode) {
    throw new Error(`Sea route edge references unknown node: ${seed.id}`);
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

const SEA_ROUTE_EDGES_INTERNAL = SEA_ROUTE_EDGE_SEEDS.flatMap((seed) => {
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

export const SEA_ROUTE_EDGES = SEA_ROUTE_EDGES_INTERNAL;
