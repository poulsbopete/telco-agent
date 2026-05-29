export type TelcoRole = {
  key: string;
  label: string;
  agentId: string;
  description: string;
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
      },
      {
        key: "care",
        label: "Customer Care",
        agentId: "tmobile-customer-care",
        description: "Plans, devices, troubleshooting",
      },
      {
        key: "billing",
        label: "Billing Ops",
        agentId: "tmobile-billing-ops",
        description: "Charges, disputes, payments",
      },
      {
        key: "retail",
        label: "Retail Sales",
        agentId: "tmobile-retail-sales",
        description: "Promotions, upgrades, offers",
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

export const STARTER_PROMPTS: Record<string, { title: string; question: string }[]> = {
  tmobile: [
    {
      title: "Coverage check",
      question: "How can I verify 5G coverage for a business customer address?",
    },
    {
      title: "Password reset",
      question: "A customer forgot their T-Mobile ID password — what are the steps?",
    },
    {
      title: "Bill explanation",
      question: "Where can customers view line-level charges on their bill?",
    },
    {
      title: "Unlimited plans",
      question: "What unlimited smartphone plans does T-Mobile offer?",
    },
  ],
};

export function getCarrier(key: string): TelcoCarrier | undefined {
  return CARRIERS.find((c) => c.key === key);
}

export function getRole(carrierKey: string, roleKey: string): TelcoRole | undefined {
  return getCarrier(carrierKey)?.roles.find((r) => r.key === roleKey);
}
