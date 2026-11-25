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
  ],
  SUSTAINABILITY_LEAD: [
  ],
  FINANCE_MANAGER: [
  ],
  EXECUTIVE_APPROVER: [
  ],
  INTERNAL_AUDITOR: [
  ],
  EXTERNAL_VERIFIER: [
  ],
  ORG_ADMIN: [
    { path: '/admin/team', label: 'Team and access', icon: Users },
    { path: '/admin/security', label: 'Security and API keys', icon: KeyRound },
    { path: '/admin/settings', label: 'Company settings', icon: Settings },
  ],
  PLATFORM_ADMIN: [
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
