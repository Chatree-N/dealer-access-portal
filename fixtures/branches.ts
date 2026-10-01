import seedData from "./seed-data.json";

export type Dealer = {
  id: string;
  name: string;
  emailDomains: string[];
};

export type Branch = {
  code: string;
  dealerId: string;
  name: string;
  province: string;
  region: string;
  status: "active" | "inactive";
};

export const DEALERS: Dealer[] = seedData.dealers;
export const BRANCHES: Branch[] = seedData.branches as Branch[];
