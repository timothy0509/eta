export type MtrLang = 'EN' | 'TC'

export type MtrStation = {
  sta: string
  lines: string[]
  nameEn: string
  nameTc: string
}

// Station list for the MTR Next Train API.
// Source: `API Docs/Next_Train_API_Spec_v1.7.pdf` station tables.
//
// Note: Stations are merged across lines (one entry per `sta`).
export const MTR_STATIONS: MtrStation[] = [
  // Airport Express (AEL)
  { sta: 'HOK', lines: ['AEL', 'TCL'], nameEn: 'Hong Kong', nameTc: '香港' },
  { sta: 'KOW', lines: ['AEL', 'TCL'], nameEn: 'Kowloon', nameTc: '九龍' },
  { sta: 'TSY', lines: ['AEL', 'TCL'], nameEn: 'Tsing Yi', nameTc: '青衣' },
  { sta: 'AIR', lines: ['AEL'], nameEn: 'Airport', nameTc: '機場' },
  { sta: 'AWE', lines: ['AEL'], nameEn: 'AsiaWorld Expo', nameTc: '博覽館' },

  // Tung Chung Line (TCL)
  { sta: 'OLY', lines: ['TCL'], nameEn: 'Olympic', nameTc: '奧運' },
  { sta: 'NAC', lines: ['TCL', 'TML'], nameEn: 'Nam Cheong', nameTc: '南昌' },
  { sta: 'LAK', lines: ['TCL', 'TWL'], nameEn: 'Lai King', nameTc: '荔景' },
  { sta: 'SUN', lines: ['TCL', 'DRL'], nameEn: 'Sunny Bay', nameTc: '欣澳' },
  { sta: 'TUC', lines: ['TCL'], nameEn: 'Tung Chung', nameTc: '東涌' },

  // Tuen Ma Line (TML)
  { sta: 'WKS', lines: ['TML'], nameEn: 'Wu Kai Sha', nameTc: '烏溪沙' },
  { sta: 'MOS', lines: ['TML'], nameEn: 'Ma On Shan', nameTc: '馬鞍山' },
  { sta: 'HEO', lines: ['TML'], nameEn: 'Heng On', nameTc: '恆安' },
  { sta: 'TSH', lines: ['TML'], nameEn: 'Tai Shui Hang', nameTc: '大水坑' },
  { sta: 'SHM', lines: ['TML'], nameEn: 'Shek Mun', nameTc: '石門' },
  { sta: 'CIO', lines: ['TML'], nameEn: 'City One', nameTc: '第一城' },
  { sta: 'STW', lines: ['TML'], nameEn: 'Sha Tin Wai', nameTc: '沙田圍' },
  { sta: 'CKT', lines: ['TML'], nameEn: 'Che Kung Temple', nameTc: '車公廟' },
  { sta: 'TAW', lines: ['TML', 'EAL'], nameEn: 'Tai Wai', nameTc: '大圍' },
  { sta: 'HIK', lines: ['TML'], nameEn: 'Hin Keng', nameTc: '顯徑' },
  {
    sta: 'DIH',
    lines: ['TML', 'KTL'],
    nameEn: 'Diamond Hill',
    nameTc: '鑽石山',
  },
  { sta: 'KAT', lines: ['TML'], nameEn: 'Kai Tak', nameTc: '啟德' },
  { sta: 'SUW', lines: ['TML'], nameEn: 'Sung Wong Toi', nameTc: '宋皇臺' },
  { sta: 'TKW', lines: ['TML'], nameEn: 'To Kwa Wan', nameTc: '土瓜灣' },
  { sta: 'HOM', lines: ['TML', 'KTL'], nameEn: 'Ho Man Tin', nameTc: '何文田' },
  { sta: 'HUH', lines: ['TML', 'EAL'], nameEn: 'Hung Hom', nameTc: '紅磡' },
  { sta: 'ETS', lines: ['TML'], nameEn: 'East Tsim Sha Tsui', nameTc: '尖東' },
  { sta: 'AUS', lines: ['TML'], nameEn: 'Austin', nameTc: '柯士甸' },
  { sta: 'MEF', lines: ['TML', 'TWL'], nameEn: 'Mei Foo', nameTc: '美孚' },
  { sta: 'TWW', lines: ['TML'], nameEn: 'Tsuen Wan West', nameTc: '荃灣西' },
  { sta: 'KSR', lines: ['TML'], nameEn: 'Kam Sheung Road', nameTc: '錦上路' },
  { sta: 'YUL', lines: ['TML'], nameEn: 'Yuen Long', nameTc: '元朗' },
  { sta: 'LOP', lines: ['TML'], nameEn: 'Long Ping', nameTc: '朗屏' },
  { sta: 'TIS', lines: ['TML'], nameEn: 'Tin Shui Wai', nameTc: '天水圍' },
  { sta: 'SIH', lines: ['TML'], nameEn: 'Siu Hong', nameTc: '兆康' },
  { sta: 'TUM', lines: ['TML'], nameEn: 'Tuen Mun', nameTc: '屯門' },

  // Tseung Kwan O Line (TKL)
  { sta: 'NOP', lines: ['TKL', 'ISL'], nameEn: 'North Point', nameTc: '北角' },
  { sta: 'QUB', lines: ['TKL', 'ISL'], nameEn: 'Quarry Bay', nameTc: '鰂魚涌' },
  { sta: 'YAT', lines: ['TKL', 'KTL'], nameEn: 'Yau Tong', nameTc: '油塘' },
  {
    sta: 'TIK',
    lines: ['TKL', 'KTL'],
    nameEn: 'Tiu Keng Leng',
    nameTc: '調景嶺',
  },
  { sta: 'TKO', lines: ['TKL'], nameEn: 'Tseung Kwan O', nameTc: '將軍澳' },
  { sta: 'LHP', lines: ['TKL'], nameEn: 'LOHAS Park', nameTc: '康城' },
  { sta: 'HAH', lines: ['TKL'], nameEn: 'Hang Hau', nameTc: '坑口' },
  { sta: 'POA', lines: ['TKL'], nameEn: 'Po Lam', nameTc: '寶琳' },

  // East Rail Line (EAL)
  {
    sta: 'ADM',
    lines: ['EAL', 'TWL', 'ISL', 'SIL'],
    nameEn: 'Admiralty',
    nameTc: '金鐘',
  },
  { sta: 'EXC', lines: ['EAL'], nameEn: 'Exhibition Centre', nameTc: '會展' },
  { sta: 'MKK', lines: ['EAL'], nameEn: 'Mong Kok East', nameTc: '旺角東' },
  {
    sta: 'KOT',
    lines: ['EAL', 'KTL'],
    nameEn: 'Kowloon Tong',
    nameTc: '九龍塘',
  },
  { sta: 'SHT', lines: ['EAL'], nameEn: 'Sha Tin', nameTc: '沙田' },
  { sta: 'FOT', lines: ['EAL'], nameEn: 'Fo Tan', nameTc: '火炭' },
  { sta: 'RAC', lines: ['EAL'], nameEn: 'Racecourse', nameTc: '馬場' },
  { sta: 'UNI', lines: ['EAL'], nameEn: 'University', nameTc: '大學' },
  { sta: 'TAP', lines: ['EAL'], nameEn: 'Tai Po Market', nameTc: '大埔墟' },
  { sta: 'TWO', lines: ['EAL'], nameEn: 'Tai Wo', nameTc: '太和' },
  { sta: 'FAN', lines: ['EAL'], nameEn: 'Fanling', nameTc: '粉嶺' },
  { sta: 'SHS', lines: ['EAL'], nameEn: 'Sheung Shui', nameTc: '上水' },
  { sta: 'LOW', lines: ['EAL'], nameEn: 'Lo Wu', nameTc: '羅湖' },
  { sta: 'LMC', lines: ['EAL'], nameEn: 'Lok Ma Chau', nameTc: '落馬洲' },

  // South Island Line (SIL)
  { sta: 'OCP', lines: ['SIL'], nameEn: 'Ocean Park', nameTc: '海洋公園' },
  { sta: 'WCH', lines: ['SIL'], nameEn: 'Wong Chuk Hang', nameTc: '黃竹坑' },
  { sta: 'LET', lines: ['SIL'], nameEn: 'Lei Tung', nameTc: '利東' },
  { sta: 'SOH', lines: ['SIL'], nameEn: 'South Horizons', nameTc: '海怡半島' },

  // Tsuen Wan Line (TWL)
  { sta: 'CEN', lines: ['TWL', 'ISL'], nameEn: 'Central', nameTc: '中環' },
  { sta: 'TST', lines: ['TWL'], nameEn: 'Tsim Sha Tsui', nameTc: '尖沙咀' },
  { sta: 'JOR', lines: ['TWL'], nameEn: 'Jordan', nameTc: '佐敦' },
  { sta: 'YMT', lines: ['TWL', 'KTL'], nameEn: 'Yau Ma Tei', nameTc: '油麻地' },
  { sta: 'MOK', lines: ['TWL', 'KTL'], nameEn: 'Mong Kok', nameTc: '旺角' },
  {
    sta: 'PRE',
    lines: ['TWL', 'KTL'],
    nameEn: 'Prince Edward',
    nameTc: '太子',
  },
  { sta: 'SSP', lines: ['TWL'], nameEn: 'Sham Shui Po', nameTc: '深水埗' },
  { sta: 'CSW', lines: ['TWL'], nameEn: 'Cheung Sha Wan', nameTc: '長沙灣' },
  { sta: 'LCK', lines: ['TWL'], nameEn: 'Lai Chi Kok', nameTc: '荔枝角' },
  { sta: 'KWF', lines: ['TWL'], nameEn: 'Kwai Fong', nameTc: '葵芳' },
  { sta: 'KWH', lines: ['TWL'], nameEn: 'Kwai Hing', nameTc: '葵興' },
  { sta: 'TWH', lines: ['TWL'], nameEn: 'Tai Wo Hau', nameTc: '大窩口' },
  { sta: 'TSW', lines: ['TWL'], nameEn: 'Tsuen Wan', nameTc: '荃灣' },

  // Island Line (ISL)
  { sta: 'KET', lines: ['ISL'], nameEn: 'Kennedy Town', nameTc: '堅尼地城' },
  { sta: 'HKU', lines: ['ISL'], nameEn: 'HKU', nameTc: '香港大學' },
  { sta: 'SYP', lines: ['ISL'], nameEn: 'Sai Ying Pun', nameTc: '西營盤' },
  { sta: 'SHW', lines: ['ISL'], nameEn: 'Sheung Wan', nameTc: '上環' },
  { sta: 'WAC', lines: ['ISL'], nameEn: 'Wan Chai', nameTc: '灣仔' },
  { sta: 'CAB', lines: ['ISL'], nameEn: 'Causeway Bay', nameTc: '銅鑼灣' },
  { sta: 'TIH', lines: ['ISL'], nameEn: 'Tin Hau', nameTc: '天后' },
  { sta: 'FOH', lines: ['ISL'], nameEn: 'Fortress Hill', nameTc: '炮台山' },
  { sta: 'TAK', lines: ['ISL'], nameEn: 'Tai Koo', nameTc: '太古' },
  { sta: 'SWH', lines: ['ISL'], nameEn: 'Sai Wan Ho', nameTc: '西灣河' },
  { sta: 'SKW', lines: ['ISL'], nameEn: 'Shau Kei Wan', nameTc: '筲箕灣' },
  { sta: 'HFC', lines: ['ISL'], nameEn: 'Heng Fa Chuen', nameTc: '杏花邨' },
  { sta: 'CHW', lines: ['ISL'], nameEn: 'Chai Wan', nameTc: '柴灣' },

  // Kwun Tong Line (KTL)
  { sta: 'WHA', lines: ['KTL'], nameEn: 'Whampoa', nameTc: '黃埔' },
  { sta: 'SKM', lines: ['KTL'], nameEn: 'Shek Kip Mei', nameTc: '石硤尾' },
  { sta: 'LOF', lines: ['KTL'], nameEn: 'Lok Fu', nameTc: '樂富' },
  { sta: 'WTS', lines: ['KTL'], nameEn: 'Wong Tai Sin', nameTc: '黃大仙' },
  { sta: 'CHH', lines: ['KTL'], nameEn: 'Choi Hung', nameTc: '彩虹' },
  { sta: 'KOB', lines: ['KTL'], nameEn: 'Kowloon Bay', nameTc: '九龍灣' },
  { sta: 'NTK', lines: ['KTL'], nameEn: 'Ngau Tau Kok', nameTc: '牛頭角' },
  { sta: 'KWT', lines: ['KTL'], nameEn: 'Kwun Tong', nameTc: '觀塘' },
  { sta: 'LAT', lines: ['KTL'], nameEn: 'Lam Tin', nameTc: '藍田' },

  // Disneyland Resort Line (DRL)
  { sta: 'DIS', lines: ['DRL'], nameEn: 'Disneyland Resort', nameTc: '迪士尼' },
]

export function formatMtrStationName(station: MtrStation, lang: MtrLang): string {
  return lang === 'TC' ? station.nameTc : station.nameEn
}

export function findMtrStationBySta(sta: string): MtrStation | undefined {
  return MTR_STATIONS.find((s) => s.sta === sta)
}

export function findMtrStationsByLine(line: string): MtrStation[] {
  return MTR_STATIONS.filter((s) => s.lines.includes(line))
}
