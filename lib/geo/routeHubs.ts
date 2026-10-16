export type RouteHubKind = "airport" | "port" | "rail_terminal";

export type RouteMarketScope =
  | "vietnam"
  | "usa"
  | "eu"
  | "korea"
  | "japan"
  | "china"
  | "asean"
  | "australia"
  | "other"
  | "global";

export type ExportLineHaulMode = "sea" | "air" | "rail";

export interface RouteHub {
  id: string;
  label: string;
  kind: RouteHubKind;
  lat: number;
  lng: number;
  countryCode: string;
  region: string;
  clusterId: string;
  marketScope: RouteMarketScope[];
}

export interface ExportCorridor {
  id: string;
  mode: ExportLineHaulMode;
  fromHubId: string;
  toHubId: string;
  distanceMultiplier: number;
  handlingHours: number;
  bidirectional: boolean;
  marketScope: RouteMarketScope[];
}

type RouteHubSeed = Omit<RouteHub, "marketScope"> & {
  marketScope?: RouteMarketScope[];
};

type ExportCorridorSeed = Omit<ExportCorridor, "distanceMultiplier" | "handlingHours"> & {
  distanceMultiplier?: number;
  handlingHours?: number;
};

const ALL_EXPORT_MARKETS: RouteMarketScope[] = [
  "usa",
  "eu",
  "korea",
  "japan",
  "china",
  "asean",
  "australia",
  "other"
];

const createHub = ({
  marketScope = ["global"],
  ...hub
}: RouteHubSeed): RouteHub => ({
  ...hub,
  marketScope
});

const createCorridor = ({
  distanceMultiplier,
  handlingHours,
  ...corridor
}: ExportCorridorSeed): ExportCorridor => ({
  ...corridor,
  distanceMultiplier:
    distanceMultiplier ??
    (corridor.mode === "air" ? 1.04 : corridor.mode === "rail" ? 1.12 : 1.18),
  handlingHours:
    handlingHours ??
    (corridor.mode === "air" ? 10 : corridor.mode === "rail" ? 14 : 24)
});

export const VIETNAM_TRANSFER_HUBS: RouteHub[] = [
  createHub({
    id: "SGN",
    label: "Tan Son Nhat",
    kind: "airport",
    lat: 10.8188,
    lng: 106.6519,
    countryCode: "VN",
    region: "vietnam_south",
    clusterId: "hcmc",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "HAN",
    label: "Noi Bai",
    kind: "airport",
    lat: 21.2212,
    lng: 105.8072,
    countryCode: "VN",
    region: "vietnam_north",
    clusterId: "hanoi",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "DAD",
    label: "Da Nang",
    kind: "airport",
    lat: 16.0439,
    lng: 108.1994,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "danang",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "CXR",
    label: "Cam Ranh",
    kind: "airport",
    lat: 11.9982,
    lng: 109.2194,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "cam_ranh",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "HPH",
    label: "Cat Bi",
    kind: "airport",
    lat: 20.8194,
    lng: 106.724,
    countryCode: "VN",
    region: "vietnam_north",
    clusterId: "haiphong",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "VCA",
    label: "Can Tho",
    kind: "airport",
    lat: 10.0851,
    lng: 105.7119,
    countryCode: "VN",
    region: "mekong_delta",
    clusterId: "can_tho",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "CAT_LAI",
    label: "Cat Lai Port",
    kind: "port",
    lat: 10.7696,
    lng: 106.7605,
    countryCode: "VN",
    region: "vietnam_south",
    clusterId: "hcmc",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "CAI_MEP",
    label: "Cai Mep Port",
    kind: "port",
    lat: 10.5748,
    lng: 107.0184,
    countryCode: "VN",
    region: "vietnam_south",
    clusterId: "cai_mep",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "LACH_HUYEN",
    label: "Lach Huyen Port",
    kind: "port",
    lat: 20.8516,
    lng: 106.7787,
    countryCode: "VN",
    region: "vietnam_north",
    clusterId: "haiphong",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "TIEN_SA",
    label: "Tien Sa Port",
    kind: "port",
    lat: 16.1205,
    lng: 108.2107,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "danang",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "QUY_NHON",
    label: "Quy Nhon Port",
    kind: "port",
    lat: 13.7699,
    lng: 109.2467,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "quy_nhon",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "DUNG_QUAT",
    label: "Dung Quat Port",
    kind: "port",
    lat: 15.1365,
    lng: 108.7985,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "quang_ngai",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "SONG_THAN",
    label: "Song Than ICD",
    kind: "rail_terminal",
    lat: 10.8926,
    lng: 106.7578,
    countryCode: "VN",
    region: "vietnam_south",
    clusterId: "hcmc",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "YEN_VIEN",
    label: "Yen Vien Rail Yard",
    kind: "rail_terminal",
    lat: 21.0808,
    lng: 105.9174,
    countryCode: "VN",
    region: "vietnam_north",
    clusterId: "hanoi",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "GIAP_BAT",
    label: "Giap Bat Rail Yard",
    kind: "rail_terminal",
    lat: 20.9951,
    lng: 105.8429,
    countryCode: "VN",
    region: "vietnam_north",
    clusterId: "hanoi",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "LAO_CAI_RAIL",
    label: "Lao Cai Rail Terminal",
    kind: "rail_terminal",
    lat: 22.4856,
    lng: 103.9739,
    countryCode: "VN",
    region: "vietnam_northwest",
    clusterId: "lao_cai",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "DONG_DANG_RAIL",
    label: "Dong Dang Rail Terminal",
    kind: "rail_terminal",
    lat: 21.8453,
    lng: 106.7385,
    countryCode: "VN",
    region: "vietnam_northeast",
    clusterId: "dong_dang",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "KIM_LIEN_RAIL",
    label: "Kim Lien Rail Yard",
    kind: "rail_terminal",
    lat: 16.0602,
    lng: 108.1988,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "danang",
    marketScope: ["vietnam", "global"]
  }),
  // Additional Vietnam domestic airports for central/highland coverage
  createHub({
    id: "VIN",
    label: "Vinh Airport",
    kind: "airport",
    lat: 18.7376,
    lng: 105.6706,
    countryCode: "VN",
    region: "vietnam_central_north",
    clusterId: "vinh",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "HUI",
    label: "Phu Bai Airport",
    kind: "airport",
    lat: 16.4015,
    lng: 107.7028,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "hue",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "PXU",
    label: "Pleiku Airport",
    kind: "airport",
    lat: 14.0045,
    lng: 108.0169,
    countryCode: "VN",
    region: "vietnam_central_highlands",
    clusterId: "pleiku",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "BMV",
    label: "Buon Ma Thuot Airport",
    kind: "airport",
    lat: 12.668,
    lng: 108.1202,
    countryCode: "VN",
    region: "vietnam_central_highlands",
    clusterId: "buon_ma_thuot",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "UIH",
    label: "Phu Cat Airport",
    kind: "airport",
    lat: 13.9548,
    lng: 109.042,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "binh_dinh",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "VCL",
    label: "Chu Lai Airport",
    kind: "airport",
    lat: 15.4033,
    lng: 108.7056,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "quang_nam",
    marketScope: ["vietnam", "global"]
  }),
  // Additional Vietnam domestic ports
  createHub({
    id: "VAN_PHONG",
    label: "Van Phong Port",
    kind: "port",
    lat: 12.6316,
    lng: 109.3673,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "khanh_hoa",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "VUNG_TAU",
    label: "Vung Tau Port",
    kind: "port",
    lat: 10.3464,
    lng: 107.0843,
    countryCode: "VN",
    region: "vietnam_south",
    clusterId: "vung_tau",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "MY_THO",
    label: "My Tho River Port",
    kind: "port",
    lat: 10.3643,
    lng: 106.3645,
    countryCode: "VN",
    region: "mekong_delta",
    clusterId: "my_tho",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "CAN_THO_PORT",
    label: "Can Tho Port",
    kind: "port",
    lat: 10.0374,
    lng: 105.7888,
    countryCode: "VN",
    region: "mekong_delta",
    clusterId: "can_tho",
    marketScope: ["vietnam", "global"]
  }),
  // Vietnam rail terminals for highlands connectivity
  createHub({
    id: "VINH_RAIL",
    label: "Vinh Rail Terminal",
    kind: "rail_terminal",
    lat: 18.6697,
    lng: 105.6839,
    countryCode: "VN",
    region: "vietnam_central_north",
    clusterId: "vinh",
    marketScope: ["vietnam", "global"]
  }),
  createHub({
    id: "DANANG_ICD",
    label: "Da Nang ICD",
    kind: "rail_terminal",
    lat: 16.0541,
    lng: 108.2068,
    countryCode: "VN",
    region: "vietnam_central",
    clusterId: "danang",
    marketScope: ["vietnam", "global"]
  })
];

const USA_DESTINATION_HUBS: RouteHub[] = [
  createHub({
    id: "LAX",
    label: "Los Angeles Intl",
    kind: "airport",
    lat: 33.9416,
    lng: -118.4085,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "los_angeles",
    marketScope: ["usa"]
  }),
  createHub({
    id: "JFK",
    label: "John F Kennedy Intl",
    kind: "airport",
    lat: 40.6413,
    lng: -73.7781,
    countryCode: "US",
    region: "north_america_east",
    clusterId: "new_york",
    marketScope: ["usa"]
  }),
  createHub({
    id: "ORD",
    label: "Chicago O'Hare Intl",
    kind: "airport",
    lat: 41.9742,
    lng: -87.9073,
    countryCode: "US",
    region: "north_america_midwest",
    clusterId: "chicago",
    marketScope: ["usa"]
  }),
  createHub({
    id: "DFW",
    label: "Dallas Fort Worth Intl",
    kind: "airport",
    lat: 32.8998,
    lng: -97.0403,
    countryCode: "US",
    region: "north_america_south",
    clusterId: "dallas",
    marketScope: ["usa"]
  }),
  createHub({
    id: "ATL",
    label: "Hartsfield Jackson Atlanta Intl",
    kind: "airport",
    lat: 33.6407,
    lng: -84.4277,
    countryCode: "US",
    region: "north_america_southeast",
    clusterId: "atlanta",
    marketScope: ["usa"]
  }),
  createHub({
    id: "SFO",
    label: "San Francisco Intl",
    kind: "airport",
    lat: 37.6213,
    lng: -122.379,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "san_francisco",
    marketScope: ["usa"]
  }),
  createHub({
    id: "SEA",
    label: "Seattle Tacoma Intl",
    kind: "airport",
    lat: 47.4502,
    lng: -122.3088,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "seattle",
    marketScope: ["usa"]
  }),
  createHub({
    id: "MIA",
    label: "Miami Intl",
    kind: "airport",
    lat: 25.7959,
    lng: -80.287,
    countryCode: "US",
    region: "north_america_southeast",
    clusterId: "miami",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_LA",
    label: "Port of Los Angeles",
    kind: "port",
    lat: 33.7405,
    lng: -118.2719,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "los_angeles",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_LB",
    label: "Port of Long Beach",
    kind: "port",
    lat: 33.7542,
    lng: -118.2167,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "long_beach",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_NYNJ",
    label: "Port of New York and New Jersey",
    kind: "port",
    lat: 40.6681,
    lng: -74.0413,
    countryCode: "US",
    region: "north_america_east",
    clusterId: "new_york",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_SAV",
    label: "Port of Savannah",
    kind: "port",
    lat: 32.0809,
    lng: -81.0912,
    countryCode: "US",
    region: "north_america_southeast",
    clusterId: "savannah",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_HOU",
    label: "Port of Houston",
    kind: "port",
    lat: 29.7297,
    lng: -95.2658,
    countryCode: "US",
    region: "north_america_south",
    clusterId: "houston",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_SEA_TAC",
    label: "Northwest Seaport Alliance",
    kind: "port",
    lat: 47.572,
    lng: -122.35,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "seattle",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_NOR",
    label: "Port of Norfolk",
    kind: "port",
    lat: 36.946,
    lng: -76.3302,
    countryCode: "US",
    region: "north_america_east",
    clusterId: "norfolk",
    marketScope: ["usa"]
  }),
  createHub({
    id: "PORT_OAK",
    label: "Port of Oakland",
    kind: "port",
    lat: 37.7955,
    lng: -122.278,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "oakland",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_CHI_G4",
    label: "Chicago Global IV",
    kind: "rail_terminal",
    lat: 41.6853,
    lng: -88.0895,
    countryCode: "US",
    region: "north_america_midwest",
    clusterId: "chicago",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_LA_ICTF",
    label: "Los Angeles ICTF",
    kind: "rail_terminal",
    lat: 33.7981,
    lng: -118.214,
    countryCode: "US",
    region: "north_america_west",
    clusterId: "los_angeles",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_DFW_ALLIANCE",
    label: "AllianceTexas Intermodal",
    kind: "rail_terminal",
    lat: 32.9882,
    lng: -97.3229,
    countryCode: "US",
    region: "north_america_south",
    clusterId: "dallas",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_KC",
    label: "Kansas City Intermodal",
    kind: "rail_terminal",
    lat: 39.1242,
    lng: -94.7425,
    countryCode: "US",
    region: "north_america_midwest",
    clusterId: "kansas_city",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_MEMPHIS",
    label: "Memphis Rossville Intermodal",
    kind: "rail_terminal",
    lat: 35.0837,
    lng: -89.799,
    countryCode: "US",
    region: "north_america_south",
    clusterId: "memphis",
    marketScope: ["usa"]
  }),
  createHub({
    id: "RAIL_NEWARK",
    label: "ExpressRail Newark",
    kind: "rail_terminal",
    lat: 40.6842,
    lng: -74.1734,
    countryCode: "US",
    region: "north_america_east",
    clusterId: "new_york",
    marketScope: ["usa"]
  })
];

const EU_DESTINATION_HUBS: RouteHub[] = [
  createHub({
    id: "FRA",
    label: "Frankfurt Airport",
    kind: "airport",
    lat: 50.0379,
    lng: 8.5622,
    countryCode: "DE",
    region: "europe_west",
    clusterId: "frankfurt",
    marketScope: ["eu"]
  }),
  createHub({
    id: "AMS",
    label: "Amsterdam Schiphol",
    kind: "airport",
    lat: 52.3105,
    lng: 4.7683,
    countryCode: "NL",
    region: "europe_west",
    clusterId: "amsterdam",
    marketScope: ["eu"]
  }),
  createHub({
    id: "CDG",
    label: "Paris Charles de Gaulle",
    kind: "airport",
    lat: 49.0097,
    lng: 2.5479,
    countryCode: "FR",
    region: "europe_west",
    clusterId: "paris",
    marketScope: ["eu"]
  }),
  createHub({
    id: "LGG",
    label: "Liege Airport",
    kind: "airport",
    lat: 50.6466,
    lng: 5.4432,
    countryCode: "BE",
    region: "europe_west",
    clusterId: "liege",
    marketScope: ["eu"]
  }),
  createHub({
    id: "MAD",
    label: "Madrid Barajas",
    kind: "airport",
    lat: 40.4983,
    lng: -3.5676,
    countryCode: "ES",
    region: "europe_south",
    clusterId: "madrid",
    marketScope: ["eu"]
  }),
  createHub({
    id: "LHR",
    label: "London Heathrow",
    kind: "airport",
    lat: 51.47,
    lng: -0.4543,
    countryCode: "GB",
    region: "europe_west",
    clusterId: "london",
    marketScope: ["eu"]
  }),
  createHub({
    id: "ROTTERDAM",
    label: "Port of Rotterdam",
    kind: "port",
    lat: 51.95,
    lng: 4.14,
    countryCode: "NL",
    region: "europe_west",
    clusterId: "rotterdam",
    marketScope: ["eu"]
  }),
  createHub({
    id: "ANTWERP",
    label: "Port of Antwerp Bruges",
    kind: "port",
    lat: 51.2637,
    lng: 4.4,
    countryCode: "BE",
    region: "europe_west",
    clusterId: "antwerp",
    marketScope: ["eu"]
  }),
  createHub({
    id: "HAMBURG",
    label: "Port of Hamburg",
    kind: "port",
    lat: 53.5461,
    lng: 9.9661,
    countryCode: "DE",
    region: "europe_north",
    clusterId: "hamburg",
    marketScope: ["eu"]
  }),
  createHub({
    id: "BREMERHAVEN",
    label: "Port of Bremerhaven",
    kind: "port",
    lat: 53.5396,
    lng: 8.5809,
    countryCode: "DE",
    region: "europe_north",
    clusterId: "bremerhaven",
    marketScope: ["eu"]
  }),
  createHub({
    id: "VALENCIA",
    label: "Port of Valencia",
    kind: "port",
    lat: 39.448,
    lng: -0.3169,
    countryCode: "ES",
    region: "europe_south",
    clusterId: "valencia",
    marketScope: ["eu"]
  }),
  createHub({
    id: "PIRAEUS",
    label: "Port of Piraeus",
    kind: "port",
    lat: 37.942,
    lng: 23.6465,
    countryCode: "GR",
    region: "europe_south",
    clusterId: "athens",
    marketScope: ["eu"]
  }),
  createHub({
    id: "DUISBURG",
    label: "Duisburg Intermodal",
    kind: "rail_terminal",
    lat: 51.4344,
    lng: 6.7623,
    countryCode: "DE",
    region: "europe_west",
    clusterId: "duisburg",
    marketScope: ["eu"]
  }),
  createHub({
    id: "HAMBURG_BILL",
    label: "Hamburg Billwerder Terminal",
    kind: "rail_terminal",
    lat: 53.5244,
    lng: 10.0866,
    countryCode: "DE",
    region: "europe_north",
    clusterId: "hamburg",
    marketScope: ["eu"]
  }),
  createHub({
    id: "MANNHEIM",
    label: "Mannheim DUSS Terminal",
    kind: "rail_terminal",
    lat: 49.4798,
    lng: 8.4752,
    countryCode: "DE",
    region: "europe_west",
    clusterId: "mannheim",
    marketScope: ["eu"]
  }),
  createHub({
    id: "VIENNA_SOUTH",
    label: "Vienna South Freight",
    kind: "rail_terminal",
    lat: 48.1748,
    lng: 16.4096,
    countryCode: "AT",
    region: "europe_central",
    clusterId: "vienna",
    marketScope: ["eu"]
  }),
  createHub({
    id: "MALASZEWICZE",
    label: "Malaszewicze Terminal",
    kind: "rail_terminal",
    lat: 52.039,
    lng: 23.541,
    countryCode: "PL",
    region: "europe_central",
    clusterId: "malaszewicze",
    marketScope: ["eu"]
  }),
  createHub({
    id: "LYON_VENISSIEUX",
    label: "Lyon Venissieux Rail",
    kind: "rail_terminal",
    lat: 45.6956,
    lng: 4.8855,
    countryCode: "FR",
    region: "europe_west",
    clusterId: "lyon",
    marketScope: ["eu"]
  }),
  // EU airports
  createHub({ id: "MXP", label: "Milan Malpensa", kind: "airport", lat: 45.6306, lng: 8.7281, countryCode: "IT", region: "europe_south", clusterId: "milan", marketScope: ["eu"] }),
  createHub({ id: "FCO", label: "Rome Fiumicino", kind: "airport", lat: 41.7999, lng: 12.2462, countryCode: "IT", region: "europe_south", clusterId: "rome", marketScope: ["eu"] }),
  createHub({ id: "BCN", label: "Barcelona El Prat", kind: "airport", lat: 41.2971, lng: 2.0785, countryCode: "ES", region: "europe_south", clusterId: "barcelona", marketScope: ["eu"] }),
  createHub({ id: "MUC", label: "Munich Airport", kind: "airport", lat: 48.3537, lng: 11.7749, countryCode: "DE", region: "europe_central", clusterId: "munich", marketScope: ["eu"] }),
  createHub({ id: "VIE", label: "Vienna Airport", kind: "airport", lat: 48.1102, lng: 16.5697, countryCode: "AT", region: "europe_central", clusterId: "vienna", marketScope: ["eu"] }),
  createHub({ id: "WAW", label: "Warsaw Chopin", kind: "airport", lat: 52.1657, lng: 20.9671, countryCode: "PL", region: "europe_central", clusterId: "warsaw", marketScope: ["eu"] }),
  createHub({ id: "CPH", label: "Copenhagen Airport", kind: "airport", lat: 55.618, lng: 12.6561, countryCode: "DK", region: "europe_north", clusterId: "copenhagen", marketScope: ["eu"] }),
  // EU southern + western ports
  createHub({ id: "PORT_GENOA", label: "Port of Genoa", kind: "port", lat: 44.4056, lng: 8.9124, countryCode: "IT", region: "europe_south", clusterId: "genoa", marketScope: ["eu"] }),
  createHub({ id: "PORT_MARSEILLE", label: "Port of Marseille Fos", kind: "port", lat: 43.3304, lng: 5.0397, countryCode: "FR", region: "europe_south", clusterId: "marseille", marketScope: ["eu"] }),
  createHub({ id: "PORT_BARCELONA", label: "Port of Barcelona", kind: "port", lat: 41.3579, lng: 2.1719, countryCode: "ES", region: "europe_south", clusterId: "barcelona", marketScope: ["eu"] }),
  createHub({ id: "PORT_FELIXSTOWE", label: "Port of Felixstowe", kind: "port", lat: 51.9545, lng: 1.3513, countryCode: "GB", region: "europe_west", clusterId: "felixstowe", marketScope: ["eu"] }),
  createHub({ id: "PORT_LE_HAVRE", label: "Port of Le Havre", kind: "port", lat: 49.4817, lng: 0.1078, countryCode: "FR", region: "europe_west", clusterId: "le_havre", marketScope: ["eu"] }),
  createHub({ id: "PORT_GDANSK", label: "Port of Gdansk", kind: "port", lat: 54.3794, lng: 18.6615, countryCode: "PL", region: "europe_north", clusterId: "gdansk", marketScope: ["eu"] }),
  createHub({ id: "PORT_ALGECIRAS", label: "Port of Algeciras", kind: "port", lat: 36.1332, lng: -5.4449, countryCode: "ES", region: "europe_south", clusterId: "algeciras", marketScope: ["eu"] }),
  // EU rail
  createHub({ id: "MILAN_RAIL", label: "Milan Segrate Rail Terminal", kind: "rail_terminal", lat: 45.4895, lng: 9.2815, countryCode: "IT", region: "europe_south", clusterId: "milan", marketScope: ["eu"] }),
  createHub({ id: "BARCELONA_RAIL", label: "Barcelona ZAL Port Rail", kind: "rail_terminal", lat: 41.3427, lng: 2.1258, countryCode: "ES", region: "europe_south", clusterId: "barcelona", marketScope: ["eu"] }),
  createHub({ id: "WARSAW_RAIL", label: "Warsaw Praga Freight Terminal", kind: "rail_terminal", lat: 52.257, lng: 21.0593, countryCode: "PL", region: "europe_central", clusterId: "warsaw", marketScope: ["eu"] })
];
const KOREA_DESTINATION_HUBS: RouteHub[] = [
  createHub({
    id: "ICN",
    label: "Incheon Intl",
    kind: "airport",
    lat: 37.4602,
    lng: 126.4407,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "seoul",
    marketScope: ["korea"]
  }),
  createHub({
    id: "GMP",
    label: "Gimpo Intl",
    kind: "airport",
    lat: 37.5583,
    lng: 126.7906,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "seoul",
    marketScope: ["korea"]
  }),
  createHub({
    id: "PUS",
    label: "Gimhae Intl",
    kind: "airport",
    lat: 35.1796,
    lng: 128.9382,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "busan",
    marketScope: ["korea"]
  }),
  createHub({
    id: "BUSAN_PORT",
    label: "Port of Busan",
    kind: "port",
    lat: 35.1017,
    lng: 129.0403,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "busan",
    marketScope: ["korea"]
  }),
  createHub({
    id: "INCHEON_PORT",
    label: "Port of Incheon",
    kind: "port",
    lat: 37.4637,
    lng: 126.6208,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "seoul",
    marketScope: ["korea"]
  }),
  createHub({
    id: "GWANGYANG_PORT",
    label: "Port of Gwangyang",
    kind: "port",
    lat: 34.9035,
    lng: 127.748,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "gwangyang",
    marketScope: ["korea"]
  }),
  createHub({
    id: "ULSAN_PORT",
    label: "Port of Ulsan",
    kind: "port",
    lat: 35.503,
    lng: 129.387,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "ulsan",
    marketScope: ["korea"]
  }),
  createHub({
    id: "POHANG_PORT",
    label: "Port of Pohang",
    kind: "port",
    lat: 36.047,
    lng: 129.3763,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "pohang",
    marketScope: ["korea"]
  }),
  createHub({
    id: "UIWANG_ICD",
    label: "Uiwang ICD",
    kind: "rail_terminal",
    lat: 37.3464,
    lng: 126.9684,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "seoul",
    marketScope: ["korea"]
  }),
  createHub({
    id: "BUSAN_RAIL",
    label: "Busan Rail Logistics",
    kind: "rail_terminal",
    lat: 35.0801,
    lng: 128.8473,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "busan",
    marketScope: ["korea"]
  }),
  createHub({
    id: "INCHEON_RAIL",
    label: "Incheon Rail Logistics",
    kind: "rail_terminal",
    lat: 37.4869,
    lng: 126.616,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "seoul",
    marketScope: ["korea"]
  }),
  createHub({
    id: "GWANGYANG_RAIL",
    label: "Gwangyang Rail Freight",
    kind: "rail_terminal",
    lat: 34.9076,
    lng: 127.7442,
    countryCode: "KR",
    region: "east_asia",
    clusterId: "gwangyang",
    marketScope: ["korea"]
  })
];

const JAPAN_DESTINATION_HUBS: RouteHub[] = [
  createHub({
    id: "NRT",
    label: "Narita Intl",
    kind: "airport",
    lat: 35.7719,
    lng: 140.3929,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "tokyo",
    marketScope: ["japan"]
  }),
  createHub({
    id: "HND",
    label: "Haneda Intl",
    kind: "airport",
    lat: 35.5494,
    lng: 139.7798,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "tokyo",
    marketScope: ["japan"]
  }),
  createHub({
    id: "KIX",
    label: "Kansai Intl",
    kind: "airport",
    lat: 34.4347,
    lng: 135.244,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "osaka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "NGO",
    label: "Chubu Centrair",
    kind: "airport",
    lat: 34.8584,
    lng: 136.8054,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "nagoya",
    marketScope: ["japan"]
  }),
  createHub({
    id: "FUK",
    label: "Fukuoka Airport",
    kind: "airport",
    lat: 33.5859,
    lng: 130.4507,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "fukuoka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "TOKYO_PORT",
    label: "Port of Tokyo",
    kind: "port",
    lat: 35.6167,
    lng: 139.7833,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "tokyo",
    marketScope: ["japan"]
  }),
  createHub({
    id: "YOKOHAMA",
    label: "Port of Yokohama",
    kind: "port",
    lat: 35.45,
    lng: 139.661,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "tokyo",
    marketScope: ["japan"]
  }),
  createHub({
    id: "NAGOYA_PORT",
    label: "Port of Nagoya",
    kind: "port",
    lat: 35.08,
    lng: 136.885,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "nagoya",
    marketScope: ["japan"]
  }),
  createHub({
    id: "KOBE_PORT",
    label: "Port of Kobe",
    kind: "port",
    lat: 34.6833,
    lng: 135.1833,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "osaka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "OSAKA_PORT",
    label: "Port of Osaka",
    kind: "port",
    lat: 34.6381,
    lng: 135.4183,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "osaka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "HAKATA_PORT",
    label: "Port of Hakata",
    kind: "port",
    lat: 33.6096,
    lng: 130.4105,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "fukuoka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "TOKYO_FREIGHT",
    label: "Tokyo Freight Terminal",
    kind: "rail_terminal",
    lat: 35.6034,
    lng: 139.7671,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "tokyo",
    marketScope: ["japan"]
  }),
  createHub({
    id: "SUITA_FREIGHT",
    label: "Suita Freight Terminal",
    kind: "rail_terminal",
    lat: 34.7635,
    lng: 135.5167,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "osaka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "NAGOYA_FREIGHT",
    label: "Nagoya Freight Terminal",
    kind: "rail_terminal",
    lat: 35.1377,
    lng: 136.9003,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "nagoya",
    marketScope: ["japan"]
  }),
  createHub({
    id: "FUKUOKA_FREIGHT",
    label: "Fukuoka Freight Terminal",
    kind: "rail_terminal",
    lat: 33.599,
    lng: 130.4314,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "fukuoka",
    marketScope: ["japan"]
  }),
  createHub({
    id: "SAPPORO_FREIGHT",
    label: "Sapporo Freight Terminal",
    kind: "rail_terminal",
    lat: 43.1058,
    lng: 141.3723,
    countryCode: "JP",
    region: "east_asia",
    clusterId: "sapporo",
    marketScope: ["japan"]
  })
];

const ASEAN_DESTINATION_HUBS: RouteHub[] = [
  createHub({ id: "BKK_A", label: "Bangkok Suvarnabhumi", kind: "airport", lat: 13.69, lng: 100.7501, countryCode: "TH", region: "southeast_asia", clusterId: "bangkok", marketScope: ["asean"] }),
  createHub({ id: "LAEM_CHABANG_D", label: "Laem Chabang Port", kind: "port", lat: 13.0817, lng: 100.8812, countryCode: "TH", region: "southeast_asia", clusterId: "bangkok", marketScope: ["asean"] }),
  createHub({ id: "CGK_D", label: "Jakarta Soekarno-Hatta", kind: "airport", lat: -6.1256, lng: 106.6559, countryCode: "ID", region: "southeast_asia", clusterId: "jakarta", marketScope: ["asean"] }),
  createHub({ id: "PORT_PRIOK_D", label: "Tanjung Priok Port Jakarta", kind: "port", lat: -6.1076, lng: 106.8819, countryCode: "ID", region: "southeast_asia", clusterId: "jakarta", marketScope: ["asean"] }),
  createHub({ id: "KUL_D", label: "Kuala Lumpur Intl", kind: "airport", lat: 2.7456, lng: 101.7072, countryCode: "MY", region: "southeast_asia", clusterId: "kuala_lumpur", marketScope: ["asean"] }),
  createHub({ id: "PORT_KLANG_D", label: "Port Klang", kind: "port", lat: 2.9914, lng: 101.3969, countryCode: "MY", region: "southeast_asia", clusterId: "kuala_lumpur", marketScope: ["asean"] }),
  createHub({ id: "MNL_D", label: "Manila Ninoy Aquino Intl", kind: "airport", lat: 14.5086, lng: 121.0194, countryCode: "PH", region: "southeast_asia", clusterId: "manila", marketScope: ["asean"] }),
  createHub({ id: "PORT_MANILA_D", label: "Manila Intl Container Terminal", kind: "port", lat: 14.5867, lng: 120.9655, countryCode: "PH", region: "southeast_asia", clusterId: "manila", marketScope: ["asean"] }),
  createHub({ id: "SIN_D", label: "Singapore Changi", kind: "airport", lat: 1.3644, lng: 103.9915, countryCode: "SG", region: "southeast_asia", clusterId: "singapore", marketScope: ["asean"] }),
  createHub({ id: "PORT_SIN_D", label: "Port of Singapore", kind: "port", lat: 1.2644, lng: 103.84, countryCode: "SG", region: "southeast_asia", clusterId: "singapore", marketScope: ["asean"] }),
  createHub({ id: "RGN_D", label: "Yangon Intl", kind: "airport", lat: 16.9073, lng: 96.1332, countryCode: "MM", region: "southeast_asia", clusterId: "yangon", marketScope: ["asean"] }),
  createHub({ id: "REP", label: "Siem Reap Angkor Intl", kind: "airport", lat: 13.4107, lng: 103.8129, countryCode: "KH", region: "southeast_asia", clusterId: "siem_reap", marketScope: ["asean"] }),
  createHub({ id: "PNH", label: "Phnom Penh Intl", kind: "airport", lat: 11.5466, lng: 104.8441, countryCode: "KH", region: "southeast_asia", clusterId: "phnom_penh", marketScope: ["asean"] }),
  createHub({ id: "VTE", label: "Wattay Intl Vientiane", kind: "airport", lat: 17.9883, lng: 102.563, countryCode: "LA", region: "southeast_asia", clusterId: "vientiane", marketScope: ["asean"] }),
  createHub({ id: "UIWANG_ASEAN", label: "Bangkok Rail Terminal Lat Krabang", kind: "rail_terminal", lat: 13.7305, lng: 100.7769, countryCode: "TH", region: "southeast_asia", clusterId: "bangkok", marketScope: ["asean"] })
];

const AUSTRALIA_DESTINATION_HUBS: RouteHub[] = [
  createHub({ id: "SYD_D", label: "Sydney Kingsford Smith", kind: "airport", lat: -33.9399, lng: 151.175, countryCode: "AU", region: "oceania", clusterId: "sydney", marketScope: ["australia"] }),
  createHub({ id: "PORT_BOTANY_D", label: "Port Botany Sydney", kind: "port", lat: -33.9657, lng: 151.2284, countryCode: "AU", region: "oceania", clusterId: "sydney", marketScope: ["australia"] }),
  createHub({ id: "MEL_D", label: "Melbourne Tullamarine", kind: "airport", lat: -37.6633, lng: 144.8433, countryCode: "AU", region: "oceania", clusterId: "melbourne", marketScope: ["australia"] }),
  createHub({ id: "PORT_MEL_D", label: "Port of Melbourne", kind: "port", lat: -37.8258, lng: 144.9235, countryCode: "AU", region: "oceania", clusterId: "melbourne", marketScope: ["australia"] }),
  createHub({ id: "BNE_D", label: "Brisbane Airport", kind: "airport", lat: -27.3841, lng: 153.1175, countryCode: "AU", region: "oceania", clusterId: "brisbane", marketScope: ["australia"] }),
  createHub({ id: "PORT_BNE_D", label: "Port of Brisbane", kind: "port", lat: -27.3926, lng: 153.1703, countryCode: "AU", region: "oceania", clusterId: "brisbane", marketScope: ["australia"] }),
  createHub({ id: "PER", label: "Perth Airport", kind: "airport", lat: -31.9402, lng: 115.9669, countryCode: "AU", region: "oceania", clusterId: "perth", marketScope: ["australia"] }),
  createHub({ id: "PORT_FREMANTLE", label: "Port of Fremantle Perth", kind: "port", lat: -32.0479, lng: 115.7495, countryCode: "AU", region: "oceania", clusterId: "perth", marketScope: ["australia"] }),
  createHub({ id: "AKL_D", label: "Auckland Airport", kind: "airport", lat: -37.0082, lng: 174.7919, countryCode: "NZ", region: "oceania", clusterId: "auckland", marketScope: ["australia"] }),
  createHub({ id: "PORT_AKL_D", label: "Port of Auckland", kind: "port", lat: -36.843, lng: 174.7633, countryCode: "NZ", region: "oceania", clusterId: "auckland", marketScope: ["australia"] })
];

const CHINA_DESTINATION_HUBS: RouteHub[] = [
  createHub({
    id: "PVG",
    label: "Shanghai Pudong",
    kind: "airport",
    lat: 31.1443,
    lng: 121.8083,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shanghai",
    marketScope: ["china"]
  }),
  createHub({
    id: "PEK",
    label: "Beijing Capital",
    kind: "airport",
    lat: 40.0799,
    lng: 116.6031,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "beijing",
    marketScope: ["china"]
  }),
  createHub({
    id: "CAN",
    label: "Guangzhou Baiyun",
    kind: "airport",
    lat: 23.3924,
    lng: 113.2988,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "guangzhou",
    marketScope: ["china"]
  }),
  createHub({
    id: "SZX",
    label: "Shenzhen Bao'an",
    kind: "airport",
    lat: 22.6393,
    lng: 113.8107,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shenzhen",
    marketScope: ["china"]
  }),
  createHub({
    id: "CKG",
    label: "Chongqing Jiangbei",
    kind: "airport",
    lat: 29.7192,
    lng: 106.6416,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "chongqing",
    marketScope: ["china"]
  }),
  createHub({
    id: "XIY",
    label: "Xi'an Xianyang",
    kind: "airport",
    lat: 34.4471,
    lng: 108.7516,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "xian",
    marketScope: ["china"]
  }),
  createHub({
    id: "SHANGHAI_PORT",
    label: "Port of Shanghai",
    kind: "port",
    lat: 31.4,
    lng: 121.8,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shanghai",
    marketScope: ["china"]
  }),
  createHub({
    id: "NINGBO",
    label: "Port of Ningbo Zhoushan",
    kind: "port",
    lat: 29.9492,
    lng: 121.8745,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "ningbo",
    marketScope: ["china"]
  }),
  createHub({
    id: "YANTIAN",
    label: "Shenzhen Yantian Port",
    kind: "port",
    lat: 22.5556,
    lng: 114.2569,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shenzhen",
    marketScope: ["china"]
  }),
  createHub({
    id: "QINGDAO",
    label: "Port of Qingdao",
    kind: "port",
    lat: 36.089,
    lng: 120.336,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "qingdao",
    marketScope: ["china"]
  }),
  createHub({
    id: "NANSHA",
    label: "Guangzhou Nansha Port",
    kind: "port",
    lat: 22.7714,
    lng: 113.6406,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "guangzhou",
    marketScope: ["china"]
  }),
  createHub({
    id: "TIANJIN",
    label: "Port of Tianjin",
    kind: "port",
    lat: 38.9868,
    lng: 117.7394,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "tianjin",
    marketScope: ["china"]
  }),
  createHub({
    id: "XIAN_RAIL",
    label: "Xi'an International Port",
    kind: "rail_terminal",
    lat: 34.3266,
    lng: 109.045,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "xian",
    marketScope: ["china"]
  }),
  createHub({
    id: "CQ_TUANJIECUN",
    label: "Chongqing Tuanjiecun",
    kind: "rail_terminal",
    lat: 29.553,
    lng: 106.561,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "chongqing",
    marketScope: ["china"]
  }),
  createHub({
    id: "ZHENGZHOU_RAIL",
    label: "Zhengzhou Land Port",
    kind: "rail_terminal",
    lat: 34.7384,
    lng: 113.722,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "zhengzhou",
    marketScope: ["china"]
  }),
  createHub({
    id: "CHENGDU_QBJ",
    label: "Chengdu Qingbaijiang",
    kind: "rail_terminal",
    lat: 30.8787,
    lng: 104.246,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "chengdu",
    marketScope: ["china"]
  }),
  createHub({
    id: "WUHAN_RAIL",
    label: "Wuhan Rail Hub",
    kind: "rail_terminal",
    lat: 30.6187,
    lng: 114.2965,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "wuhan",
    marketScope: ["china"]
  }),
  createHub({
    id: "NANNING_RAIL",
    label: "Nanning Rail Hub",
    kind: "rail_terminal",
    lat: 22.817,
    lng: 108.3669,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "nanning",
    marketScope: ["china"]
  }),
  createHub({
    id: "LANZHOU_RAIL",
    label: "Lanzhou Rail Hub",
    kind: "rail_terminal",
    lat: 36.0611,
    lng: 103.8343,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "lanzhou",
    marketScope: ["china"]
  }),
  createHub({
    id: "SHANGHAI_RAIL",
    label: "Shanghai Rail Hub",
    kind: "rail_terminal",
    lat: 31.2304,
    lng: 121.4737,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shanghai",
    marketScope: ["china"]
  }),
  createHub({
    id: "BEIJING_RAIL",
    label: "Beijing Rail Hub",
    kind: "rail_terminal",
    lat: 39.9042,
    lng: 116.4074,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "beijing",
    marketScope: ["china"]
  }),
  createHub({
    id: "GUANGZHOU_RAIL",
    label: "Guangzhou Rail Hub",
    kind: "rail_terminal",
    lat: 23.1291,
    lng: 113.2644,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "guangzhou",
    marketScope: ["china"]
  }),
  createHub({
    id: "SHENZHEN_RAIL",
    label: "Shenzhen Rail Hub",
    kind: "rail_terminal",
    lat: 22.5431,
    lng: 114.0579,
    countryCode: "CN",
    region: "greater_china",
    clusterId: "shenzhen",
    marketScope: ["china"]
  })
];

const GLOBAL_TRANSSHIPMENT_HUBS_INTERNAL: RouteHub[] = [
  createHub({
    id: "SIN",
    label: "Singapore Changi",
    kind: "airport",
    lat: 1.3644,
    lng: 103.9915,
    countryCode: "SG",
    region: "southeast_asia",
    clusterId: "singapore",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "DXB",
    label: "Dubai Intl",
    kind: "airport",
    lat: 25.2532,
    lng: 55.3657,
    countryCode: "AE",
    region: "middle_east",
    clusterId: "dubai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "HKG",
    label: "Hong Kong Intl",
    kind: "airport",
    lat: 22.308,
    lng: 113.9185,
    countryCode: "HK",
    region: "greater_china",
    clusterId: "hong_kong",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "DOH",
    label: "Hamad Intl",
    kind: "airport",
    lat: 25.2736,
    lng: 51.6081,
    countryCode: "QA",
    region: "middle_east",
    clusterId: "doha",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "BKK",
    label: "Suvarnabhumi",
    kind: "airport",
    lat: 13.69,
    lng: 100.7501,
    countryCode: "TH",
    region: "southeast_asia",
    clusterId: "bangkok",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "IST",
    label: "Istanbul Airport",
    kind: "airport",
    lat: 41.2753,
    lng: 28.7519,
    countryCode: "TR",
    region: "europe_east",
    clusterId: "istanbul",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_SIN",
    label: "Port of Singapore",
    kind: "port",
    lat: 1.2644,
    lng: 103.84,
    countryCode: "SG",
    region: "southeast_asia",
    clusterId: "singapore",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "JEBEL_ALI",
    label: "Jebel Ali Port",
    kind: "port",
    lat: 25.005,
    lng: 55.0616,
    countryCode: "AE",
    region: "middle_east",
    clusterId: "dubai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_KLANG",
    label: "Port Klang",
    kind: "port",
    lat: 2.9914,
    lng: 101.3969,
    countryCode: "MY",
    region: "southeast_asia",
    clusterId: "port_klang",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "TANJUNG_PELEPAS",
    label: "Tanjung Pelepas",
    kind: "port",
    lat: 1.3659,
    lng: 103.5346,
    countryCode: "MY",
    region: "southeast_asia",
    clusterId: "johor",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "COLOMBO",
    label: "Port of Colombo",
    kind: "port",
    lat: 6.9553,
    lng: 79.8448,
    countryCode: "LK",
    region: "south_asia",
    clusterId: "colombo",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_RASHID",
    label: "Port Rashid",
    kind: "port",
    lat: 25.28,
    lng: 55.29,
    countryCode: "AE",
    region: "middle_east",
    clusterId: "dubai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_HKG",
    label: "Port of Hong Kong",
    kind: "port",
    lat: 22.3027,
    lng: 114.1772,
    countryCode: "HK",
    region: "greater_china",
    clusterId: "hong_kong",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "KHORGOS",
    label: "Khorgos Rail Hub",
    kind: "rail_terminal",
    lat: 44.23,
    lng: 80.41,
    countryCode: "KZ",
    region: "central_asia",
    clusterId: "khorgos",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "ALASHANKOU",
    label: "Alashankou Rail Hub",
    kind: "rail_terminal",
    lat: 45.1704,
    lng: 82.5739,
    countryCode: "CN",
    region: "central_asia",
    clusterId: "alashankou",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "HALKALI",
    label: "Halkali Rail Terminal",
    kind: "rail_terminal",
    lat: 41.0042,
    lng: 28.7997,
    countryCode: "TR",
    region: "europe_east",
    clusterId: "istanbul",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "BILK",
    label: "Budapest BILK",
    kind: "rail_terminal",
    lat: 47.4031,
    lng: 19.1402,
    countryCode: "HU",
    region: "europe_central",
    clusterId: "budapest",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "TASHKENT_RAIL",
    label: "Tashkent Rail Hub",
    kind: "rail_terminal",
    lat: 41.2995,
    lng: 69.2401,
    countryCode: "UZ",
    region: "central_asia",
    clusterId: "tashkent",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "APRIN_RAIL",
    label: "Aprin Rail Terminal",
    kind: "rail_terminal",
    lat: 35.449,
    lng: 50.999,
    countryCode: "IR",
    region: "middle_east",
    clusterId: "tehran",
    marketScope: ["global", "other"]
  }),
  // ── Southeast Asia ────────────────────────────────────────────────
  createHub({
    id: "LAEM_CHABANG",
    label: "Laem Chabang Port",
    kind: "port",
    lat: 13.0817,
    lng: 100.8812,
    countryCode: "TH",
    region: "southeast_asia",
    clusterId: "bangkok",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "DMK",
    label: "Don Mueang Cargo Bangkok",
    kind: "airport",
    lat: 13.9126,
    lng: 100.6069,
    countryCode: "TH",
    region: "southeast_asia",
    clusterId: "bangkok",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "CGK",
    label: "Soekarno-Hatta Intl Jakarta",
    kind: "airport",
    lat: -6.1256,
    lng: 106.6559,
    countryCode: "ID",
    region: "southeast_asia",
    clusterId: "jakarta",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "PORT_TANJUNG_PRIOK",
    label: "Tanjung Priok Port Jakarta",
    kind: "port",
    lat: -6.1076,
    lng: 106.8819,
    countryCode: "ID",
    region: "southeast_asia",
    clusterId: "jakarta",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "KUL",
    label: "Kuala Lumpur Intl",
    kind: "airport",
    lat: 2.7456,
    lng: 101.7072,
    countryCode: "MY",
    region: "southeast_asia",
    clusterId: "kuala_lumpur",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "PEN",
    label: "Penang Airport",
    kind: "airport",
    lat: 5.2977,
    lng: 100.2765,
    countryCode: "MY",
    region: "southeast_asia",
    clusterId: "penang",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "PORT_PENANG",
    label: "Port of Penang",
    kind: "port",
    lat: 5.4211,
    lng: 100.3385,
    countryCode: "MY",
    region: "southeast_asia",
    clusterId: "penang",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "MNL",
    label: "Manila Ninoy Aquino Intl",
    kind: "airport",
    lat: 14.5086,
    lng: 121.0194,
    countryCode: "PH",
    region: "southeast_asia",
    clusterId: "manila",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "PORT_MANILA",
    label: "Manila Intl Container Terminal",
    kind: "port",
    lat: 14.5867,
    lng: 120.9655,
    countryCode: "PH",
    region: "southeast_asia",
    clusterId: "manila",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "RGN",
    label: "Yangon Intl Airport",
    kind: "airport",
    lat: 16.9073,
    lng: 96.1332,
    countryCode: "MM",
    region: "southeast_asia",
    clusterId: "yangon",
    marketScope: ["global", "asean", "other"]
  }),
  createHub({
    id: "PORT_YANGON",
    label: "Yangon Port",
    kind: "port",
    lat: 16.7667,
    lng: 96.1667,
    countryCode: "MM",
    region: "southeast_asia",
    clusterId: "yangon",
    marketScope: ["global", "asean", "other"]
  }),
  // ── South Asia ────────────────────────────────────────────────────
  createHub({
    id: "BOM",
    label: "Mumbai Chhatrapati Shivaji Intl",
    kind: "airport",
    lat: 19.0896,
    lng: 72.8656,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "mumbai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_JNPT",
    label: "Jawaharlal Nehru Port Mumbai",
    kind: "port",
    lat: 18.9497,
    lng: 72.9442,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "mumbai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "DEL",
    label: "Delhi Indira Gandhi Intl",
    kind: "airport",
    lat: 28.5562,
    lng: 77.1,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "delhi",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "MAA",
    label: "Chennai Intl",
    kind: "airport",
    lat: 12.9941,
    lng: 80.1709,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "chennai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_CHENNAI",
    label: "Chennai Port",
    kind: "port",
    lat: 13.0906,
    lng: 80.2922,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "chennai",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "CGP",
    label: "Shah Amanat Intl Chittagong",
    kind: "airport",
    lat: 22.2496,
    lng: 91.8133,
    countryCode: "BD",
    region: "south_asia",
    clusterId: "chittagong",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_CHITTAGONG",
    label: "Chittagong Port",
    kind: "port",
    lat: 22.3372,
    lng: 91.8244,
    countryCode: "BD",
    region: "south_asia",
    clusterId: "chittagong",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "BLR",
    label: "Bengaluru Kempegowda Intl",
    kind: "airport",
    lat: 13.1986,
    lng: 77.7066,
    countryCode: "IN",
    region: "south_asia",
    clusterId: "bangalore",
    marketScope: ["global", "other"]
  }),
  // ── Middle East extended ──────────────────────────────────────────
  createHub({
    id: "AUH",
    label: "Abu Dhabi Intl",
    kind: "airport",
    lat: 24.4331,
    lng: 54.6511,
    countryCode: "AE",
    region: "middle_east",
    clusterId: "abu_dhabi",
    marketScope: ["global", "other"]
  }),
  createHub({
    id: "PORT_JEDDAH",
    label: "Jeddah Islamic Port",
    kind: "port",
    lat: 21.4895,
    lng: 39.1706,
    countryCode: "SA",
    region: "middle_east",
    clusterId: "jeddah",
    marketScope: ["global", "other", "eu"]
  }),
  createHub({
    id: "PORT_SALALAH",
    label: "Port of Salalah",
    kind: "port",
    lat: 16.9408,
    lng: 54.0082,
    countryCode: "OM",
    region: "middle_east",
    clusterId: "salalah",
    marketScope: ["global", "other"]
  }),
  // ── Australia / Oceania ──────────────────────────────────────────
  createHub({
    id: "SYD",
    label: "Sydney Kingsford Smith",
    kind: "airport",
    lat: -33.9399,
    lng: 151.175,
    countryCode: "AU",
    region: "oceania",
    clusterId: "sydney",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "PORT_BOTANY",
    label: "Port Botany Sydney",
    kind: "port",
    lat: -33.9657,
    lng: 151.2284,
    countryCode: "AU",
    region: "oceania",
    clusterId: "sydney",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "MEL",
    label: "Melbourne Tullamarine",
    kind: "airport",
    lat: -37.6633,
    lng: 144.8433,
    countryCode: "AU",
    region: "oceania",
    clusterId: "melbourne",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "PORT_MELBOURNE",
    label: "Port of Melbourne",
    kind: "port",
    lat: -37.8258,
    lng: 144.9235,
    countryCode: "AU",
    region: "oceania",
    clusterId: "melbourne",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "BNE",
    label: "Brisbane Airport",
    kind: "airport",
    lat: -27.3841,
    lng: 153.1175,
    countryCode: "AU",
    region: "oceania",
    clusterId: "brisbane",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "PORT_BRISBANE",
    label: "Port of Brisbane",
    kind: "port",
    lat: -27.3926,
    lng: 153.1703,
    countryCode: "AU",
    region: "oceania",
    clusterId: "brisbane",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "AKL",
    label: "Auckland Airport",
    kind: "airport",
    lat: -37.0082,
    lng: 174.7919,
    countryCode: "NZ",
    region: "oceania",
    clusterId: "auckland",
    marketScope: ["global", "australia", "other"]
  }),
  createHub({
    id: "PORT_TAURANGA",
    label: "Port of Tauranga NZ",
    kind: "port",
    lat: -37.6508,
    lng: 176.1671,
    countryCode: "NZ",
    region: "oceania",
    clusterId: "tauranga",
    marketScope: ["global", "australia", "other"]
  })
];

export const GLOBAL_TRANSSHIPMENT_HUBS = GLOBAL_TRANSSHIPMENT_HUBS_INTERNAL;

export const DESTINATION_HUBS_BY_MARKET: Record<string, RouteHub[]> = {
  usa: USA_DESTINATION_HUBS,
  eu: EU_DESTINATION_HUBS,
  korea: KOREA_DESTINATION_HUBS,
  japan: JAPAN_DESTINATION_HUBS,
  china: CHINA_DESTINATION_HUBS,
  asean: ASEAN_DESTINATION_HUBS,
  australia: AUSTRALIA_DESTINATION_HUBS,
  other: GLOBAL_TRANSSHIPMENT_HUBS_INTERNAL
};

const buildUniqueHubList = (...groups: RouteHub[][]) => {
  const seen = new Set<string>();
  const result: RouteHub[] = [];

  for (const group of groups) {
    for (const hub of group) {
      if (seen.has(hub.id)) continue;
      seen.add(hub.id);
      result.push(hub);
    }
  }

  return result;
};

export const ALL_ROUTE_HUBS = buildUniqueHubList(
  VIETNAM_TRANSFER_HUBS,
  GLOBAL_TRANSSHIPMENT_HUBS_INTERNAL,
  ...Object.values(DESTINATION_HUBS_BY_MARKET)
);

export const ROUTE_HUB_BY_ID = ALL_ROUTE_HUBS.reduce<Record<string, RouteHub>>(
  (accumulator, hub) => {
    accumulator[hub.id] = hub;
    return accumulator;
  },
  {}
);

export const getRouteHubById = (hubId: string | null | undefined) =>
  hubId ? ROUTE_HUB_BY_ID[hubId] || null : null;

export const getDestinationRouteHubsByMarket = (market: string | null | undefined) =>
  DESTINATION_HUBS_BY_MARKET[market || ""] || DESTINATION_HUBS_BY_MARKET.other;

export const EXPORT_CORRIDORS: ExportCorridor[] = [
  createCorridor({
    id: "sea-vn-port-sin-cai-mep",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "PORT_SIN",
    marketScope: ["global", ...ALL_EXPORT_MARKETS],
    bidirectional: false,
    handlingHours: 18
  }),
  createCorridor({
    id: "sea-vn-port-sin-cat-lai",
    mode: "sea",
    fromHubId: "CAT_LAI",
    toHubId: "PORT_SIN",
    marketScope: ["global", ...ALL_EXPORT_MARKETS],
    bidirectional: false,
    handlingHours: 18
  }),
  createCorridor({
    id: "sea-vn-port-klang-cai-mep",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "PORT_KLANG",
    marketScope: ["global", "usa", "eu", "other"],
    bidirectional: false,
    handlingHours: 20
  }),
  createCorridor({
    id: "sea-vn-tanjung-pelepas-cat-lai",
    mode: "sea",
    fromHubId: "CAT_LAI",
    toHubId: "TANJUNG_PELEPAS",
    marketScope: ["global", "usa", "eu", "other"],
    bidirectional: false,
    handlingHours: 22
  }),
  createCorridor({
    id: "sea-vn-colombo-lach-huyen",
    mode: "sea",
    fromHubId: "LACH_HUYEN",
    toHubId: "COLOMBO",
    marketScope: ["global", "eu", "other"],
    bidirectional: false,
    handlingHours: 24
  }),
  createCorridor({
    id: "sea-vn-usa-cai-mep-la",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "PORT_LA",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 30
  }),
  createCorridor({
    id: "sea-vn-usa-cai-mep-lb",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "PORT_LB",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 30
  }),
  createCorridor({
    id: "sea-vn-usa-lach-huyen-nynj",
    mode: "sea",
    fromHubId: "LACH_HUYEN",
    toHubId: "PORT_NYNJ",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 34
  }),
  createCorridor({
    id: "sea-vn-eu-cai-mep-rotterdam",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "ROTTERDAM",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 34
  }),
  createCorridor({
    id: "sea-vn-eu-cai-mep-antwerp",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "ANTWERP",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 34
  }),
  createCorridor({
    id: "sea-vn-eu-lach-huyen-hamburg",
    mode: "sea",
    fromHubId: "LACH_HUYEN",
    toHubId: "HAMBURG",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 33
  }),
  createCorridor({
    id: "sea-vn-eu-cai-mep-piraeus",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "PIRAEUS",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 30
  }),
  createCorridor({
    id: "sea-vn-korea-cai-mep-busan",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "BUSAN_PORT",
    marketScope: ["korea"],
    bidirectional: false,
    handlingHours: 18
  }),
  createCorridor({
    id: "sea-vn-japan-cai-mep-yokohama",
    mode: "sea",
    fromHubId: "CAI_MEP",
    toHubId: "YOKOHAMA",
    marketScope: ["japan"],
    bidirectional: false,
    handlingHours: 18
  }),
  createCorridor({
    id: "sea-vn-japan-lach-huyen-tokyo",
    mode: "sea",
    fromHubId: "LACH_HUYEN",
    toHubId: "TOKYO_PORT",
    marketScope: ["japan"],
    bidirectional: false,
    handlingHours: 18
  }),
  createCorridor({
    id: "sea-vn-china-cat-lai-shanghai",
    mode: "sea",
    fromHubId: "CAT_LAI",
    toHubId: "SHANGHAI_PORT",
    marketScope: ["china"],
    bidirectional: false,
    handlingHours: 16
  }),
  createCorridor({
    id: "sea-vn-china-cat-lai-yantian",
    mode: "sea",
    fromHubId: "CAT_LAI",
    toHubId: "YANTIAN",
    marketScope: ["china"],
    bidirectional: false,
    handlingHours: 15
  }),
  createCorridor({
    id: "sea-port-sin-usa-la",
    mode: "sea",
    fromHubId: "PORT_SIN",
    toHubId: "PORT_LA",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 32
  }),
  createCorridor({
    id: "sea-port-sin-usa-lb",
    mode: "sea",
    fromHubId: "PORT_SIN",
    toHubId: "PORT_LB",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 32
  }),
  createCorridor({
    id: "sea-port-sin-eu-rotterdam",
    mode: "sea",
    fromHubId: "PORT_SIN",
    toHubId: "ROTTERDAM",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 36
  }),
  createCorridor({
    id: "sea-port-sin-eu-antwerp",
    mode: "sea",
    fromHubId: "PORT_SIN",
    toHubId: "ANTWERP",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 36
  }),
  createCorridor({
    id: "sea-colombo-eu-piraeus",
    mode: "sea",
    fromHubId: "COLOMBO",
    toHubId: "PIRAEUS",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 30
  }),
  createCorridor({
    id: "air-sgn-sin",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "SIN",
    marketScope: ["global", ...ALL_EXPORT_MARKETS],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-sgn-hkg",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "HKG",
    marketScope: ["global", ...ALL_EXPORT_MARKETS],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-sgn-dxb",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "DXB",
    marketScope: ["global", "usa", "eu", "other"],
    bidirectional: true,
    handlingHours: 10
  }),
  createCorridor({
    id: "air-sgn-icn",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "ICN",
    marketScope: ["korea"],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-sgn-nrt",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "NRT",
    marketScope: ["japan"],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-sgn-pvg",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "PVG",
    marketScope: ["china"],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-han-hkg",
    mode: "air",
    fromHubId: "HAN",
    toHubId: "HKG",
    marketScope: ["global", ...ALL_EXPORT_MARKETS],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-han-icn",
    mode: "air",
    fromHubId: "HAN",
    toHubId: "ICN",
    marketScope: ["korea"],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-han-nrt",
    mode: "air",
    fromHubId: "HAN",
    toHubId: "NRT",
    marketScope: ["japan"],
    bidirectional: true,
    handlingHours: 8
  }),
  createCorridor({
    id: "air-sgn-lax",
    mode: "air",
    fromHubId: "SGN",
    toHubId: "LAX",
    marketScope: ["usa"],
    bidirectional: false,
    handlingHours: 12
  }),
  createCorridor({
    id: "air-han-fra",
    mode: "air",
    fromHubId: "HAN",
    toHubId: "FRA",
    marketScope: ["eu"],
    bidirectional: false,
    handlingHours: 12
  }),
  createCorridor({
    id: "air-sin-lax",
    mode: "air",
    fromHubId: "SIN",
    toHubId: "LAX",
    marketScope: ["usa"],
    bidirectional: true,
    handlingHours: 12
  }),
  createCorridor({
    id: "air-sin-fra",
    mode: "air",
    fromHubId: "SIN",
    toHubId: "FRA",
    marketScope: ["eu"],
    bidirectional: true,
    handlingHours: 12
  }),
  createCorridor({
    id: "air-dxb-fra",
    mode: "air",
    fromHubId: "DXB",
    toHubId: "FRA",
    marketScope: ["eu", "other"],
    bidirectional: true,
    handlingHours: 10
  }),
  createCorridor({
    id: "air-dxb-jfk",
    mode: "air",
    fromHubId: "DXB",
    toHubId: "JFK",
    marketScope: ["usa"],
    bidirectional: true,
    handlingHours: 12
  }),
  createCorridor({
    id: "rail-dongdang-nanning",
    mode: "rail",
    fromHubId: "DONG_DANG_RAIL",
    toHubId: "NANNING_RAIL",
    marketScope: ["china", "eu"],
    bidirectional: true,
    handlingHours: 10
  }),
  createCorridor({
    id: "rail-songthan-nanning",
    mode: "rail",
    fromHubId: "SONG_THAN",
    toHubId: "NANNING_RAIL",
    marketScope: ["china", "eu"],
    bidirectional: false,
    handlingHours: 14
  }),
  createCorridor({
    id: "rail-laocai-chengdu",
    mode: "rail",
    fromHubId: "LAO_CAI_RAIL",
    toHubId: "CHENGDU_QBJ",
    marketScope: ["china", "eu"],
    bidirectional: true,
    handlingHours: 14
  }),
  createCorridor({
    id: "rail-nanning-guangzhou",
    mode: "rail",
    fromHubId: "NANNING_RAIL",
    toHubId: "GUANGZHOU_RAIL",
    marketScope: ["china"],
    bidirectional: true,
    handlingHours: 10
  }),
  createCorridor({
    id: "rail-nanning-shenzhen",
    mode: "rail",
    fromHubId: "NANNING_RAIL",
    toHubId: "SHENZHEN_RAIL",
    marketScope: ["china"],
    bidirectional: true,
    handlingHours: 10
  }),
  createCorridor({
    id: "rail-nanning-shanghai",
    mode: "rail",
    fromHubId: "NANNING_RAIL",
    toHubId: "SHANGHAI_RAIL",
    marketScope: ["china"],
    bidirectional: true,
    handlingHours: 14
  }),
  createCorridor({
    id: "rail-nanning-xian",
    mode: "rail",
    fromHubId: "NANNING_RAIL",
    toHubId: "XIAN_RAIL",
    marketScope: ["china", "eu"],
    bidirectional: true,
    handlingHours: 12
  }),
  createCorridor({
    id: "rail-xian-khorgos",
    mode: "rail",
    fromHubId: "XIAN_RAIL",
    toHubId: "KHORGOS",
    marketScope: ["eu", "other"],
    bidirectional: true,
    handlingHours: 16
  }),
  createCorridor({
    id: "rail-chengdu-alashankou",
    mode: "rail",
    fromHubId: "CHENGDU_QBJ",
    toHubId: "ALASHANKOU",
    marketScope: ["eu", "other"],
    bidirectional: true,
    handlingHours: 16
  }),
  createCorridor({
    id: "rail-khorgos-malaszewicze",
    mode: "rail",
    fromHubId: "KHORGOS",
    toHubId: "MALASZEWICZE",
    marketScope: ["eu"],
    bidirectional: true,
    handlingHours: 18
  }),
  createCorridor({
    id: "rail-alashankou-bilk",
    mode: "rail",
    fromHubId: "ALASHANKOU",
    toHubId: "BILK",
    marketScope: ["eu", "other"],
    bidirectional: true,
    handlingHours: 18
  }),
  createCorridor({
    id: "rail-malaszewicze-duisburg",
    mode: "rail",
    fromHubId: "MALASZEWICZE",
    toHubId: "DUISBURG",
    marketScope: ["eu"],
    bidirectional: true,
    handlingHours: 14
  }),
  createCorridor({
    id: "rail-bilk-vienna",
    mode: "rail",
    fromHubId: "BILK",
    toHubId: "VIENNA_SOUTH",
    marketScope: ["eu"],
    bidirectional: true,
    handlingHours: 12
  }),
  createCorridor({
    id: "rail-tashkent-aprin",
    mode: "rail",
    fromHubId: "TASHKENT_RAIL",
    toHubId: "APRIN_RAIL",
    marketScope: ["other"],
    bidirectional: true,
    handlingHours: 14
  }),

  // === Vietnam → SE Asia (sea) ===
  createCorridor({ id: "sea-vn-asean-caimepp-laemchabang", mode: "sea", fromHubId: "CAI_MEP", toHubId: "LAEM_CHABANG", marketScope: ["asean", "global"], bidirectional: false, handlingHours: 24 }),
  createCorridor({ id: "sea-vn-asean-caimepp-tanjung", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_TANJUNG_PRIOK", marketScope: ["asean", "global"], bidirectional: false, handlingHours: 30 }),
  createCorridor({ id: "sea-vn-asean-tien-sa-laemchabang", mode: "sea", fromHubId: "TIEN_SA", toHubId: "LAEM_CHABANG", marketScope: ["asean"], bidirectional: false, handlingHours: 22 }),
  createCorridor({ id: "sea-vn-asean-lach-huyen-laemchabang", mode: "sea", fromHubId: "LACH_HUYEN", toHubId: "LAEM_CHABANG", marketScope: ["asean", "global"], bidirectional: false, handlingHours: 26 }),
  createCorridor({ id: "sea-vn-asean-cat-lai-klang", mode: "sea", fromHubId: "CAT_LAI", toHubId: "PORT_KLANG", marketScope: ["asean"], bidirectional: false, handlingHours: 28 }),
  createCorridor({ id: "sea-vn-asean-cai-mep-penang", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_PENANG", marketScope: ["asean"], bidirectional: false, handlingHours: 30 }),
  createCorridor({ id: "sea-vn-asean-cat-lai-manila", mode: "sea", fromHubId: "CAT_LAI", toHubId: "PORT_MANILA", marketScope: ["asean"], bidirectional: false, handlingHours: 36 }),
  createCorridor({ id: "sea-vn-asean-lach-huyen-yangon", mode: "sea", fromHubId: "LACH_HUYEN", toHubId: "PORT_YANGON", marketScope: ["asean"], bidirectional: false, handlingHours: 42 }),
  createCorridor({ id: "sea-vn-asean-caimepp-sin", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_SIN", marketScope: ["asean", "global", ...ALL_EXPORT_MARKETS], bidirectional: false, handlingHours: 18 }),

  // === Vietnam → SE Asia (air) ===
  createCorridor({ id: "air-sgn-bkk", mode: "air", fromHubId: "SGN", toHubId: "BKK_A", marketScope: ["asean"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-sgn-kul", mode: "air", fromHubId: "SGN", toHubId: "KUL", marketScope: ["asean", "global"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-sgn-cgk", mode: "air", fromHubId: "SGN", toHubId: "CGK", marketScope: ["asean"], bidirectional: true, handlingHours: 7 }),
  createCorridor({ id: "air-sgn-mni", mode: "air", fromHubId: "SGN", toHubId: "MNL", marketScope: ["asean"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-han-kul", mode: "air", fromHubId: "HAN", toHubId: "KUL", marketScope: ["asean", "global"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-han-bkk", mode: "air", fromHubId: "HAN", toHubId: "BKK_A", marketScope: ["asean"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-han-sin-asean", mode: "air", fromHubId: "HAN", toHubId: "SIN", marketScope: ["asean", "global", ...ALL_EXPORT_MARKETS], bidirectional: true, handlingHours: 7 }),
  createCorridor({ id: "air-sgn-rgn", mode: "air", fromHubId: "SGN", toHubId: "RGN", marketScope: ["asean"], bidirectional: true, handlingHours: 6 }),

  // === SE Asia intra-hub (sea) ===
  createCorridor({ id: "sea-laemchabang-sin", mode: "sea", fromHubId: "LAEM_CHABANG", toHubId: "PORT_SIN", marketScope: ["asean", "global", ...ALL_EXPORT_MARKETS], bidirectional: false, handlingHours: 20 }),
  createCorridor({ id: "sea-tanjung-priok-sin", mode: "sea", fromHubId: "PORT_TANJUNG_PRIOK", toHubId: "PORT_SIN", marketScope: ["asean", "global", ...ALL_EXPORT_MARKETS], bidirectional: false, handlingHours: 18 }),
  createCorridor({ id: "sea-klang-sin", mode: "sea", fromHubId: "PORT_KLANG", toHubId: "PORT_SIN", marketScope: ["global", ...ALL_EXPORT_MARKETS], bidirectional: false, handlingHours: 12 }),

  // === South Asia corridors (sea) ===
  createCorridor({ id: "sea-sin-jnpt", mode: "sea", fromHubId: "PORT_SIN", toHubId: "PORT_JNPT", marketScope: ["other"], bidirectional: true, handlingHours: 28 }),
  createCorridor({ id: "sea-colombo-jnpt", mode: "sea", fromHubId: "COLOMBO", toHubId: "PORT_JNPT", marketScope: ["other"], bidirectional: true, handlingHours: 22 }),
  createCorridor({ id: "sea-jnpt-jebel-ali", mode: "sea", fromHubId: "PORT_JNPT", toHubId: "JEBEL_ALI", marketScope: ["eu", "other"], bidirectional: true, handlingHours: 26 }),
  createCorridor({ id: "sea-colombo-jebel-ali", mode: "sea", fromHubId: "COLOMBO", toHubId: "JEBEL_ALI", marketScope: ["eu", "other"], bidirectional: true, handlingHours: 24 }),
  createCorridor({ id: "sea-chittagong-sin", mode: "sea", fromHubId: "PORT_CHITTAGONG", toHubId: "PORT_SIN", marketScope: ["global", ...ALL_EXPORT_MARKETS], bidirectional: false, handlingHours: 34 }),
  createCorridor({ id: "sea-jnpt-chennai", mode: "sea", fromHubId: "PORT_JNPT", toHubId: "PORT_CHENNAI", marketScope: ["other"], bidirectional: true, handlingHours: 20 }),

  // === Middle East → EU (sea) ===
  createCorridor({ id: "sea-jebel-ali-rotterdam", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: false, handlingHours: 32 }),
  createCorridor({ id: "sea-jebel-ali-hamburg", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "HAMBURG", marketScope: ["eu"], bidirectional: false, handlingHours: 34 }),
  createCorridor({ id: "sea-jebel-ali-antwerp", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "ANTWERP", marketScope: ["eu"], bidirectional: false, handlingHours: 33 }),
  createCorridor({ id: "sea-jebel-ali-genoa", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "PORT_GENOA", marketScope: ["eu"], bidirectional: false, handlingHours: 26 }),
  createCorridor({ id: "sea-jebel-ali-marseille", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "PORT_MARSEILLE", marketScope: ["eu"], bidirectional: false, handlingHours: 27 }),
  createCorridor({ id: "sea-jebel-ali-barcelona", mode: "sea", fromHubId: "JEBEL_ALI", toHubId: "PORT_BARCELONA", marketScope: ["eu"], bidirectional: false, handlingHours: 28 }),
  createCorridor({ id: "sea-jeddah-rotterdam", mode: "sea", fromHubId: "PORT_JEDDAH", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: false, handlingHours: 28 }),
  createCorridor({ id: "sea-jeddah-genoa", mode: "sea", fromHubId: "PORT_JEDDAH", toHubId: "PORT_GENOA", marketScope: ["eu"], bidirectional: false, handlingHours: 22 }),
  createCorridor({ id: "sea-jeddah-marseille", mode: "sea", fromHubId: "PORT_JEDDAH", toHubId: "PORT_MARSEILLE", marketScope: ["eu"], bidirectional: false, handlingHours: 22 }),
  createCorridor({ id: "sea-salalah-rotterdam", mode: "sea", fromHubId: "PORT_SALALAH", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: false, handlingHours: 30 }),

  // === Vietnam & SE Asia → EU southern ports (sea) ===
  createCorridor({ id: "sea-cai-mep-genoa", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_GENOA", marketScope: ["eu"], bidirectional: false, handlingHours: 32 }),
  createCorridor({ id: "sea-cai-mep-marseille", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_MARSEILLE", marketScope: ["eu"], bidirectional: false, handlingHours: 32 }),
  createCorridor({ id: "sea-cai-mep-barcelona", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_BARCELONA", marketScope: ["eu"], bidirectional: false, handlingHours: 33 }),
  createCorridor({ id: "sea-cai-mep-le-havre", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_LE_HAVRE", marketScope: ["eu"], bidirectional: false, handlingHours: 33 }),
  createCorridor({ id: "sea-piraeus-rotterdam", mode: "sea", fromHubId: "PIRAEUS", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: true, handlingHours: 14 }),
  createCorridor({ id: "sea-piraeus-genoa", mode: "sea", fromHubId: "PIRAEUS", toHubId: "PORT_GENOA", marketScope: ["eu"], bidirectional: true, handlingHours: 10 }),
  createCorridor({ id: "sea-genoa-antwerp", mode: "sea", fromHubId: "PORT_GENOA", toHubId: "ANTWERP", marketScope: ["eu"], bidirectional: true, handlingHours: 12 }),
  createCorridor({ id: "sea-marseille-rotterdam", mode: "sea", fromHubId: "PORT_MARSEILLE", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: true, handlingHours: 14 }),
  createCorridor({ id: "sea-barcelona-antwerp", mode: "sea", fromHubId: "PORT_BARCELONA", toHubId: "ANTWERP", marketScope: ["eu"], bidirectional: true, handlingHours: 12 }),
  createCorridor({ id: "sea-algeciras-rotterdam", mode: "sea", fromHubId: "PORT_ALGECIRAS", toHubId: "ROTTERDAM", marketScope: ["eu", "usa"], bidirectional: false, handlingHours: 12 }),
  createCorridor({ id: "sea-felixstowe-rotterdam", mode: "sea", fromHubId: "PORT_FELIXSTOWE", toHubId: "ROTTERDAM", marketScope: ["eu"], bidirectional: true, handlingHours: 8 }),
  createCorridor({ id: "sea-le-havre-antwerp", mode: "sea", fromHubId: "PORT_LE_HAVRE", toHubId: "ANTWERP", marketScope: ["eu"], bidirectional: true, handlingHours: 8 }),

  // === Vietnam & SE Asia → Australia (sea) ===
  createCorridor({ id: "sea-sin-sydney", mode: "sea", fromHubId: "PORT_SIN", toHubId: "PORT_BOTANY", marketScope: ["australia"], bidirectional: false, handlingHours: 48 }),
  createCorridor({ id: "sea-sin-melbourne", mode: "sea", fromHubId: "PORT_SIN", toHubId: "PORT_MELBOURNE", marketScope: ["australia"], bidirectional: false, handlingHours: 50 }),
  createCorridor({ id: "sea-sin-brisbane", mode: "sea", fromHubId: "PORT_SIN", toHubId: "PORT_BRISBANE", marketScope: ["australia"], bidirectional: false, handlingHours: 52 }),
  createCorridor({ id: "sea-tanjung-sydney", mode: "sea", fromHubId: "PORT_TANJUNG_PRIOK", toHubId: "PORT_BOTANY", marketScope: ["australia"], bidirectional: false, handlingHours: 54 }),
  createCorridor({ id: "sea-colombo-sydney", mode: "sea", fromHubId: "COLOMBO", toHubId: "PORT_BOTANY", marketScope: ["australia"], bidirectional: false, handlingHours: 58 }),
  createCorridor({ id: "sea-cai-mep-sydney", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_BOTANY", marketScope: ["australia"], bidirectional: false, handlingHours: 60 }),
  createCorridor({ id: "sea-cai-mep-melbourne", mode: "sea", fromHubId: "CAI_MEP", toHubId: "PORT_MELBOURNE", marketScope: ["australia"], bidirectional: false, handlingHours: 62 }),
  createCorridor({ id: "sea-hkg-sydney", mode: "sea", fromHubId: "PORT_HKG", toHubId: "PORT_BOTANY", marketScope: ["australia"], bidirectional: false, handlingHours: 52 }),

  // === Air → Australia ===
  createCorridor({ id: "air-sin-syd", mode: "air", fromHubId: "SIN", toHubId: "SYD_D", marketScope: ["australia"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-sin-mel", mode: "air", fromHubId: "SIN", toHubId: "MEL_D", marketScope: ["australia"], bidirectional: true, handlingHours: 10 }),
  createCorridor({ id: "air-sin-bne", mode: "air", fromHubId: "SIN", toHubId: "BNE_D", marketScope: ["australia"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-dxb-syd", mode: "air", fromHubId: "DXB", toHubId: "SYD_D", marketScope: ["australia"], bidirectional: true, handlingHours: 12 }),
  createCorridor({ id: "air-hkg-syd", mode: "air", fromHubId: "HKG", toHubId: "SYD_D", marketScope: ["australia"], bidirectional: true, handlingHours: 10 }),
  createCorridor({ id: "air-sgn-syd", mode: "air", fromHubId: "SGN", toHubId: "SYD_D", marketScope: ["australia"], bidirectional: false, handlingHours: 11 }),
  createCorridor({ id: "air-sgn-mel", mode: "air", fromHubId: "SGN", toHubId: "MEL_D", marketScope: ["australia"], bidirectional: false, handlingHours: 11 }),

  // === Air → EU southern hubs ===
  createCorridor({ id: "air-sin-mxp", mode: "air", fromHubId: "SIN", toHubId: "MXP", marketScope: ["eu"], bidirectional: true, handlingHours: 12 }),
  createCorridor({ id: "air-dxb-mxp", mode: "air", fromHubId: "DXB", toHubId: "MXP", marketScope: ["eu"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-dxb-bcn", mode: "air", fromHubId: "DXB", toHubId: "BCN", marketScope: ["eu"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-han-ams", mode: "air", fromHubId: "HAN", toHubId: "AMS", marketScope: ["eu"], bidirectional: false, handlingHours: 12 }),
  createCorridor({ id: "air-sgn-fra", mode: "air", fromHubId: "SGN", toHubId: "FRA", marketScope: ["eu"], bidirectional: false, handlingHours: 12 }),
  createCorridor({ id: "air-sgn-cdg", mode: "air", fromHubId: "SGN", toHubId: "CDG", marketScope: ["eu"], bidirectional: false, handlingHours: 12 }),
  createCorridor({ id: "air-hkg-fra", mode: "air", fromHubId: "HKG", toHubId: "FRA", marketScope: ["eu"], bidirectional: true, handlingHours: 11 }),

  // === Air → USA additional ===
  createCorridor({ id: "air-han-jfk", mode: "air", fromHubId: "HAN", toHubId: "JFK", marketScope: ["usa"], bidirectional: false, handlingHours: 14 }),
  createCorridor({ id: "air-han-ord", mode: "air", fromHubId: "HAN", toHubId: "ORD", marketScope: ["usa"], bidirectional: false, handlingHours: 14 }),
  createCorridor({ id: "air-sgn-ord", mode: "air", fromHubId: "SGN", toHubId: "ORD", marketScope: ["usa"], bidirectional: false, handlingHours: 13 }),
  createCorridor({ id: "air-hkg-jfk", mode: "air", fromHubId: "HKG", toHubId: "JFK", marketScope: ["usa"], bidirectional: true, handlingHours: 13 }),
  createCorridor({ id: "air-hkg-lax", mode: "air", fromHubId: "HKG", toHubId: "LAX", marketScope: ["usa"], bidirectional: true, handlingHours: 12 }),

  // === South Asia air feeder ===
  createCorridor({ id: "air-sgn-bom", mode: "air", fromHubId: "SGN", toHubId: "BOM", marketScope: ["other"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-han-del", mode: "air", fromHubId: "HAN", toHubId: "DEL", marketScope: ["other"], bidirectional: true, handlingHours: 9 }),
  createCorridor({ id: "air-sin-bom", mode: "air", fromHubId: "SIN", toHubId: "BOM", marketScope: ["other"], bidirectional: true, handlingHours: 7 }),
  createCorridor({ id: "air-dxb-del", mode: "air", fromHubId: "DXB", toHubId: "DEL", marketScope: ["other"], bidirectional: true, handlingHours: 6 }),
  createCorridor({ id: "air-dxb-bom", mode: "air", fromHubId: "DXB", toHubId: "BOM", marketScope: ["other"], bidirectional: true, handlingHours: 6 }),

  // === EU intra-rail ===
  createCorridor({ id: "rail-duisburg-milan", mode: "rail", fromHubId: "DUISBURG", toHubId: "MILAN_RAIL", marketScope: ["eu"], bidirectional: true, handlingHours: 10 }),
  createCorridor({ id: "rail-vienna-milan", mode: "rail", fromHubId: "VIENNA_SOUTH", toHubId: "MILAN_RAIL", marketScope: ["eu"], bidirectional: true, handlingHours: 10 }),
  createCorridor({ id: "rail-warsaw-milan", mode: "rail", fromHubId: "WARSAW_RAIL", toHubId: "MILAN_RAIL", marketScope: ["eu"], bidirectional: false, handlingHours: 12 }),
  createCorridor({ id: "rail-milan-barcelona", mode: "rail", fromHubId: "MILAN_RAIL", toHubId: "BARCELONA_RAIL", marketScope: ["eu"], bidirectional: true, handlingHours: 12 })
];
