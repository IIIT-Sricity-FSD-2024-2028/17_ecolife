import {
  LayoutDashboard,
  Flame,
  Droplets,
  Wind,
  Building2,
  CheckCircle2,
  Target,
  Truck,
  Leaf,
  FileText,
  Landmark,
  FileSpreadsheet,
  Zap,
  Receipt,
  ShieldCheck,
  RefreshCw,
  ClipboardCheck,
  History,
  Users,
  KeyRound,
  Settings,
  Globe,
  FlaskConical,
  FolderOpen,
  ListChecks,
  Lock,
  ChartNoAxesCombined,
  ChartPie,
  ListTodo
} from 'lucide-react';

export const ACTOR_LABELS = {
  PLANT_MANAGER: 'Plant manager',
  SUSTAINABILITY_LEAD: 'Sustainability lead',
  FINANCE_MANAGER: 'Finance manager',
  EXECUTIVE_APPROVER: 'Executive approver',
  INTERNAL_AUDITOR: 'Internal auditor',
  EXTERNAL_VERIFIER: 'External verifier',
  ORG_ADMIN: 'Administrator',
  PLATFORM_ADMIN: 'Platform administrator'
};

// group = heading in the sidebar. Labels use the words people use at work, not system terms.
export const ACTOR_NAV = {
  PLANT_MANAGER: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/plant/dashboard', label: 'To do', icon: ListTodo },
    { path: '/plant/fuels-energy', label: 'Energy and fuel', modules: ['FUELS', 'ELECTRICITY'], icon: Flame, group: 'Monthly data' },
    { path: '/plant/water-waste', label: 'Water and waste', modules: ['WATER', 'WASTE'], icon: Droplets, group: 'Monthly data' },
    { path: '/plant/air-materials', label: 'Air, materials, cooling', modules: ['AIR', 'MATERIALS', 'REFRIGERANTS'], icon: Wind, group: 'Monthly data' },
    { path: '/documents', label: 'Documents', icon: FolderOpen, group: 'Records' }
  ],
  SUSTAINABILITY_LEAD: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/sustainability/dashboard', label: 'To do', icon: ListTodo },
    { path: '/sustainability/this-month', label: 'This month', icon: ListChecks, group: 'Every month' },
    { path: '/plant/fuels-energy', label: 'Energy and fuel', modules: ['FUELS', 'ELECTRICITY'], icon: Flame, group: 'Every month' },
    { path: '/sustainability/review', label: 'Review', icon: CheckCircle2, group: 'Every month' },
    { path: '/sustainability/close', label: 'Month-end close', icon: Lock, group: 'Every month' },
    { path: '/sustainability/explorer', label: 'Emissions explorer', icon: ChartNoAxesCombined, group: 'Explore' },
    { path: '/sustainability/targets', label: 'Targets and projects', modules: ['TARGETS'], icon: Target, group: 'Plan' },
    { path: '/sustainability/value-chain', label: 'Suppliers', modules: ['VALUE_CHAIN'], icon: Truck, group: 'Plan' },
    { path: '/sustainability/green-economy', label: 'Carbon credits', modules: ['GREEN_ECONOMY'], icon: Leaf, group: 'Plan' },
    { path: '/sustainability/boundary', label: 'Sites and emission factors', icon: Building2, group: 'Set up' },
    { path: '/documents', label: 'Documents', icon: FolderOpen, group: 'Set up' },
    { path: '/verifier/room', label: 'Verification', modules: ['ASSURANCE'], icon: ShieldCheck, group: 'Report' },
    { path: '/sustainability/reports', label: 'Reports', icon: FileText, group: 'Report' }
  ],
  FINANCE_MANAGER: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/finance/metrics', label: 'Financial figures', icon: Landmark },
    { path: '/finance/tally-import', label: 'Import data', icon: FileSpreadsheet },
    { path: '/finance/scope2-instruments', label: 'Green power certificates', icon: Zap },
    { path: '/finance/billing', label: 'Plan and invoices', icon: Receipt },
    { path: '/documents', label: 'Documents', icon: FolderOpen }
  ],
  EXECUTIVE_APPROVER: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/sustainability/dashboard', label: 'To do', icon: ListTodo },
    { path: '/sustainability/explorer', label: 'Emissions explorer', icon: ChartNoAxesCombined },
    { path: '/executive/sign-off', label: 'Sign off the year', icon: ShieldCheck },
    { path: '/executive/restatements', label: 'Corrections to past figures', icon: RefreshCw },
    { path: '/verifier/room', label: 'Verification', modules: ['ASSURANCE'], icon: ShieldCheck, group: 'Report' },
    { path: '/sustainability/reports', label: 'Reports', icon: FileText }
  ],
  INTERNAL_AUDITOR: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/internal-audit/findings', label: 'Audit findings', icon: ClipboardCheck },
    { path: '/internal-audit/trail', label: 'Activity log', icon: History },
    { path: '/documents', label: 'Documents', icon: FolderOpen }
  ],
  EXTERNAL_VERIFIER: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/verifier/room', label: 'Verification', icon: ShieldCheck },
    { path: '/internal-audit/trail', label: 'Activity log', icon: History },
    { path: '/documents', label: 'Documents', icon: FolderOpen }
  ],
  ORG_ADMIN: [
    { path: '/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/admin/team', label: 'Team and access', icon: Users },
    { path: '/admin/security', label: 'Security and API keys', icon: KeyRound },
    { path: '/admin/settings', label: 'Company settings', icon: Settings },
    { path: '/finance/billing', label: 'Plan and invoices', icon: Receipt }
  ],
  PLATFORM_ADMIN: [
    { path: '/platform/dashboard', label: 'Dashboard', icon: ChartPie },
    { path: '/platform/overview', label: 'To do', icon: ListTodo },
    { path: '/platform/organizations', label: 'Companies', icon: Globe },
    { path: '/platform/users', label: 'Find a person', icon: Users },
    { path: '/platform/invoices', label: 'Invoices', icon: Receipt },
    { path: '/platform/factors-gwp', label: 'Emission factor library', icon: FlaskConical },
    { path: '/platform/activity', label: 'Platform activity', icon: History }
  ]
};

export function pageTitleFor(path) {
  for (const items of Object.values(ACTOR_NAV)) {
    const hit = items.find((i) => i.path === path);
    if (hit) return hit.label;
  }
  const extra = { '/profile': 'My account', '/notifications': 'Notifications', '/help': 'Help', '/documents': 'Documents', '/search': 'Search results' };
  if (extra[path]) return extra[path];
  if (path.startsWith('/platform/organizations/')) return 'Company';
  return '';
}

export function getNavItemsForUser(user) {
  if (!user) return [];
  if (user.isPlatformAdmin) return ACTOR_NAV.PLATFORM_ADMIN;
  const seen = new Set();
  const items = [];
  const enabled = user.organization?.enabledModules;
  // a menu item tied to tracking areas shows only when at least one of those areas is switched on
  const visible = (item) => !item.modules || !Array.isArray(enabled) || item.modules.some((m) => enabled.includes(m));
  for (const role of user.roles || []) {
    for (const item of ACTOR_NAV[role] || []) {
      if (!seen.has(item.path) && visible(item)) {
        seen.add(item.path);
        items.push(item);
      }
    }
  }
  return items;
}

export function getDefaultPathForUser(user) {
  const items = getNavItemsForUser(user);
  return items[0]?.path || '/profile';
}
