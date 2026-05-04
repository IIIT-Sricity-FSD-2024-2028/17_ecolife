import { RorizonDb, Submission } from './entities';

const ORG_ID = 'org-tc';
const ORG_NAME = 'TC Works';

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
    submission('sub-ops-2025-10', 'dept-ops', 'Operations', 'Asha', 103, '10 2025', 'Oct 31, 2025, 09:05 AM', 2500, 1900, 'Approved', '98%'),
    submission('sub-ops-2025-11', 'dept-ops', 'Operations', 'Asha', 103, '11 2025', 'Nov 30, 2025, 09:15 AM', 2620, 1980, 'Approved', '97%'),
    submission('sub-ops-2025-12', 'dept-ops', 'Operations', 'Asha', 103, '12 2025', 'Dec 31, 2025, 09:20 AM', 2780, 2100, 'Approved', '99%'),
    submission('sub-ops-2026-01', 'dept-ops', 'Operations', 'Asha', 103, '01 2026', 'Jan 31, 2026, 09:10 AM', 2700, 2050, 'Approved', '98%'),
    submission('sub-ops-2026-02', 'dept-ops', 'Operations', 'Asha', 103, '02 2026', 'Feb 28, 2026, 09:12 AM', 2650, 1980, 'Approved', '97%'),
    submission('sub-ops-2026-03', 'dept-ops', 'Operations', 'Asha', 103, '03 2026', 'Mar 31, 2026, 09:10 AM', 2850, 2150, 'Approved', '98%'),

    submission('sub-mfg-2025-10', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '10 2025', 'Oct 31, 2025, 10:30 AM', 6900, 3600, 'Approved', '96%'),
    submission('sub-mfg-2025-11', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '11 2025', 'Nov 30, 2025, 10:40 AM', 7200, 3850, 'Approved', '95%'),
    submission('sub-mfg-2025-12', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '12 2025', 'Dec 31, 2025, 10:35 AM', 7600, 4100, 'Approved', '94%'),
    submission('sub-mfg-2026-01', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '01 2026', 'Jan 31, 2026, 10:25 AM', 7750, 4200, 'Approved', '96%'),
    submission('sub-mfg-2026-02', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '02 2026', 'Feb 28, 2026, 10:22 AM', 7900, 4250, 'Approved', '93%'),
    submission('sub-mfg-2026-03', 'dept-mfg', 'Manufacturing', 'Vikram', 105, '03 2026', 'Mar 31, 2026, 10:18 AM', 8850, 4800, 'Pending Review', '88%', 'Temporary generator use during scheduled grid maintenance.'),

    submission('sub-log-2025-10', 'dept-log', 'Logistics', 'Neha', 106, '10 2025', 'Oct 31, 2025, 11:00 AM', 4550, 2600, 'Approved', '98%'),
    submission('sub-log-2025-11', 'dept-log', 'Logistics', 'Neha', 106, '11 2025', 'Nov 30, 2025, 11:05 AM', 4800, 2820, 'Approved', '97%'),
    submission('sub-log-2025-12', 'dept-log', 'Logistics', 'Neha', 106, '12 2025', 'Dec 31, 2025, 11:15 AM', 5050, 2960, 'Approved', '96%'),
    submission('sub-log-2026-01', 'dept-log', 'Logistics', 'Neha', 106, '01 2026', 'Jan 31, 2026, 11:25 AM', 5100, 3000, 'Approved', '97%'),
    submission('sub-log-2026-02', 'dept-log', 'Logistics', 'Neha', 106, '02 2026', 'Feb 28, 2026, 11:20 AM', 4980, 2920, 'Approved', '98%'),
    submission('sub-log-2026-03', 'dept-log', 'Logistics', 'Neha', 106, '03 2026', 'Mar 31, 2026, 11:10 AM', 5350, 3150, 'Approved', '95%'),

    submission('sub-fac-2025-10', 'dept-fac', 'Facilities', 'Karan', 107, '10 2025', 'Oct 31, 2025, 08:40 AM', 1350, 1280, 'Approved', '99%'),
    submission('sub-fac-2025-11', 'dept-fac', 'Facilities', 'Karan', 107, '11 2025', 'Nov 30, 2025, 08:42 AM', 1420, 1320, 'Approved', '98%'),
    submission('sub-fac-2025-12', 'dept-fac', 'Facilities', 'Karan', 107, '12 2025', 'Dec 31, 2025, 08:45 AM', 1500, 1410, 'Approved', '97%'),
    submission('sub-fac-2026-01', 'dept-fac', 'Facilities', 'Karan', 107, '01 2026', 'Jan 31, 2026, 08:35 AM', 1480, 1390, 'Approved', '98%'),
    submission('sub-fac-2026-02', 'dept-fac', 'Facilities', 'Karan', 107, '02 2026', 'Feb 28, 2026, 08:32 AM', 1460, 1370, 'Approved', '99%'),
    submission('sub-fac-2026-03', 'dept-fac', 'Facilities', 'Karan', 107, '03 2026', 'Mar 31, 2026, 08:30 AM', 1550, 1450, 'Approved', '98%'),
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
      { id: 101, name: 'Admin', role: 'Super User', email: 'admin@rorizon.com', password: 'Admin@123', department: 'Platform Governance', departmentId: '', assignedDepartmentIds: [], organizationId: '', phone: '9876543210', status: 'Active', lastLogin: '2026-04-01 08:30 AM' },
      { id: 102, name: 'Rajesh', role: 'COO', email: 'rajesh@tc.com', password: 'Coo@12345', department: 'Executive Office', departmentId: 'dept-exec', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '9876543211', status: 'Active', lastLogin: '2026-03-31 04:15 PM' },
      { id: 103, name: 'Asha', role: 'Manager', email: 'asha@tc.com', password: 'Manager@123', department: 'Operations', departmentId: 'dept-ops', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '9876543212', status: 'Active', lastLogin: '2026-04-01 09:00 AM' },
      { id: 104, name: 'Meera', role: 'Analyst', email: 'meera@tc.com', password: 'Analyst@123', department: 'Multi-Department Review', departmentId: '', assignedDepartmentIds: ['dept-ops', 'dept-mfg', 'dept-log', 'dept-fac'], organizationId: ORG_ID, phone: '9876543213', status: 'Active', lastLogin: '2026-04-01 09:15 AM' },
      { id: 105, name: 'Vikram', role: 'Manager', email: 'vikram@tc.com', password: 'Manager@123', department: 'Manufacturing', departmentId: 'dept-mfg', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '9876543214', status: 'Active', lastLogin: '2026-03-30 11:05 AM' },
      { id: 106, name: 'Neha', role: 'Manager', email: 'neha@tc.com', password: 'Manager@123', department: 'Logistics', departmentId: 'dept-log', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '9876543215', status: 'Active', lastLogin: '2026-03-30 10:10 AM' },
      { id: 107, name: 'Karan', role: 'Manager', email: 'karan@tc.com', password: 'Manager@123', department: 'Facilities', departmentId: 'dept-fac', assignedDepartmentIds: [], organizationId: ORG_ID, phone: '9876543216', status: 'Active', lastLogin: '2026-03-29 04:45 PM' },
    ],
    organizations: [
      { id: ORG_ID, name: ORG_NAME, industry: 'Manufacturing', cooName: 'Rajesh', cooUserId: 102, cooEmail: 'rajesh@tc.com', departmentIds: ['dept-ops', 'dept-mfg', 'dept-log', 'dept-fac'], target: '28,700 Units', threshold: '31,600 Units', current: '30,150 Units', co2: '75,375', status: 'Needs Attention', statusType: 'amber', registrationStatus: 'Approved', registrationStatusType: 'green' },
    ],
    departments: [
      { id: 'dept-ops', orgId: ORG_ID, orgName: ORG_NAME, name: 'Operations', manager: 'Asha', managerUserId: 103, target: '5,200 Units', threshold: '5,800 Units', current: '5,000 Units', co2: '12,500', status: 'Within Target', statusType: 'green', resourceTargets: resources.ops },
      { id: 'dept-mfg', orgId: ORG_ID, orgName: ORG_NAME, name: 'Manufacturing', manager: 'Vikram', managerUserId: 105, target: '12,100 Units', threshold: '13,200 Units', current: '13,650 Units', co2: '34,125', status: 'Exceeded', statusType: 'red', resourceTargets: resources.mfg },
      { id: 'dept-log', orgId: ORG_ID, orgName: ORG_NAME, name: 'Logistics', manager: 'Neha', managerUserId: 106, target: '8,300 Units', threshold: '9,100 Units', current: '8,500 Units', co2: '21,250', status: 'Approaching', statusType: 'amber', resourceTargets: resources.log },
      { id: 'dept-fac', orgId: ORG_ID, orgName: ORG_NAME, name: 'Facilities', manager: 'Karan', managerUserId: 107, target: '3,100 Units', threshold: '3,500 Units', current: '3,000 Units', co2: '7,500', status: 'Within Target', statusType: 'green', resourceTargets: resources.fac },
    ],
    submissions,
    managerSubmissions: [],
    submissionTracker: [],
    reports: [
      { id: 9001, title: 'Emissions Report - March 2026', period: 'March 2026', date: '4/5/2026', status: 'Pending Review', statusClass: 'amber', organizationId: ORG_ID, analystName: 'Meera', analystUserId: 104, sourceSubmissionIds: ['sub-ops-2026-03', 'sub-mfg-2026-03', 'sub-log-2026-03', 'sub-fac-2026-03'], signature: { signedBy: 'Meera', signedAt: '2026-04-05 20:00:00' }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: { intro: 'This report covers TC Works March 2026 organization-wide resource consumption.', consumption: 'Total March consumption was 30,150 units across Operations, Manufacturing, Logistics, and Facilities.', analysis: 'Manufacturing exceeded its threshold because of temporary generator usage; Operations and Facilities stayed within limits while Logistics stayed above target but below threshold.', comparisons: 'Compared with February, organization consumption increased because Manufacturing and Logistics had higher activity.', conclusions: 'Approve the report after reviewing the Manufacturing corrective action plan and tracking Logistics usage in April.' } },
      { id: 9002, title: 'Emissions Report - February 2026', period: 'February 2026', date: '3/5/2026', status: 'Approved', statusClass: 'green', organizationId: ORG_ID, analystName: 'Meera', analystUserId: 104, sourceSubmissionIds: ['sub-ops-2026-02', 'sub-mfg-2026-02', 'sub-log-2026-02', 'sub-fac-2026-02'], signature: { signedBy: 'Meera', signedAt: '2026-03-05 19:10:00' }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: { intro: 'February 2026 organization-wide emissions review for TC Works.', consumption: 'Total February consumption was 27,510 units.', analysis: 'All departments were within their approved target and threshold plan.', comparisons: 'February consumption was lower than January because Logistics activity reduced.', conclusions: 'Report approved by COO with continued monitoring requested for Manufacturing.' } },
    ],
    alerts: [
      { id: 'alt-001', type: 'Threshold Breach', severity: 'Critical', roleScope: ['Manager', 'COO'], organizationId: ORG_ID, departmentId: 'dept-mfg', departmentName: 'Manufacturing', status: 'Open', message: 'Manufacturing exceeded the March monthly threshold by 450 units.', deviationReason: 'Temporary generator use during scheduled grid maintenance.', createdAt: '2026-03-31 14:00:00', updatedAt: '2026-03-31 14:00:00' },
      { id: 'alt-002', type: 'Approaching Target', severity: 'Medium', roleScope: ['Manager', 'COO'], organizationId: ORG_ID, departmentId: 'dept-log', departmentName: 'Logistics', status: 'Open', message: 'Logistics reached 102% of its monthly target but remains below threshold.', deviationReason: 'Additional route coverage for March delivery backlog.', createdAt: '2026-03-30 19:50:00', updatedAt: '2026-03-30 19:50:00' },
    ],
    notifications: [
      { id: 1, role: 'Manager', userId: 106, organizationId: ORG_ID, departmentId: 'dept-log', title: 'Target Nearing', body: 'Logistics is above its March target and needs review.', timestamp: '2 hours ago', read: false, details: 'Consumption is 8,500 units against an 8,300 unit target.' },
      { id: 3, role: 'COO', userId: 102, organizationId: ORG_ID, departmentId: 'dept-mfg', title: 'Threshold Breach Raised', body: 'Manufacturing exceeded its March monthly threshold.', timestamp: '45 min ago', read: false, details: 'Review the Manufacturing corrective action before approving March reporting.' },
      { id: 4, role: 'Analyst', userId: 104, organizationId: ORG_ID, title: 'March Submissions Ready', body: 'All TC Works departments submitted March data.', timestamp: 'Just now', read: false, details: 'Four locked submissions are ready for report review.' },
      { id: 5, role: 'Super User', organizationId: ORG_ID, title: 'Organization Activity', body: 'TC Works completed its March workflow cycle.', timestamp: 'Today', read: false, details: 'Review platform-wide activity in the master audit trail.' },
    ],
    auditLogs: [
      { id: 1, timestamp: '2026-04-05 20:00:00', actor: 'Meera (Analyst)', action: 'Generated March report for TC Works', status: 'Success', statusType: 'green' },
      { id: 2, timestamp: '2026-03-31 14:00:00', actor: 'System', action: 'Created Manufacturing threshold breach alert', status: 'Warning', statusType: 'amber' },
      { id: 3, timestamp: '2026-03-31 11:10:00', actor: 'Neha (Manager)', action: 'Submitted Logistics March resource data', status: 'Success', statusType: 'green' },
      { id: 4, timestamp: '2026-03-31 10:18:00', actor: 'Vikram (Manager)', action: 'Submitted Manufacturing March resource data', status: 'Warning', statusType: 'amber' },
      { id: 5, timestamp: '2026-03-31 09:10:00', actor: 'Asha (Manager)', action: 'Submitted Operations March resource data', status: 'Success', statusType: 'green' },
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
