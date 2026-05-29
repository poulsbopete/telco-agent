export type TelcoRole = {
  key: string;
  label: string;
  agentId: string;
  description: string;
  icon: "network" | "headset" | "receipt" | "store";
  starters: { title: string; question: string }[];
};

export type TelcoCarrier = {
  key: string;
  displayName: string;
  enabled: boolean;
  accent: string;
  index: string;
  roles: TelcoRole[];
};

export const CARRIERS: TelcoCarrier[] = [
  {
    key: "tmobile",
    displayName: "T-Mobile",
    enabled: true,
    accent: "#E20074",
    index: "telco-tmobile-kb",
    roles: [
      {
        key: "noc",
        label: "NOC Engineer",
        agentId: "tmobile-noc-engineer",
        description: "Outages, 5G/core, coverage",
        icon: "network",
        starters: [
          {
            title: "5G coverage",
            question: "How do I verify 5G coverage for a business customer address?",
          },
          {
            title: "Network outage",
            question: "What steps should NOC take when investigating a regional LTE outage?",
          },
          {
            title: "Business escalation",
            question: "What escalation paths exist for T-Mobile business circuit issues?",
          },
        ],
      },
      {
        key: "care",
        label: "Customer Care",
        agentId: "tmobile-customer-care",
        description: "Plans, devices, support",
        icon: "headset",
        starters: [
          {
            title: "Unlimited plans",
            question: "What unlimited smartphone plans does T-Mobile offer?",
          },
          {
            title: "Password reset",
            question: "A customer forgot their T-Mobile ID password — what are the steps?",
          },
          {
            title: "Device setup",
            question: "How does a customer activate a new phone on an existing line?",
          },
        ],
      },
      {
        key: "billing",
        label: "Billing Ops",
        agentId: "tmobile-billing-ops",
        description: "Charges, disputes, payments",
        icon: "receipt",
        starters: [
          {
            title: "Line charges",
            question: "Where can customers view line-level charges on their bill?",
          },
          {
            title: "Autopay",
            question: "How does T-Mobile autopay work and where is it managed?",
          },
          {
            title: "Bill dispute",
            question: "What should billing ops verify first on an unexpected charge dispute?",
          },
        ],
      },
      {
        key: "retail",
        label: "Retail Sales",
        agentId: "tmobile-retail-sales",
        description: "Promotions, upgrades, offers",
        icon: "store",
        starters: [
          {
            title: "Family upgrade",
            question: "What should I highlight for a family plan upgrade in store?",
          },
          {
            title: "Trade-in",
            question: "What trade-in programs does T-Mobile offer for smartphone upgrades?",
          },
          {
            title: "Current deals",
            question: "What iPhone or Samsung promotions are available for new lines?",
          },
        ],
      },
    ],
  },
  {
    key: "att",
    displayName: "AT&T",
    enabled: false,
    accent: "#009FDB",
    index: "telco-att-kb",
    roles: [],
  },
  {
    key: "verizon",
    displayName: "Verizon",
    enabled: false,
    accent: "#CD040B",
    index: "telco-verizon-kb",
    roles: [],
  },
];

export function getCarrier(key: string): TelcoCarrier | undefined {
  return CARRIERS.find((c) => c.key === key);
}

export function getRole(carrierKey: string, roleKey: string): TelcoRole | undefined {
  return getCarrier(carrierKey)?.roles.find((r) => r.key === roleKey);
}
