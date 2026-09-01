import { RorizonDb, Submission } from './entities';

const ORG_ID = 'org-techcorp';
const ORG_NAME = 'TechCorp Industries';

const resourceCategories = [
  { id: 'cat-fuel', name: 'Combustion Fuel', description: 'Liquid operational combustion fuels (Diesel, Petrol, LPG).', active: true },
  { id: 'cat-gas', name: 'Natural & Process Gas', description: 'Gaseous utility resources (Natural Gas, Compressed Gas).', active: true },
];

const units = [
  { id: 'unit-liter', code: 'L', name: 'Liters', dimension: 'volume', active: true },
  { id: 'unit-gal', code: 'gal', name: 'Gallons', dimension: 'volume', active: true },
  { id: 'unit-kg', code: 'kg', name: 'Kilograms', dimension: 'mass', active: true },
  { id: 'unit-m3', code: 'm3', name: 'Cubic Meters', dimension: 'volume', active: true },
  { id: 'unit-kwh', code: 'kWh', name: 'Kilowatt-hours', dimension: 'energy', active: true },
  { id: 'unit-t', code: 't', name: 'Metric Tonnes', dimension: 'mass', active: true },
];

const resourceTypes = [
  { id: 'rt-diesel', categoryId: 'cat-fuel', name: 'Diesel', description: 'Commercial diesel fuel consumed by generators, equipment, and fleet vehicles.', defaultUnitId: 'unit-liter', active: true },
  { id: 'rt-lpg', categoryId: 'cat-fuel', name: 'LPG', description: 'Commercial LPG cylinders for heating and manufacturing processing.', defaultUnitId: 'unit-kg', active: true },
  { id: 'rt-gas', categoryId: 'cat-gas', name: 'Natural Gas', description: 'Mains natural gas for heating, boilers, and turbine systems.', defaultUnitId: 'unit-m3', active: true },
  { id: 'rt-petrol', categoryId: 'cat-fuel', name: 'Petrol', description: 'Commercial motor gasoline for fleet and operational transport.', defaultUnitId: 'unit-liter', active: true },
];

const resourceUnitCompatibilities = [
  { id: 'ruc-diesel-liter', resourceTypeId: 'rt-diesel', unitId: 'unit-liter', active: true },
  { id: 'ruc-diesel-gal', resourceTypeId: 'rt-diesel', unitId: 'unit-gal', active: true },
  { id: 'ruc-petrol-liter', resourceTypeId: 'rt-petrol', unitId: 'unit-liter', active: true },
  { id: 'ruc-petrol-gal', resourceTypeId: 'rt-petrol', unitId: 'unit-gal', active: true },
  { id: 'ruc-lpg-kg', resourceTypeId: 'rt-lpg', unitId: 'unit-kg', active: true },
  { id: 'ruc-lpg-liter', resourceTypeId: 'rt-lpg', unitId: 'unit-liter', active: true },
  { id: 'ruc-lpg-gal', resourceTypeId: 'rt-lpg', unitId: 'unit-gal', active: true },
  { id: 'ruc-gas-m3', resourceTypeId: 'rt-gas', unitId: 'unit-m3', active: true },
  { id: 'ruc-gas-kwh', resourceTypeId: 'rt-gas', unitId: 'unit-kwh', active: true },
];

const factorSources = [
  {
    id: 'efs-defra-2024',
    name: 'UK DESNZ / DEFRA Conversion Factors',
    publisher: 'UK Department for Energy Security and Net Zero',
    region: 'UK / Europe',
    datasetName: 'Government GHG Conversion Factors for Company Reporting 2024',
    datasetUrl: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024',
    acquisitionMethod: 'Published Dataset' as const,
    license: 'Open Government Licence v3.0',
    notes: 'Official UK government GHG protocol conversion factor baseline for commercial fuel and gas combustion.',
    active: true,
  },
  {
    id: 'efs-epa-2024',
    name: 'US EPA GHG Emission Factors Hub',
    publisher: 'US Environmental Protection Agency (EPA)',
    region: 'North America (US)',
    datasetName: 'EPA GHG Emission Factors Hub (2024 Edition)',
    datasetUrl: 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
    acquisitionMethod: 'Published Dataset' as const,
    license: 'US Federal Public Domain',
    notes: 'Official US EPA stationary fuel combustion metrics and mobile transport fuel emissions.',
    active: true,
  },
];

const factorVersions = [
  {
    id: 'fv-defra-2024-v1',
    sourceId: 'efs-defra-2024',
    name: 'DEFRA 2024 Edition v1.0',
    datasetName: 'Government GHG Conversion Factors 2024',
    datasetYear: '2024',
    importedAt: '2024-06-15T00:00:00.000Z',
    importedBy: 'Super Admin',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2030-12-31',
    status: 'Active' as const,
    locked: true,
  },
  {
    id: 'fv-epa-2024-v2',
    sourceId: 'efs-epa-2024',
    name: 'US EPA Hub 2024 v2.1',
    datasetName: 'EPA GHG Emission Factors Hub',
    datasetYear: '2024',
    importedAt: '2024-04-10T00:00:00.000Z',
    importedBy: 'Super Admin',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2030-12-31',
    status: 'Active' as const,
    locked: true,
  },
];

const emissionFactors = [
  // 1. Commercial Diesel (Scope 1 Direct Fuel Combustion - DEFRA & EPA)
  { id: 'ef-diesel-liter-defra', sourceId: 'efs-defra-2024', versionId: 'fv-defra-2024-v1', resourceTypeId: 'rt-diesel', unitId: 'unit-liter', factor: 2.6878, factorUnit: 'kgCO2e/L', geography: 'UK / Europe', scope: 'Scope 1', activityBoundary: 'Direct Stationary & Mobile Fuel Combustion', uncertainty: 'Low (±2%)', notes: 'DEFRA 2024 official 100% mineral diesel conversion factor rate.', validFrom: '2024-01-01', validTo: '2030-12-31', active: true },
  { id: 'ef-diesel-gal-epa', sourceId: 'efs-epa-2024', versionId: 'fv-epa-2024-v2', resourceTypeId: 'rt-diesel', unitId: 'unit-gal', factor: 10.2100, factorUnit: 'kgCO2e/gal', geography: 'US', scope: 'Scope 1', activityBoundary: 'Direct Transport & Generator Combustion', uncertainty: 'Low (±2%)', notes: 'US EPA Hub 2024 factor for commercial diesel in US gallons.', validFrom: '2024-01-01', validTo: '2030-12-31', active: true },

  // 2. Commercial LPG (Scope 1 Commercial Liquefied Petroleum Gas - DEFRA)
  { id: 'ef-lpg-kg-defra', sourceId: 'efs-defra-2024', versionId: 'fv-defra-2024-v1', resourceTypeId: 'rt-lpg', unitId: 'unit-kg', factor: 2.9830, factorUnit: 'kgCO2e/kg', geography: 'UK / Europe', scope: 'Scope 1', activityBoundary: 'Direct Stationary Heating & Industrial Processing', uncertainty: 'Low (±3%)', notes: 'DEFRA 2024 standard factor for commercial LPG cylinders.', validFrom: '2024-01-01', validTo: '2030-12-31', active: true },

  // 3. Natural Gas (Scope 1 Mains Utility Natural Gas - DEFRA)
  { id: 'ef-gas-m3-defra', sourceId: 'efs-defra-2024', versionId: 'fv-defra-2024-v1', resourceTypeId: 'rt-gas', unitId: 'unit-m3', factor: 2.0214, factorUnit: 'kgCO2e/m3', geography: 'UK / Europe', scope: 'Scope 1', activityBoundary: 'Direct Stationary Natural Gas Combustion', uncertainty: 'Low (±2%)', notes: 'DEFRA 2024 official gross CV factor for natural gas volume.', validFrom: '2024-01-01', validTo: '2030-12-31', active: true },

  // 4. Commercial Petrol (Scope 1 Motor Gasoline - DEFRA)
  { id: 'ef-petrol-liter-defra', sourceId: 'efs-defra-2024', versionId: 'fv-defra-2024-v1', resourceTypeId: 'rt-petrol', unitId: 'unit-liter', factor: 2.3144, factorUnit: 'kgCO2e/L', geography: 'UK / Europe', scope: 'Scope 1', activityBoundary: 'Direct Fleet Transport Combustion', uncertainty: 'Low (±2%)', notes: 'DEFRA 2024 official conversion factor for commercial petrol.', validFrom: '2024-01-01', validTo: '2030-12-31', active: true },
];

const resources = {
  ops: [
    { id: 'res-ops-diesel', name: 'Diesel', unit: 'Liters', target: 2900, threshold: 3200 },
    { id: 'res-ops-lpg', name: 'LPG', unit: 'Kg', target: 2300, threshold: 2600 },
  ],
  mfg: [
    { id: 'res-mfg-diesel', name: 'Diesel', unit: 'Liters', target: 7800, threshold: 8500 },
    { id: 'res-mfg-lpg', name: 'LPG', unit: 'Kg', target: 4300, threshold: 4700 },
  ],
  log: [
    { id: 'res-log-diesel', name: 'Diesel', unit: 'Liters', target: 5200, threshold: 5700 },
    { id: 'res-log-lpg', name: 'LPG', unit: 'Kg', target: 3100, threshold: 3400 },
  ],
  fac: [
    { id: 'res-fac-diesel', name: 'Diesel', unit: 'Liters', target: 1600, threshold: 1850 },
    { id: 'res-fac-lpg', name: 'LPG', unit: 'Kg', target: 1500, threshold: 1650 },
  ],
};

const submission = (
  id: string,
  departmentId: string,
  departmentName: string,
  managerName: string,
  managerUserId: number,
  period: string,
  submittedAt: string,
  diesel: number,
  lpg: number,
  status = 'Approved',
  score = '98%',
  deviationReason = '',
): Submission => {
  const totalConsumption = diesel + lpg;
  const totalCO2 = totalConsumption * 2.5;
  return {
    id,
    organizationId: ORG_ID,
    departmentId,
    departmentName,
    managerName,
    managerUserId,
    period,
    status,
    score,
    submittedAt,
    resources: [
      { type: 'Diesel', unit: 'Liters', qty: diesel },
      { type: 'LPG', unit: 'Kg', qty: lpg },
    ],
    totalConsumption,
    totalCO2,
    validation: {
      state: deviationReason ? 'threshold_breach' : 'valid',
      anomalyScore: deviationReason ? 82 : 4,
      deviationReason,
    },
    locked: true,
  };
};

export const seedDb = (): RorizonDb => {
  const submissions = [
    submission('sub-ops-2025-10', 'dept-ops', 'Operations', 'Sarah Miller', 103, '10 2025', 'Oct 31, 2025, 09:05 AM', 2500, 1900, 'Approved', '98%'),
    submission('sub-ops-2025-11', 'dept-ops', 'Operations', 'Sarah Miller', 103, '11 2025', 'Nov 30, 2025, 09:15 AM', 2620, 1980, 'Approved', '97%'),
    submission('sub-ops-2025-12', 'dept-ops', 'Operations', 'Sarah Miller', 103, '12 2025', 'Dec 31, 2025, 09:20 AM', 2780, 2100, 'Approved', '99%'),
    submission('sub-ops-2026-01', 'dept-ops', 'Operations', 'Sarah Miller', 103, '01 2026', 'Jan 31, 2026, 09:10 AM', 2700, 2050, 'Approved', '98%'),
    submission('sub-ops-2026-02', 'dept-ops', 'Operations', 'Sarah Miller', 103, '02 2026', 'Feb 28, 2026, 09:12 AM', 2650, 1980, 'Approved', '97%'),
    submission('sub-ops-2026-03', 'dept-ops', 'Operations', 'Sarah Miller', 103, '03 2026', 'Mar 31, 2026, 09:10 AM', 2850, 2150, 'Approved', '98%'),

    submission('sub-mfg-2025-10', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '10 2025', 'Oct 31, 2025, 10:30 AM', 6900, 3600, 'Approved', '96%'),
    submission('sub-mfg-2025-11', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '11 2025', 'Nov 30, 2025, 10:40 AM', 7200, 3850, 'Approved', '95%'),
    submission('sub-mfg-2025-12', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '12 2025', 'Dec 31, 2025, 10:35 AM', 7600, 4100, 'Approved', '94%'),
    submission('sub-mfg-2026-01', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '01 2026', 'Jan 31, 2026, 10:25 AM', 7750, 4200, 'Approved', '96%'),
    submission('sub-mfg-2026-02', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '02 2026', 'Feb 28, 2026, 10:22 AM', 7900, 4250, 'Approved', '93%'),
    submission('sub-mfg-2026-03', 'dept-mfg', 'Manufacturing', 'Robert Johnson', 105, '03 2026', 'Mar 31, 2026, 10:18 AM', 8850, 4800, 'Pending Review', '88%', 'Temporary generator use during scheduled grid maintenance.'),

    submission('sub-log-2025-10', 'dept-log', 'Logistics', 'Emily Davis', 106, '10 2025', 'Oct 31, 2025, 11:00 AM', 4550, 2600, 'Approved', '98%'),
    submission('sub-log-2025-11', 'dept-log', 'Logistics', 'Emily Davis', 106, '11 2025', 'Nov 30, 2025, 11:05 AM', 4800, 2820, 'Approved', '97%'),
    submission('sub-log-2025-12', 'dept-log', 'Logistics', 'Emily Davis', 106, '12 2025', 'Dec 31, 2025, 11:15 AM', 5050, 2960, 'Approved', '96%'),
    submission('sub-log-2026-01', 'dept-log', 'Logistics', 'Emily Davis', 106, '01 2026', 'Jan 31, 2026, 11:25 AM', 5100, 3000, 'Approved', '97%'),
    submission('sub-log-2026-02', 'dept-log', 'Logistics', 'Emily Davis', 106, '02 2026', 'Feb 28, 2026, 11:20 AM', 4980, 2920, 'Approved', '98%'),
    submission('sub-log-2026-03', 'dept-log', 'Logistics', 'Emily Davis', 106, '03 2026', 'Mar 31, 2026, 11:10 AM', 5350, 3150, 'Approved', '95%'),

    submission('sub-fac-2025-10', 'dept-fac', 'Facilities', 'David Wilson', 107, '10 2025', 'Oct 31, 2025, 08:40 AM', 1350, 1280, 'Approved', '99%'),
    submission('sub-fac-2025-11', 'dept-fac', 'Facilities', 'David Wilson', 107, '11 2025', 'Nov 30, 2025, 08:42 AM', 1420, 1320, 'Approved', '98%'),
    submission('sub-fac-2025-12', 'dept-fac', 'Facilities', 'David Wilson', 107, '12 2025', 'Dec 31, 2025, 08:45 AM', 1500, 1410, 'Approved', '97%'),
    submission('sub-fac-2026-01', 'dept-fac', 'Facilities', 'David Wilson', 107, '01 2026', 'Jan 31, 2026, 08:35 AM', 1480, 1390, 'Approved', '98%'),
    submission('sub-fac-2026-02', 'dept-fac', 'Facilities', 'David Wilson', 107, '02 2026', 'Feb 28, 2026, 08:32 AM', 1460, 1370, 'Approved', '99%'),
    submission('sub-fac-2026-03', 'dept-fac', 'Facilities', 'David Wilson', 107, '03 2026', 'Mar 31, 2026, 08:30 AM', 1550, 1450, 'Approved', '98%'),
  ];

  return {
    version: 7,
    systemMetrics: { uptime: '99.98%', latency: '156ms', serverLoad: '42%' },
    modules: [
      { id: 1, name: 'Authentication Service', status: 'Active', type: 'green' },
      { id: 2, name: 'RBAC Guard', status: 'Active', type: 'green' },
      { id: 3, name: 'In-Memory Repositories', status: 'Active', type: 'green' },
      { id: 4, name: 'Swagger Documentation', status: 'Active', type: 'green' },
    ],
    users: [
      { id: 101, name: 'System Admin', role: 'Super User', email: 'admin@platformops.com', password: 'Admin@123', department: 'Platform Governance', departmentId: '', assignedDepartmentIds: [], organizationId: '', phone: '5550198234', status: 'Active', lastLogin: '2026-04-01 08:30 AM' },
      { id: 102, name: 'John Anderson', role: 'COO', email: 'john.anderson@techcorp.com', password: 'Coo@12345', department: 'Executive Office', departmentId: 'dept-exec', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '5550198235', status: 'Active', lastLogin: '2026-03-31 04:15 PM' },
      { id: 103, name: 'Sarah Miller', role: 'Manager', email: 'sarah.miller@techcorp.com', password: 'Manager@123', department: 'Operations', departmentId: 'dept-ops', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '5550198236', status: 'Active', lastLogin: '2026-04-01 09:00 AM' },
      { id: 104, name: 'Michael Chen', role: 'Analyst', email: 'michael.chen@techcorp.com', password: 'Analyst@123', department: 'Multi-Department Review', departmentId: '', assignedDepartmentIds: ['dept-ops', 'dept-mfg', 'dept-log', 'dept-fac'], organizationId: ORG_ID, phone: '5550198237', status: 'Active', lastLogin: '2026-04-01 09:15 AM' },
      { id: 105, name: 'Robert Johnson', role: 'Manager', email: 'robert.johnson@techcorp.com', password: 'Default@123', department: 'Manufacturing', departmentId: 'dept-mfg', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '5550198238', status: 'Active', lastLogin: '2026-03-30 11:05 AM' },
      { id: 106, name: 'Emily Davis', role: 'Manager', email: 'emily.davis@techcorp.com', password: 'Default@123', department: 'Logistics', departmentId: 'dept-log', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '5550198239', status: 'Active', lastLogin: '2026-03-30 10:10 AM' },
      { id: 107, name: 'David Wilson', role: 'Manager', email: 'david.wilson@techcorp.com', password: 'Default@123', department: 'Facilities', departmentId: 'dept-fac', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '5550198240', status: 'Active', lastLogin: '2026-03-29 04:45 PM' },
    ],
    organizations: [
      { id: ORG_ID, name: ORG_NAME, industry: 'Industrial Manufacturing', cooName: 'John Anderson', cooUserId: 102, cooEmail: 'john.anderson@techcorp.com', departmentIds: ['dept-ops', 'dept-mfg', 'dept-log', 'dept-fac'], target: '28,700 Units', threshold: '31,600 Units', current: '30,150 Units', co2: '75,375', status: 'Needs Attention', statusType: 'amber', registrationStatus: 'Approved', registrationStatusType: 'green' },
    ],
    plans: [
      {
        id: 'plan-starter',
        name: 'Starter',
        description: 'Ideal for small organizations establishing baseline resource tracking, automated GHG calculations, and evidence document attachments.',
        priceMonthly: 1999,
        priceAnnual: 19990,
        annualDiscount: 17,
        currency: 'INR',
        maxUsers: 10,
        maxAdditionalUsers: 10,
        additionalUserPriceMonthly: 250,
        additionalUserPriceAnnual: 2500,
        maxDepartments: 3,
        maxAdditionalDepartments: 5,
        additionalDepartmentPriceMonthly: 1000,
        additionalDepartmentPriceAnnual: 10000,
        maxSubmissions: 500,
        maxReports: 10,
        maxStorage: 5,
        features: [
          'Resource/activity tracking',
          'Fuel/electricity tracking',
          'Automated emissions calculation',
          'Standard dashboards',
          'Basic targets and monitoring',
          'Evidence attachments',
          'Data validation',
          'Standard reporting',
          'Basic approval workflow',
          'Role-based access',
          'Audit history',
          'CSV/Excel import',
        ],
        supportLevel: 'Standard Business Hours',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'plan-pro',
        name: 'Professional',
        description: 'Designed for growing organizations requiring multi-department governance, custom conversion factors, correction workflows, and comparative analytics.',
        priceMonthly: 4999,
        priceAnnual: 49990,
        annualDiscount: 17,
        currency: 'INR',
        maxUsers: 50,
        maxAdditionalUsers: 50,
        additionalUserPriceMonthly: 200,
        additionalUserPriceAnnual: 2000,
        maxDepartments: 15,
        maxAdditionalDepartments: 15,
        additionalDepartmentPriceMonthly: 800,
        additionalDepartmentPriceAnnual: 8000,
        maxSubmissions: 2500,
        maxReports: 50,
        maxStorage: 25,
        features: [
          'Includes Starter capabilities',
          'Advanced dashboards',
          'Historical trend analysis',
          'Department-level analytics',
          'Advanced targets and thresholds',
          'Advanced approval workflows',
          'Correction/revision workflows',
          'Advanced reporting',
          'Comparative analysis',
          'Emission-factor management',
          'Factor versioning',
          'Audit-ready reporting',
          'Advanced RBAC',
        ],
        supportLevel: 'Priority 24/7 Support',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'plan-enterprise',
        name: 'Enterprise',
        description: 'Engineered for enterprise groups requiring multi-facility management, custom data lineage, audit-ready compliance reporting, and negotiated SLAs.',
        priceMonthly: 9999,
        priceAnnual: 99990,
        annualDiscount: 17,
        currency: 'INR',
        maxUsers: 150,
        maxAdditionalUsers: 150,
        additionalUserPriceMonthly: 150,
        additionalUserPriceAnnual: 1500,
        maxDepartments: 50,
        maxAdditionalDepartments: 50,
        additionalDepartmentPriceMonthly: 500,
        additionalDepartmentPriceAnnual: 5000,
        maxSubmissions: 10000,
        maxReports: 200,
        maxStorage: 100,
        features: [
          'Includes Professional capabilities',
          'Multi-facility management',
          'Advanced organizational hierarchy',
          'Enterprise RBAC',
          'Advanced approval pathways',
          'Custom reporting',
          'Advanced analytics',
          'Data lineage / calculation traceability',
          'Advanced audit controls',
          'Custom emission-factor configuration',
        ],
        supportLevel: 'Dedicated Key Account Manager',
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],

    addons: [
      {
        id: 'addon-analytics',
        name: 'Advanced Analytics Module',
        description: 'Deep-dive Scope 1-3 analytics, AI predictive forecasting, and custom metric benchmarks.',
        priceMonthly: 1500,
        priceAnnual: 15000,
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'addon-storage',
        name: 'Additional Storage (50 GB)',
        description: 'Expanded evidence document storage pool for high-volume audit documentation.',
        priceMonthly: 800,
        priceAnnual: 8000,
        additionalStorageGb: 50,
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'addon-supplychain',
        name: 'Supplier & Value-Chain Management',
        description: 'Vendor portal access, Scope 3 supply chain carbon tracking, and automated vendor surveys.',
        priceMonthly: 2500,
        priceAnnual: 25000,
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        id: 'addon-support',
        name: 'Premium 24/7 SLA Support',
        description: '1-hour critical response SLA, quarterly ESG advisory reviews, and dedicated agent support.',
        priceMonthly: 1200,
        priceAnnual: 12000,
        status: 'ACTIVE',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ],

    subscriptions: [
      {
        id: 'sub-org-techcorp',
        organizationId: ORG_ID,
        planId: 'plan-pro',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        addonIds: ['addon-analytics'],
        startDate: '2025-01-15',
        renewalDate: '2026-09-15',
        createdAt: '2025-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    ],


    departments: [
      { id: 'dept-ops', orgId: ORG_ID, orgName: ORG_NAME, name: 'Operations', manager: 'Sarah Miller', managerUserId: 103, target: '5,200 Units', threshold: '5,800 Units', current: '5,000 Units', co2: '12,500', status: 'Within Target', statusType: 'green', resourceTargets: resources.ops },
      { id: 'dept-mfg', orgId: ORG_ID, orgName: ORG_NAME, name: 'Manufacturing', manager: 'Robert Johnson', managerUserId: 105, target: '12,100 Units', threshold: '13,200 Units', current: '13,650 Units', co2: '34,125', status: 'Exceeded', statusType: 'red', resourceTargets: resources.mfg },
      { id: 'dept-log', orgId: ORG_ID, orgName: ORG_NAME, name: 'Logistics', manager: 'Emily Davis', managerUserId: 106, target: '8,300 Units', threshold: '9,100 Units', current: '8,500 Units', co2: '21,250', status: 'Approaching', statusType: 'amber', resourceTargets: resources.log },
      { id: 'dept-fac', orgId: ORG_ID, orgName: ORG_NAME, name: 'Facilities', manager: 'David Wilson', managerUserId: 107, target: '3,100 Units', threshold: '3,500 Units', current: '3,000 Units', co2: '7,500', status: 'Within Target', statusType: 'green', resourceTargets: resources.fac },
    ],
    submissions,
    resourceCategories,
    units,
    resourceTypes,
    resourceUnitCompatibilities,
    factorSources,
    factorVersions,
    emissionFactors,
    evidences: [],
    importBatches: [],
    importErrors: [],
    resourceRecords: [],
    impactCalculations: [],
    impactResults: [],
    managerSubmissions: [],
    submissionTracker: [],
    reports: [
      { id: 9001, title: 'Emissions Report - March 2026', period: 'March 2026', date: '4/5/2026', status: 'Pending Review', statusClass: 'amber', organizationId: ORG_ID, analystName: 'Michael Chen', analystUserId: 104, sourceSubmissionIds: ['sub-ops-2026-03', 'sub-mfg-2026-03', 'sub-log-2026-03', 'sub-fac-2026-03'], signature: { signedBy: 'Michael Chen', signedAt: '2026-04-05 20:00:00' }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: { intro: 'This report covers TechCorp Industries March 2026 organization-wide resource consumption.', consumption: 'Total March consumption was 30,150 units across Operations, Manufacturing, Logistics, and Facilities.', analysis: 'Manufacturing exceeded its threshold because of temporary generator usage; other departments stayed within configured limits.', comparisons: 'Compared with February, organization consumption increased because Manufacturing and Logistics had higher activity.', conclusions: 'Approve the report after reviewing the Manufacturing corrective action plan.' } },
      { id: 9002, title: 'Emissions Report - February 2026', period: 'February 2026', date: '3/5/2026', status: 'Approved', statusClass: 'green', organizationId: ORG_ID, analystName: 'Michael Chen', analystUserId: 104, sourceSubmissionIds: ['sub-ops-2026-02', 'sub-mfg-2026-02', 'sub-log-2026-02', 'sub-fac-2026-02'], signature: { signedBy: 'Michael Chen', signedAt: '2026-03-05 19:10:00' }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: { intro: 'February 2026 organization-wide emissions review for TechCorp Industries.', consumption: 'Total February consumption was 27,510 units.', analysis: 'All departments were within their approved target and threshold plan.', comparisons: 'February consumption was lower than January because Logistics activity reduced.', conclusions: 'Report approved by COO with continued monitoring requested for Manufacturing.' } },
    ],
    alerts: [
      { id: 'alt-001', type: 'Threshold Breach', severity: 'Critical', roleScope: ['Manager', 'COO'], organizationId: ORG_ID, departmentId: 'dept-mfg', departmentName: 'Manufacturing', status: 'Open', message: 'Manufacturing exceeded the March monthly threshold by 450 units.', deviationReason: 'Temporary generator use during scheduled grid maintenance.', createdAt: '2026-03-31 14:00:00', updatedAt: '2026-03-31 14:00:00' },
      { id: 'alt-002', type: 'Approaching Target', severity: 'Medium', roleScope: ['Manager', 'COO'], organizationId: ORG_ID, departmentId: 'dept-log', departmentName: 'Logistics', status: 'Open', message: 'Logistics reached 102% of its monthly target but remains below threshold.', deviationReason: 'Additional route coverage for March delivery backlog.', createdAt: '2026-03-30 19:50:00', updatedAt: '2026-03-30 19:50:00' },
    ],
    notifications: [
      { id: 1, role: 'Manager', title: 'Target Nearing', body: 'Logistics is above its March target and needs review.', timestamp: '2 hours ago', read: false, details: 'Consumption is 8,500 units against an 8,300 unit target.' },
      { id: 3, role: 'COO', title: 'Threshold Breach Raised', body: 'Manufacturing exceeded its March monthly threshold.', timestamp: '45 min ago', read: false, details: 'Review the Manufacturing corrective action before approving March reporting.' },
      { id: 4, role: 'Analyst', title: 'March Submissions Ready', body: 'All TechCorp Industries departments submitted March data.', timestamp: 'Just now', read: false, details: 'Four locked submissions are ready for report review.' },
      { id: 5, role: 'Super User', title: 'Organization Activity', body: 'TechCorp Industries completed its March workflow cycle.', timestamp: 'Today', read: false, details: 'Review platform-wide activity in the master audit trail.' },
    ],
    auditLogs: [
      { id: 1, timestamp: '2026-04-05 20:00:00', actor: 'Michael Chen (Analyst)', action: 'Generated March report for TechCorp Industries', status: 'Success', statusType: 'green' },
      { id: 2, timestamp: '2026-03-31 14:00:00', actor: 'System', action: 'Created Manufacturing threshold breach alert', status: 'Warning', statusType: 'amber' },
      { id: 3, timestamp: '2026-03-31 11:10:00', actor: 'Emily Davis (Manager)', action: 'Submitted Logistics March resource data', status: 'Success', statusType: 'green' },
      { id: 4, timestamp: '2026-03-31 10:18:00', actor: 'Robert Johnson (Manager)', action: 'Submitted Manufacturing March resource data', status: 'Warning', statusType: 'amber' },
      { id: 5, timestamp: '2026-03-31 09:10:00', actor: 'Sarah Miller (Manager)', action: 'Submitted Operations March resource data', status: 'Success', statusType: 'green' },
    ],
    cooKpis: { totalConsumption: '30,150 Units', totalEmissions: '75.4 t', emissionsTrend: '+9.6% vs February 2026', deptsOverTarget: 2, activeAlerts: 2, envStatus: 'Needs Attention', envStatusDesc: 'Manufacturing exceeded threshold; Logistics is over target' },
    chartData: { months: ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'], emissions: [61.7, 65.8, 70.0, 71.7, 68.8, 75.4] },
    managerChartData: { months: ['Oct 2025', 'Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026'], myDeptUsage: [4400, 4600, 4880, 4750, 4630, 5000], orgAvgUsage: [6170, 6578, 7000, 7170, 6878, 7538] },
    managerDailyUsage: {
      Diesel: [81, 83, 78, 80, 82, 85, 79, 84, 80, 81, 83, 82, 80, 86, 84, 82, 81, 83, 85, 80, 79, 81, 84, 82, 83, 80, 81, 82, 84, 80, 83],
      LPG: [48, 51, 49, 50, 48, 52, 51, 47, 49, 50, 52, 48, 51, 49, 50, 52, 48, 49, 51, 50, 47, 49, 52, 51, 50, 48, 49, 51, 50, 52, 49],
    },
    globalSettings: {
      lockout: '5',
      session: '240',
      otpExp: '15',
      maxUsers: '100',
      flagMain: false,
      flagEmail: true,
      flag2fa: false,
    },
  };
};
