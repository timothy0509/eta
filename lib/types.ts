export type BusCompany =
  | "kmb"
  | "ctb"
  | "nlb"
  | "gmb"
  | "lrtfeeder"
  | "sunferry"
  | "hkkf"
  | "fortuneferry";

export type BusRouteSummary = {
  id: string;
  route: string;
  orig: string;
  dest: string;
  companies: BusCompany[];
  serviceType: string;
};

export type BusStopOption = {
  seq: number;
  stopIds: Partial<Record<BusCompany, string>>;
  names: Partial<Record<BusCompany, string>>;
};

export type BusStopData = {
  companies: BusCompany[];
  isJoint: boolean;
  stops: BusStopOption[];
};

export type BusEta = {
  time: string;
  remark: string;
  company: BusCompany;
  destination: string;
};

export type MtrEta = {
  time: string;
  platform: string;
  destination: string;
  destinationCode: string;
  sequence: string;
  timetype?: string;
  route?: string;
};

export type MtrResponse = {
  status: "ok" | "empty" | "error";
  message: string;
  isDelay: boolean | null;
  lastUpdated: string | null;
  line?: { code: string; name: string };
  station?: { code: string; name: string };
  up: MtrEta[];
  down: MtrEta[];
};
