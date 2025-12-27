export type MtrLang = "EN" | "TC";

export type MtrStation = {
  line: string;
  sta: string;
  nameEn: string;
  nameTc: string;
};

// Minimal mapping to get started; extend as needed.
// Source: Next_Train_API_Spec_v1.7 station tables.
export const MTR_STATIONS: MtrStation[] = [
  // Airport Express (AEL)
  { line: "AEL", sta: "HOK", nameEn: "Hong Kong", nameTc: "香港" },
  { line: "AEL", sta: "KOW", nameEn: "Kowloon", nameTc: "九龍" },
  { line: "AEL", sta: "TSY", nameEn: "Tsing Yi", nameTc: "青衣" },
  { line: "AEL", sta: "AIR", nameEn: "Airport", nameTc: "機場" },
  { line: "AEL", sta: "AWE", nameEn: "AsiaWorld Expo", nameTc: "博覽館" },

  // Tung Chung Line (TCL)
  { line: "TCL", sta: "HOK", nameEn: "Hong Kong", nameTc: "香港" },
  { line: "TCL", sta: "KOW", nameEn: "Kowloon", nameTc: "九龍" },
  { line: "TCL", sta: "OLY", nameEn: "Olympic", nameTc: "奧運" },
  { line: "TCL", sta: "NAC", nameEn: "Nam Cheong", nameTc: "南昌" },
  { line: "TCL", sta: "LAK", nameEn: "Lai King", nameTc: "荔景" },
  { line: "TCL", sta: "TSY", nameEn: "Tsing Yi", nameTc: "青衣" },
  { line: "TCL", sta: "SUN", nameEn: "Sunny Bay", nameTc: "欣澳" },
  { line: "TCL", sta: "TUC", nameEn: "Tung Chung", nameTc: "東涌" },

  // Tseung Kwan O Line (TKL)
  { line: "TKL", sta: "NOP", nameEn: "North Point", nameTc: "北角" },
  { line: "TKL", sta: "QUB", nameEn: "Quarry Bay", nameTc: "鰂魚涌" },
  { line: "TKL", sta: "YAT", nameEn: "Yau Tong", nameTc: "油塘" },
  { line: "TKL", sta: "TIK", nameEn: "Tiu Keng Leng", nameTc: "調景嶺" },
  { line: "TKL", sta: "TKO", nameEn: "Tseung Kwan O", nameTc: "將軍澳" },
  { line: "TKL", sta: "LHP", nameEn: "LOHAS Park", nameTc: "康城" },
  { line: "TKL", sta: "HAH", nameEn: "Hang Hau", nameTc: "坑口" },
  { line: "TKL", sta: "POA", nameEn: "Po Lam", nameTc: "寶琳" },

  // Tsuen Wan Line (TWL) partial
  { line: "TWL", sta: "CEN", nameEn: "Central", nameTc: "中環" },
  { line: "TWL", sta: "ADM", nameEn: "Admiralty", nameTc: "金鐘" },
  { line: "TWL", sta: "TST", nameEn: "Tsim Sha Tsui", nameTc: "尖沙咀" },
  { line: "TWL", sta: "JOR", nameEn: "Jordan", nameTc: "佐敦" },
  { line: "TWL", sta: "YMT", nameEn: "Yau Ma Tei", nameTc: "油麻地" },
  { line: "TWL", sta: "MOK", nameEn: "Mong Kok", nameTc: "旺角" },
  { line: "TWL", sta: "TSW", nameEn: "Tsuen Wan", nameTc: "荃灣" },
];

export function formatMtrStationName(
  station: MtrStation,
  lang: MtrLang
): string {
  return lang === "TC" ? station.nameTc : station.nameEn;
}
