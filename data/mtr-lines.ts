export type MtrLine = {
  code: string;
  name: string;
  color: string;
};

export type MtrStation = {
  code: string;
  name: string;
};

export const MTR_LINES: MtrLine[] = [
  { code: "AEL", name: "Airport Express", color: "#0b8f8f" },
  { code: "TCL", name: "Tung Chung Line", color: "#f28b30" },
  { code: "TML", name: "Tuen Ma Line", color: "#8c4b2f" },
  { code: "TKL", name: "Tseung Kwan O Line", color: "#5a63b6" },
  { code: "EAL", name: "East Rail Line", color: "#4b7aa3" },
  { code: "SIL", name: "South Island Line", color: "#b8a23a" },
  { code: "TWL", name: "Tsuen Wan Line", color: "#d94b3d" },
  { code: "ISL", name: "Island Line", color: "#2b7aa0" },
  { code: "KTL", name: "Kwun Tong Line", color: "#33a16f" },
  { code: "DRL", name: "Disneyland Resort Line", color: "#d67aa4" },
];

export const MTR_STATIONS_BY_LINE: Record<string, MtrStation[]> = {
  AEL: [
    { code: "HOK", name: "Hong Kong" },
    { code: "KOW", name: "Kowloon" },
    { code: "TSY", name: "Tsing Yi" },
    { code: "AIR", name: "Airport" },
    { code: "AWE", name: "AsiaWorld Expo" },
  ],
  TCL: [
    { code: "HOK", name: "Hong Kong" },
    { code: "KOW", name: "Kowloon" },
    { code: "OLY", name: "Olympic" },
    { code: "NAC", name: "Nam Cheong" },
    { code: "LAK", name: "Lai King" },
    { code: "TSY", name: "Tsing Yi" },
    { code: "SUN", name: "Sunny Bay" },
    { code: "TUC", name: "Tung Chung" },
  ],
  TML: [
    { code: "WKS", name: "Wu Kai Sha" },
    { code: "MOS", name: "Ma On Shan" },
    { code: "HEO", name: "Heng On" },
    { code: "TSH", name: "Tai Shui Hang" },
    { code: "SHM", name: "Shek Mun" },
    { code: "CIO", name: "City One" },
    { code: "STW", name: "Sha Tin Wai" },
    { code: "CKT", name: "Che Kung Temple" },
    { code: "TAW", name: "Tai Wai" },
    { code: "HIK", name: "Hin Keng" },
    { code: "DIH", name: "Diamond Hill" },
    { code: "KAT", name: "Kai Tak" },
    { code: "SUW", name: "Sung Wong Toi" },
    { code: "TKW", name: "To Kwa Wan" },
    { code: "HOM", name: "Ho Man Tin" },
    { code: "HUH", name: "Hung Hom" },
    { code: "ETS", name: "East Tsim Sha Tsui" },
    { code: "AUS", name: "Austin" },
    { code: "NAC", name: "Nam Cheong" },
    { code: "MEF", name: "Mei Foo" },
    { code: "TWW", name: "Tsuen Wan West" },
    { code: "KSR", name: "Kam Sheung Road" },
    { code: "YUL", name: "Yuen Long" },
    { code: "LOP", name: "Long Ping" },
    { code: "TIS", name: "Tin Shui Wai" },
    { code: "SIH", name: "Siu Hong" },
    { code: "TUM", name: "Tuen Mun" },
  ],
  TKL: [
    { code: "NOP", name: "North Point" },
    { code: "QUB", name: "Quarry Bay" },
    { code: "YAT", name: "Yau Tong" },
    { code: "TIK", name: "Tiu Keng Leng" },
    { code: "TKO", name: "Tseung Kwan O" },
    { code: "LHP", name: "LOHAS Park" },
    { code: "HAH", name: "Hang Hau" },
    { code: "POA", name: "Po Lam" },
  ],
  EAL: [
    { code: "ADM", name: "Admiralty" },
    { code: "EXC", name: "Exhibition Centre" },
    { code: "HUH", name: "Hung Hom" },
    { code: "MKK", name: "Mong Kok East" },
    { code: "KOT", name: "Kowloon Tong" },
    { code: "TAW", name: "Tai Wai" },
    { code: "SHT", name: "Sha Tin" },
    { code: "FOT", name: "Fo Tan" },
    { code: "RAC", name: "Racecourse" },
    { code: "UNI", name: "University" },
    { code: "TAP", name: "Tai Po Market" },
    { code: "TWO", name: "Tai Wo" },
    { code: "FAN", name: "Fanling" },
    { code: "SHS", name: "Sheung Shui" },
    { code: "LOW", name: "Lo Wu" },
    { code: "LMC", name: "Lok Ma Chau" },
  ],
  SIL: [
    { code: "ADM", name: "Admiralty" },
    { code: "OCP", name: "Ocean Park" },
    { code: "WCH", name: "Wong Chuk Hang" },
    { code: "LET", name: "Lei Tung" },
    { code: "SOH", name: "South Horizons" },
  ],
  TWL: [
    { code: "CEN", name: "Central" },
    { code: "ADM", name: "Admiralty" },
    { code: "TST", name: "Tsim Sha Tsui" },
    { code: "JOR", name: "Jordan" },
    { code: "YMT", name: "Yau Ma Tei" },
    { code: "MOK", name: "Mong Kok" },
    { code: "PRE", name: "Prince Edward" },
    { code: "SSP", name: "Sham Shui Po" },
    { code: "CSW", name: "Cheung Sha Wan" },
    { code: "LCK", name: "Lai Chi Kok" },
    { code: "MEF", name: "Mei Foo" },
    { code: "LAK", name: "Lai King" },
    { code: "KWF", name: "Kwai Fong" },
    { code: "KWH", name: "Kwai Hing" },
    { code: "TWH", name: "Tai Wo Hau" },
    { code: "TSW", name: "Tsuen Wan" },
  ],
  ISL: [
    { code: "KET", name: "Kennedy Town" },
    { code: "HKU", name: "HKU" },
    { code: "SYP", name: "Sai Ying Pun" },
    { code: "SHW", name: "Sheung Wan" },
    { code: "CEN", name: "Central" },
    { code: "ADM", name: "Admiralty" },
    { code: "WAC", name: "Wan Chai" },
    { code: "CAB", name: "Causeway Bay" },
    { code: "TIH", name: "Tin Hau" },
    { code: "FOH", name: "Fortress Hill" },
    { code: "NOP", name: "North Point" },
    { code: "QUB", name: "Quarry Bay" },
    { code: "TAK", name: "Tai Koo" },
    { code: "SWH", name: "Sai Wan Ho" },
    { code: "SKW", name: "Shau Kei Wan" },
    { code: "HFC", name: "Heng Fa Chuen" },
    { code: "CHW", name: "Chai Wan" },
  ],
  KTL: [
    { code: "WHA", name: "Whampoa" },
    { code: "HOM", name: "Ho Man Tin" },
    { code: "YMT", name: "Yau Ma Tei" },
    { code: "MOK", name: "Mong Kok" },
    { code: "PRE", name: "Prince Edward" },
    { code: "SKM", name: "Shek Kip Mei" },
    { code: "KOT", name: "Kowloon Tong" },
    { code: "LOF", name: "Lok Fu" },
    { code: "WTS", name: "Wong Tai Sin" },
    { code: "DIH", name: "Diamond Hill" },
    { code: "CHH", name: "Choi Hung" },
    { code: "KOB", name: "Kowloon Bay" },
    { code: "NTK", name: "Ngau Tau Kok" },
    { code: "KWT", name: "Kwun Tong" },
    { code: "LAT", name: "Lam Tin" },
    { code: "YAT", name: "Yau Tong" },
    { code: "TIK", name: "Tiu Keng Leng" },
  ],
  DRL: [
    { code: "SUN", name: "Sunny Bay" },
    { code: "DIS", name: "Disneyland Resort" },
  ],
};

export const MTR_STATION_NAME_BY_CODE: Record<string, string> =
  Object.values(MTR_STATIONS_BY_LINE).reduce<Record<string, string>>(
    (acc, stations) => {
      for (const station of stations) {
        acc[station.code] = station.name;
      }
      return acc;
    },
    {},
  );

export function isValidLine(line: string): boolean {
  return Object.prototype.hasOwnProperty.call(MTR_STATIONS_BY_LINE, line);
}

export function isValidStationForLine(line: string, station: string): boolean {
  const stations = MTR_STATIONS_BY_LINE[line];
  if (!stations) return false;
  return stations.some((entry) => entry.code === station);
}
