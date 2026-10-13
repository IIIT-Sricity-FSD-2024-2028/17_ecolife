/**
 * Seeds Tropos with data needed to demo it immediately:
 * - A first Super Admin (admin accounts can't self-register)
 * - The standard resource type catalog with GHG-Protocol-aligned factors
 * - A starter set of subscription plans
 * - A demo organization with one user per org role
 * - Realistic demo activity for that organization (see seed-demo-data.ts)
 *
 * Run with: npm run seed
 * Safe to re-run — every insert checks for an existing row first.
 */
import * as bcrypt from 'bcryptjs';
import { loadStore, saveStore } from './persistence';
import { v4 as uuidv4 } from 'uuid';
import { seedDemoActivity } from './seed-demo-data';

const SALT_ROUNDS = 10;
const now = () => new Date().toISOString();

async function main() {
  const store = loadStore();
  console.log('Seeding Tropos...\n');

  // 1. Super Admin
  if (!store.platformAdmins.some((a) => a.email === 'superadmin@tropos.dev')) {
    store.platformAdmins.push({
      id: uuidv4(),
      email: 'superadmin@tropos.dev',
      passwordHash: await bcrypt.hash('SuperAdmin1!', SALT_ROUNDS),
      fullName: 'Platform Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      invitedById: null,
      createdAt: now(),
      updatedAt: now(),
      lastLogin: null,
    });
    console.log('Created Super Admin: superadmin@tropos.dev / SuperAdmin1!');
  } else {
    console.log('Super Admin already exists, skipping.');
  }

  // 2. Emission factor source
  let source = store.emissionFactorSources.find((s) => s.name === 'EPA 2026 GHG Emission Factors');
  if (!source) {
    source = {
      id: uuidv4(),
      name: 'EPA 2026 GHG Emission Factors',
      publisher: 'U.S. Environmental Protection Agency',
      referenceUrl: 'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
      createdAt: now(),
    };
    store.emissionFactorSources.push(source);
  }
  console.log(`Emission factor source: ${source.name}`);

  // 3. Resource types + factors
  const resourceTypes = [
    {
      name: 'Diesel Fuel',
      category: 'FUEL' as const,
      evidenceThreshold: 500,
      units: [{ unit: 'liters', isDefault: true }, { unit: 'gallons', isDefault: false }],
      factors: [{ gas: 'CO2', factorValue: 2.68, gwp: 1, unit: 'liters' }],
    },
    {
      name: 'Natural Gas',
      category: 'FUEL' as const,
      evidenceThreshold: 1000,
      units: [{ unit: 'm3', isDefault: true }, { unit: 'therms', isDefault: false }],
      factors: [{ gas: 'CO2', factorValue: 1.885, gwp: 1, unit: 'm3' }],
    },
    {
      name: 'Grid Electricity',
      category: 'ELECTRICITY' as const,
      evidenceThreshold: 5000,
      units: [{ unit: 'kWh', isDefault: true }],
      factors: [{ gas: 'CO2', factorValue: 0.417, gwp: 1, unit: 'kWh' }],
    },
    {
      name: 'Municipal Water',
      category: 'WATER' as const,
      evidenceThreshold: 10000,
      units: [{ unit: 'm3', isDefault: true }, { unit: 'liters', isDefault: false }],
      factors: [{ gas: 'CO2', factorValue: 0.149, gwp: 1, unit: 'm3' }],
    },
    {
      name: 'General Waste (Landfill)',
      category: 'WASTE' as const,
      evidenceThreshold: 1000,
      units: [{ unit: 'kg', isDefault: true }, { unit: 'tonnes', isDefault: false }],
      factors: [{ gas: 'CH4', factorValue: 0.5, gwp: 28, unit: 'kg' }],
    },
  ];

  for (const rt of resourceTypes) {
    if (store.resourceTypes.some((t) => t.name === rt.name)) {
      console.log(`Resource type already exists: ${rt.name}, skipping.`);
      continue;
    }
    const type = {
      id: uuidv4(),
      name: rt.name,
      category: rt.category,
      description: null,
      evidenceThreshold: rt.evidenceThreshold,
      units: rt.units,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    store.resourceTypes.push(type);

    for (const f of rt.factors) {
      store.emissionFactorVersions.push({
        id: uuidv4(),
        resourceTypeId: type.id,
        sourceId: source.id,
        organizationId: null,
        gas: f.gas,
        factorValue: f.factorValue,
        gwp: f.gwp,
        unit: f.unit,
        effectiveFrom: '2025-01-01T00:00:00.000Z',
        effectiveTo: null,
        isLocked: false,
        createdById: null,
        createdAt: now(),
      });
    }
    console.log(`Created resource type: ${rt.name}`);
  }

  // 4. Plans
  const plans = [
    { name: 'Starter', description: 'For small teams starting to track emissions in one or two departments.', maxDepartments: 3, maxUsers: 10, maxResourceTypes: 5, reportFrequency: 'monthly', priceMonthly: 0, priceAnnual: 0 },
    { name: 'Growth', description: 'For growing organizations with several departments and regular reporting.', maxDepartments: 15, maxUsers: 50, maxResourceTypes: 20, reportFrequency: 'monthly', priceMonthly: 199, priceAnnual: 1990 },
    { name: 'Enterprise', description: 'For large organizations that need unlimited scale and weekly reporting.', maxDepartments: 999, maxUsers: 999, maxResourceTypes: 999, reportFrequency: 'weekly', priceMonthly: 999, priceAnnual: 9990 },
  ];
  for (const p of plans) {
    const existingPlan = store.plans.find((existing) => existing.name === p.name);
    if (existingPlan) {
      if (!existingPlan.description) existingPlan.description = p.description;
      console.log(`Plan already exists: ${p.name}, skipping.`);
      continue;
    }
    store.plans.push({ id: uuidv4(), ...p, isActive: true });
    console.log(`Created plan: ${p.name}`);
  }

  // 5. Demo organization with one user per role
  const demoSlug = 'demo-organization';
  if (!store.organizations.some((o) => o.slug === demoSlug)) {
    const org = {
      id: uuidv4(),
      name: 'Demo Organization',
      slug: demoSlug,
      status: 'ACTIVE' as const,
      maintenanceMode: false,
      sessionTimeoutOverrideMin: null,
      carbonPricePerTon: 25,
      currency: 'USD',
      baselineYear: null,
      createdAt: now(),
      updatedAt: now(),
    };
    store.organizations.push(org);

    const growthPlan = store.plans.find((p) => p.name === 'Growth')!;
    store.subscriptions.push({
      id: uuidv4(),
      organizationId: org.id,
      planId: growthPlan.id,
      status: 'ACTIVE',
      cycle: 'MONTHLY',
      startDate: now(),
      renewalDate: null,
      cancelledAt: null,
      updatedAt: now(),
    });

    const dept = {
      id: uuidv4(),
      organizationId: org.id,
      name: 'Main Facility',
      description: 'Primary operations site',
      createdAt: now(),
      updatedAt: now(),
    };
    store.departments.push(dept);

    const demoUsers: { email: string; fullName: string; role: any; isOwner: boolean; departmentId: string | null }[] = [
      { email: 'owner@demo.tropos.dev', fullName: 'Olivia Owner', role: 'ORG_ADMIN', isOwner: true, departmentId: null },
      { email: 'contributor@demo.tropos.dev', fullName: 'Carl Contributor', role: 'CONTRIBUTOR', isOwner: false, departmentId: dept.id },
      { email: 'reviewer@demo.tropos.dev', fullName: 'Rita Reviewer', role: 'REVIEWER', isOwner: false, departmentId: null },
      { email: 'executive@demo.tropos.dev', fullName: 'Eric Executive', role: 'EXECUTIVE', isOwner: false, departmentId: null },
    ];

    for (const u of demoUsers) {
      store.orgUsers.push({
        id: uuidv4(),
        organizationId: org.id,
        email: u.email,
        passwordHash: await bcrypt.hash('DemoPass1!', SALT_ROUNDS),
        fullName: u.fullName,
        role: u.role,
        isOwner: u.isOwner,
        isActive: true,
        departmentId: u.departmentId,
        invitedById: null,
        createdAt: now(),
        updatedAt: now(),
        lastLogin: null,
      });
      console.log(`Created demo user: ${u.email} / DemoPass1! (${u.role})`);
    }
    console.log(`Created demo organization: ${org.name}`);
  } else {
    console.log('Demo organization already exists, skipping.');
  }

  await seedDemoActivity(store);

  saveStore(store);
  // saveStore is debounced — give it a moment to flush before exiting.
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log('\nSeed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
