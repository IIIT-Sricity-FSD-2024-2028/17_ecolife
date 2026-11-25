import { ALL_MODULES } from '../src/config/platform.constants';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../src/generated/prisma';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_DATABASE_URL || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL }) });

async function main() {
  console.log('Seeding Tropos official registries & demo SME organization...');

  // 1. Official IPCC GWP-100 Table (AR6 2021 GHG Protocol v2.0, AR5, AR2 for BEE CCTS)
  const gwpRows = [
    { gasCode: 'CO2', gasName: 'Carbon Dioxide', isFossilMethane: false, gwpAr6: 1, gwpAr5: 1, gwpAr2: 1, sourceRef: 'IPCC AR6 Table 7.15 / GHG Protocol v2.0' },
    { gasCode: 'CH4_FOSSIL', gasName: 'Methane (Fossil)', isFossilMethane: true, gwpAr6: 29.8, gwpAr5: 28, gwpAr2: 21, sourceRef: 'IPCC AR6 Table 7.15 / GHG Protocol v2.0' },
    { gasCode: 'CH4_NON_FOSSIL', gasName: 'Methane (Non-Fossil / Combustion)', isFossilMethane: false, gwpAr6: 27.0, gwpAr5: 28, gwpAr2: 21, sourceRef: 'IPCC AR6 Table 7.15 / GHG Protocol v2.0' },
    { gasCode: 'N2O', gasName: 'Nitrous Oxide', isFossilMethane: false, gwpAr6: 273, gwpAr5: 265, gwpAr2: 310, sourceRef: 'IPCC AR6 Table 7.15 / GHG Protocol v2.0' },
    { gasCode: 'HFC_134A', gasName: 'HFC-134a (R-134a)', isFossilMethane: false, gwpAr6: 1530, gwpAr5: 1300, gwpAr2: 1300, sourceRef: 'IPCC AR6 Table 7.SM.7' },
    { gasCode: 'R_410A', gasName: 'R-410A Blend (50% R-32 / 50% R-125)', isFossilMethane: false, gwpAr6: 2256, gwpAr5: 1924, gwpAr2: 1725, sourceRef: 'IPCC AR6 Blend Calculation' },
    { gasCode: 'R_404A', gasName: 'R-404A Blend', isFossilMethane: false, gwpAr6: 4728, gwpAr5: 3943, gwpAr2: 3260, sourceRef: 'IPCC AR6 Blend Calculation' },
    { gasCode: 'R_32', gasName: 'HFC-32 (R-32)', isFossilMethane: false, gwpAr6: 771, gwpAr5: 677, gwpAr2: 650, sourceRef: 'IPCC AR6 Table 7.SM.7' },
    { gasCode: 'SF6', gasName: 'Sulphur Hexafluoride', isFossilMethane: false, gwpAr6: 24300, gwpAr5: 23500, gwpAr2: 23900, sourceRef: 'IPCC AR6 Table 7.15' }
  ];

  for (const row of gwpRows) {
    await prisma.gwpTable.upsert({
      where: { gasCode: row.gasCode },
      update: row,
      create: row
    });
  }

  // 2. Global Verified Emission Factor Registry (organizationId = null, status = PUBLISHED)
  const valid2025 = new Date('2025-04-01T00:00:00Z');
  const valid2023 = new Date('2023-04-01T00:00:00Z');

  const globalFactors: Prisma.EmissionFactorCreateInput[] = [
    {
      code: 'IN_GRID_FY25_26',
      name: 'India Grid Electricity — Weighted Average (FY 2025-26)',
      domain: 'ELECTRICITY_THERMAL',
      scope: 'SCOPE_2',
      tier: 'NATIONAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'BRSR_GHG_PROTOCOL',
      region: 'IN',
      sourceAuthority: 'India CEA CO2 Baseline Database v22.0',
      versionLabel: 'v22.0',
      validFrom: valid2025,
      canonicalUnit: 'kWh',
      co2KgPerUnit: 0.675,
      isLocked: true
    },
    {
      code: 'IN_GRID_FY24_25',
      name: 'India Grid Electricity — Weighted Average (FY 2024-25)',
      domain: 'ELECTRICITY_THERMAL',
      scope: 'SCOPE_2',
      tier: 'NATIONAL_OFFICIAL',
      status: 'SUPERSEDED',
      regimeTag: 'BRSR_GHG_PROTOCOL',
      region: 'IN',
      sourceAuthority: 'India CEA CO2 Baseline Database v21.0',
      versionLabel: 'v21.0',
      validFrom: new Date('2024-04-01T00:00:00Z'),
      validTo: new Date('2025-03-31T23:59:59Z'),
      canonicalUnit: 'kWh',
      co2KgPerUnit: 0.710,
      isLocked: true
    },
    {
      code: 'IN_GRID_CCTS_23_24',
      name: 'India Grid Electricity — Frozen CCTS Baseline (FY 2023-24)',
      domain: 'ELECTRICITY_THERMAL',
      scope: 'SCOPE_2',
      tier: 'NATIONAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'BEE_CCTS',
      region: 'IN',
      sourceAuthority: 'India CEA v20.0 (BEE CCTS Mandated Frozen Factor)',
      versionLabel: 'v20.0-CCTS',
      validFrom: valid2023,
      canonicalUnit: 'kWh',
      co2KgPerUnit: 0.727,
      isLocked: true
    },
    {
      // Gas/Diesel Oil: NCV 43.0 MJ/kg, density 0.84 kg/L => 36.12 MJ/L = 0.00003612 TJ/L
      // CO2: 74100 * 0.00003612 = 2.676492 kg/L; CH4: 3.0 * 0.00003612 = 0.00010836; N2O: 0.6 * 0.00003612 = 0.00002167
      code: 'FUEL_HSD_STAT',
      name: 'High-Speed Diesel (HSD) — Stationary Boiler & DG Set',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (Gas/Diesel Oil)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'litres',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 36.12,
      densityKgPerLitre: 0.84,
      co2KgPerUnit: 2.676492,
      ch4KgPerUnit: 0.00010836,
      n2oKgPerUnit: 0.00002167,
      wttKgCo2ePerUnit: 0.609,
      isLocked: true
    },
    {
      // E20 Petrol: 80% Fossil Gasoline (NCV 44.3 MJ/kg, density 0.74 => 32.782 MJ/L) + 20% Bioethanol
      code: 'FUEL_PETROL_E20',
      name: 'E20 Blended Petrol (80% Fossil / 20% Bioethanol) — Mobile Fleet',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 3 (Motor Gasoline + Bioethanol Blend)',
      versionLabel: 'IPCC-2006-E20',
      validFrom: valid2023,
      canonicalUnit: 'litres',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 30.50,
      densityKgPerLitre: 0.75,
      co2KgPerUnit: 1.817434,
      biogenicCo2KgPerUnit: 0.301600,
      ch4KgPerUnit: 0.000865,
      n2oKgPerUnit: 0.000084,
      wttKgCo2ePerUnit: 0.480,
      isLocked: true
    },
    {
      // Residual Fuel Oil (Furnace Oil): NCV 40.4 MJ/kg, density 0.96 => 38.784 MJ/L
      code: 'FUEL_FO_STAT',
      name: 'Furnace Oil (Residual Fuel Oil) — Stationary Boiler',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (Residual Fuel Oil)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'litres',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 38.784,
      densityKgPerLitre: 0.96,
      co2KgPerUnit: 3.001882,
      ch4KgPerUnit: 0.00011635,
      n2oKgPerUnit: 0.00002327,
      isLocked: true
    },
    {
      // Piped Natural Gas (PNG): ~38.0 MJ/SCM = 0.000038 TJ/SCM
      code: 'FUEL_PNG_STAT',
      name: 'Piped Natural Gas (PNG) — Industrial Furnace / Boiler',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (Natural Gas)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'SCM',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 38.0,
      co2KgPerUnit: 2.131800,
      ch4KgPerUnit: 0.00003800,
      n2oKgPerUnit: 0.00000380,
      isLocked: true
    },
    {
      // LPG: NCV 47.3 MJ/kg = 0.0000473 TJ/kg
      code: 'FUEL_LPG_STAT',
      name: 'Liquefied Petroleum Gas (LPG) — Process Heating',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (LPG)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'kg',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 47.3,
      co2KgPerUnit: 2.984630,
      ch4KgPerUnit: 0.00004730,
      n2oKgPerUnit: 0.00000473,
      isLocked: true
    },
    {
      // Bituminous Coal: NCV 25.8 GJ/MT = 0.0258 TJ/MT
      code: 'FUEL_COAL_BIT',
      name: 'Bituminous Coal — Industrial Boiler',
      domain: 'FUEL',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (Other Bituminous Coal)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'MT',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 25800,
      co2KgPerUnit: 2440.68,
      ch4KgPerUnit: 0.0258,
      n2oKgPerUnit: 0.0387,
      isLocked: true
    },
    {
      // Biomass Pellets: NCV 15.6 GJ/MT = 0.0156 TJ/MT; Fossil CO2 = 0, Biogenic CO2 = 112000 * 0.0156 = 1747.2 kg/MT
      code: 'FUEL_BIOMASS_PEL',
      name: 'Biomass Pellets / Wood Waste — Stationary Boiler',
      domain: 'FUEL',
      scope: 'BIOGENIC',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC 2006 Vol. 2 Ch. 2 (Wood / Wood Waste)',
      versionLabel: 'IPCC-2006-v1',
      validFrom: valid2023,
      canonicalUnit: 'MT',
      calorificBasis: 'NCV',
      ncvMjPerUnit: 15600,
      isRenewable: true,
      isBiogenic: true,
      co2KgPerUnit: 0,
      biogenicCo2KgPerUnit: 1747.2,
      ch4KgPerUnit: 0.468,
      n2oKgPerUnit: 0.0624,
      isLocked: true
    },
    {
      code: 'REFRIG_R410A',
      name: 'R-410A Refrigerant Leakage',
      domain: 'REFRIGERANT',
      scope: 'SCOPE_1',
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'GENERAL',
      region: 'IN',
      sourceAuthority: 'IPCC Sixth Assessment Report, warming value for R-410A',
      versionLabel: 'IPCC-AR6',
      validFrom: valid2023,
      canonicalUnit: 'kg',
      hfcGas: { connect: { gasCode: 'R_410A' } },
      isLocked: true
    },
    {
      code: 'S3_SPEND_STEEL_IN',
      name: 'Scope 3 Cat 1 — Fabricated Steel & Metals (Spend-Based Fallback)',
      domain: 'RAW_MATERIAL',
      scope: 'SCOPE_3',
      scope3Category: 1,
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'BRSR_GHG_PROTOCOL',
      region: 'IN',
      sourceAuthority: 'EXIOBASE / SEBI ISF Spend-Based Fallback (INR)',
      versionLabel: 'v2025-IN',
      validFrom: valid2025,
      canonicalUnit: 'INR_1000',
      co2KgPerUnit: 18.5,
      isLocked: true
    },
    {
      code: 'S3_SPEND_FREIGHT_IN',
      name: 'Scope 3 Cat 4 — Upstream Road Freight (Spend-Based Fallback)',
      domain: 'FUEL',
      scope: 'SCOPE_3',
      scope3Category: 4,
      tier: 'GLOBAL_OFFICIAL',
      status: 'PUBLISHED',
      regimeTag: 'BRSR_GHG_PROTOCOL',
      region: 'IN',
      sourceAuthority: 'India Logistics Spend-Based Fallback (INR)',
      versionLabel: 'v2025-IN',
      validFrom: valid2025,
      canonicalUnit: 'INR_1000',
      co2KgPerUnit: 11.2,
      isLocked: true
    }
  ];

  const factorMap: Record<string, string> = {};
  for (const f of globalFactors) {
    const existing = await prisma.emissionFactor.findFirst({
      where: { organizationId: null, code: f.code }
    });
    const rec = existing
      ? await prisma.emissionFactor.update({ where: { id: existing.id }, data: f })
      : await prisma.emissionFactor.create({ data: f });
    factorMap[f.code] = rec.id;
  }

  // 3. Subscription Plans
  const smePlan = await prisma.plan.upsert({
    where: { code: 'SME_STARTER' },
    update: {},
    create: {
      code: 'SME_STARTER',
      name: 'SME Starter',
      priceInrMonth: 0,
      maxFacilities: 3,
      maxUsers: 8,
      featuresJson: { buyerPdf: true, macc: true, bulkImport: true }
    }
  });

  await prisma.plan.upsert({
    where: { code: 'MID_MARKET' },
    update: {},
    create: {
      code: 'MID_MARKET',
      name: 'Mid-Market Growth',
      priceInrMonth: 9999,
      maxFacilities: 12,
      maxUsers: 30,
      featuresJson: { buyerPdf: true, macc: true, bulkImport: true, scope3: true, apiKeys: true }
    }
  });

  await prisma.plan.upsert({
    where: { code: 'ENTERPRISE_BRSR' },
    update: {},
    create: {
      code: 'ENTERPRISE_BRSR',
      name: 'Enterprise BRSR & CCTS',
      priceInrMonth: 29999,
      maxFacilities: 999,
      maxUsers: 999,
      featuresJson: { allModules: true, brsrCore: true, beeCcts: true, assuranceRoom: true }
    }
  });

  // 4. Platform Admin
  const pwHash = await bcrypt.hash('Tropos@2026', 10);
  await prisma.user.upsert({
    where: { email: 'platform.admin@tropos.in' },
    update: {},
    create: {
      email: 'platform.admin@tropos.in',
      fullName: 'Vikram Deshmukh',
      passwordHash: pwHash,
      isPlatformAdmin: true,
      emailVerifiedAt: new Date(),
      twoFactorEnabled: true
    }
  });

  // 5. Demo SME Organization: Bharat Precision Gears Pvt. Ltd.
  let org = await prisma.organization.findFirst({ where: { name: 'Bharat Precision Gears Pvt. Ltd.' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Bharat Precision Gears Pvt. Ltd.',
        cin: 'U29100MH2016PTC284910',
        gstin: '27AABCB4512R1Z8',
        industrySector: 'Automotive Components Manufacturing',
        preset: 'SME_STANDARD',
        status: 'ACTIVE',
        planId: smePlan.id,
        billingEmail: 'finance@bharatgears.in',
        enabledModules: [...ALL_MODULES],
        allowSingleUserMode: false,
        fyStartMonth: 4,
        consolidationApproach: 'OPERATIONAL_CONTROL',
        assuranceStandard: 'INTERNAL_TRACKING'
      }
    });
  }

  // 6. Seed All Tenant Roles (Cleanly respecting COSO ICSR & SEBI Independence!)
  const demoUsers: Array<{ email: string; fullName: string; role: 'ORG_ADMIN' | 'PLANT_MANAGER' | 'FINANCE_MANAGER' | 'SUSTAINABILITY_LEAD' | 'INTERNAL_AUDITOR' | 'EXECUTIVE_APPROVER' | 'EXTERNAL_VERIFIER' }> = [
    { email: 'lead@bharatgears.in', fullName: 'Ananya Rao', role: 'SUSTAINABILITY_LEAD' },
    { email: 'plant@bharatgears.in', fullName: 'Rajesh Kulkarni', role: 'PLANT_MANAGER' },
    { email: 'finance@bharatgears.in', fullName: 'Meera Nair', role: 'FINANCE_MANAGER' },
    { email: 'exec@bharatgears.in', fullName: 'Suresh Patil', role: 'EXECUTIVE_APPROVER' },
    { email: 'auditor@bharatgears.in', fullName: 'Kiran Joshi', role: 'INTERNAL_AUDITOR' },
    { email: 'verifier@acva-india.in', fullName: 'Dr. Arvind Menon (ACVA)', role: 'EXTERNAL_VERIFIER' },
    { email: 'admin@bharatgears.in', fullName: 'Nikhil Verma', role: 'ORG_ADMIN' }
  ];

  const userMap: Record<string, string> = {};
  for (const u of demoUsers) {
    const usr = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        organizationId: org.id,
        email: u.email,
        fullName: u.fullName,
        passwordHash: pwHash,
        isPlatformAdmin: false,
        emailVerifiedAt: new Date()
      }
    });
    userMap[u.role] = usr.id;
    await prisma.userRole.upsert({
      where: { userId_role: { userId: usr.id, role: u.role } },
      update: {},
      create: { organizationId: org.id, userId: usr.id, role: u.role }
    });
  }

  // 7. Entity & Facility (Pune Plant 1)
  let entity = await prisma.entity.findFirst({ where: { organizationId: org.id } });
  if (!entity) {
    entity = await prisma.entity.create({
      data: {
        organizationId: org.id,
        name: 'Bharat Precision Gears — India Operations',
        cin: 'U29100MH2016PTC284910',
        ownershipPct: 100,
        hasOperationalControl: true,
        hasFinancialControl: true,
        approvalStatus: 'APPROVED',
        approvedById: userMap.EXECUTIVE_APPROVER
      }
    });
  }

  let facility = await prisma.facility.findFirst({ where: { organizationId: org.id } });
  if (!facility) {
    facility = await prisma.facility.create({
      data: {
        organizationId: org.id,
        entityId: entity.id,
        name: 'Pune Plant 1 — Chakan MIDC',
        effectiveFrom: new Date('2025-04-01T00:00:00Z'),
        facilityType: 'MANUFACTURING_PLANT',
        businessUnit: 'Powertrain Gears',
        region: 'West India',
        city: 'Pune',
        state: 'Maharashtra',
        discomConsumerNo: 'MSEDCL-1700482910',
        contractDemandKw: 450,
        rooftopSolarKwp: 60,
        meteringMode: 'GROSS_METERING',
        isWaterStressArea: true,
        spcbWaterLimitKl: 2500,
        totalLandAreaHa: 2.4,
        greenbeltPct: 34.5,
        approvalStatus: 'APPROVED',
        approvedById: userMap.EXECUTIVE_APPROVER
      }
    });
  }

  await prisma.userFacilityAssignment.upsert({
    where: { userId_facilityId: { userId: userMap.PLANT_MANAGER, facilityId: facility.id } },
    update: {},
    create: { organizationId: org.id, userId: userMap.PLANT_MANAGER, facilityId: facility.id }
  });

  // 8. Resource Sources (Fuels Primary + Electricity + Refrigerant)
  const sourceDefs = [
    { name: 'BLR-102 · HSD Steam Boiler #1', domain: 'FUEL' as const, scope: 'SCOPE_1' as const, fuelCategory: 'LIQUID_FOSSIL' as const, combustionPurpose: 'STATIONARY_BOILER' as const, canonicalUnit: 'litres', defaultFactorId: factorMap.FUEL_HSD_STAT, meterSerialNo: 'TMX-BLR-102' },
    { name: 'DG-404 · 500 kVA Backup DG Set', domain: 'FUEL' as const, scope: 'SCOPE_1' as const, fuelCategory: 'LIQUID_FOSSIL' as const, combustionPurpose: 'DG_SET' as const, canonicalUnit: 'litres', defaultFactorId: factorMap.FUEL_HSD_STAT, meterSerialNo: 'CMN-DG-404' },
    { name: 'ELC-407 · DISCOM HT Grid Meter', domain: 'ELECTRICITY_THERMAL' as const, scope: 'SCOPE_2' as const, canonicalUnit: 'kWh', defaultFactorId: factorMap.IN_GRID_FY25_26, meterSerialNo: 'MSEDCL-HT-407' },
    { name: 'FLT-802 · Plant Delivery Fleet (E20)', domain: 'FUEL' as const, scope: 'SCOPE_1' as const, fuelCategory: 'BLENDED_BIOFUEL' as const, combustionPurpose: 'MOBILE_FLEET' as const, bioBlendPct: 20, canonicalUnit: 'litres', defaultFactorId: factorMap.FUEL_PETROL_E20, meterSerialNo: 'HPCL-FLT-802' }
  ];

  const sourceMap: Record<string, string> = {};
  for (const s of sourceDefs) {
    let existing = await prisma.resourceSource.findFirst({ where: { organizationId: org.id, name: s.name } });
    if (!existing) {
      existing = await prisma.resourceSource.create({
        data: { organizationId: org.id, facilityId: facility.id, ownerId: userMap.PLANT_MANAGER, effectiveFrom: new Date('2025-04-01T00:00:00Z'), ...s }
      });
    }
    sourceMap[s.meterSerialNo] = existing.id;
  }

  // Refrigerant Equipment
  const existingChiller = await prisma.refrigerantEquipment.findFirst({ where: { organizationId: org.id } });
  if (!existingChiller) {
    await prisma.refrigerantEquipment.create({
      data: {
        organizationId: org.id,
        facilityId: facility.id,
        equipmentName: 'Process Chiller #1 (CNC Bay)',
        refrigerantCode: 'R_410A',
        nameplateKg: 48.0,
        defaultLeakPct: 4.5
      }
    });
  }

  // 9. Reporting Periods (Nov 2025 – Mar 2026 CLOSED with Snapshots + Apr 2026 OPEN)
  const periodDefs = [
    { fy: 'FY2025-26', month: 11, label: 'Nov 2025', start: '2025-11-01', end: '2025-11-30', status: 'SIGNED_OFF' as const, s1: 19.4, s2: 14.1, bio: 0.28, eGj: 312 },
    { fy: 'FY2025-26', month: 12, label: 'Dec 2025', start: '2025-12-01', end: '2025-12-31', status: 'SIGNED_OFF' as const, s1: 18.8, s2: 13.8, bio: 0.29, eGj: 304 },
    { fy: 'FY2025-26', month: 1, label: 'Jan 2026', start: '2026-01-01', end: '2026-01-31', status: 'SIGNED_OFF' as const, s1: 17.9, s2: 13.2, bio: 0.27, eGj: 291 },
    { fy: 'FY2025-26', month: 2, label: 'Feb 2026', start: '2026-02-01', end: '2026-02-28', status: 'SIGNED_OFF' as const, s1: 18.2, s2: 12.9, bio: 0.28, eGj: 294 },
    { fy: 'FY2025-26', month: 3, label: 'Mar 2026', start: '2026-03-01', end: '2026-03-31', status: 'SIGNED_OFF' as const, s1: 17.5, s2: 13.1, bio: 0.30, eGj: 288 },
    { fy: 'FY2026-27', month: 4, label: 'Apr 2026', start: '2026-04-01', end: '2026-04-30', status: 'OPEN' as const, s1: 0, s2: 0, bio: 0, eGj: 0 }
  ];

  let aprPeriodId = '';
  for (const p of periodDefs) {
    const per = await prisma.reportingPeriod.upsert({
      where: { organizationId_financialYear_month: { organizationId: org.id, financialYear: p.fy, month: p.month } },
      update: {},
      create: {
        organizationId: org.id,
        financialYear: p.fy,
        month: p.month,
        label: p.label,
        startDate: new Date(p.start),
        endDate: new Date(p.end),
        status: p.status,
        closedAt: p.status === 'SIGNED_OFF' ? new Date(p.end) : null,
        closedById: p.status === 'SIGNED_OFF' ? userMap.SUSTAINABILITY_LEAD : null,
        signedOffAt: p.status === 'SIGNED_OFF' ? new Date(p.end) : null,
        signedOffById: p.status === 'SIGNED_OFF' ? userMap.EXECUTIVE_APPROVER : null
      }
    });
    if (p.label === 'Apr 2026') aprPeriodId = per.id;
    if (p.status === 'SIGNED_OFF') {
      await prisma.periodSnapshot.upsert({
        where: { periodId_version: { periodId: per.id, version: 1 } },
        update: {},
        create: {
          organizationId: org.id,
          periodId: per.id,
          version: 1,
          scope1Ar6Tco2e: p.s1,
          scope2LocationAr6Tco2e: p.s2,
          scope2MarketAr6Tco2e: p.s2,
          scope3Ar6Tco2e: 4.2,
          biogenicCo2Tco2e: p.bio,
          cctsScope1And2Ar2Tco2e: Number((p.s1 + p.s2 * (0.727 / 0.675)).toFixed(4)),
          totalEnergyGj: p.eGj,
          renewableEnergyGj: 11.5,
          waterWithdrawalKl: 1820,
          waterConsumptionKl: 1430,
          waterDischargeKl: 390,
          wasteGeneratedMt: 14.2,
          wasteRecoveredMt: 11.8,
          wasteDisposedMt: 2.4,
          createdById: userMap.SUSTAINABILITY_LEAD
        }
      });
    }
  }

  // 10. Seed Apr 2026 Open Entries (Fuels, Grid Electricity, Water, Waste)
  const existingEntries = await prisma.resourceEntry.count({ where: { organizationId: org.id, periodId: aprPeriodId } });
  if (existingEntries === 0) {
    await prisma.resourceEntry.createMany({
      data: [
        {
          organizationId: org.id, periodId: aprPeriodId, sourceId: sourceMap['TMX-BLR-102'], factorId: factorMap.FUEL_HSD_STAT,
          status: 'APPROVED', dataBasis: 'ACTUAL_METERED', dataQualityTier: 1,
          rawQuantity: 4250, rawUnit: 'litres', normalizedQuantity: 4250, normalizedUnit: 'litres', costInr: 391000,
          openingStockQty: 1500, purchasedQty: 4000, closingStockQty: 1250, nonEnergyDeductedQty: 0,
          invoiceNumber: 'IOCL-2026-8841',
          pinnedFactorSnapshot: { code: 'FUEL_HSD_STAT', authority: 'IPCC 2006 Vol. 2 Ch. 2', co2KgPerUnit: 2.676492, ch4KgPerUnit: 0.00010836, n2oKgPerUnit: 0.00002167 },
          calculatedEnergyGj: 153.51, calculatedCo2Kg: 11375.091, calculatedCh4Kg: 0.46053, calculatedN2oKg: 0.092098,
          calculatedTco2eAr6: 11.412668, calculatedTco2eAr2: 11.413312, calculatedWttTco2e: 2.58825,
          submittedById: userMap.PLANT_MANAGER, submittedAt: new Date(), reviewedById: userMap.SUSTAINABILITY_LEAD, reviewedAt: new Date()
        },
        {
          organizationId: org.id, periodId: aprPeriodId, sourceId: sourceMap['CMN-DG-404'], factorId: factorMap.FUEL_HSD_STAT,
          status: 'SUBMITTED', dataBasis: 'ACTUAL_METERED', dataQualityTier: 1,
          rawQuantity: 1380, rawUnit: 'litres', normalizedQuantity: 1380, normalizedUnit: 'litres', costInr: 126960,
          invoiceNumber: 'BPCL-2026-4410',
          pinnedFactorSnapshot: { code: 'FUEL_HSD_STAT', authority: 'IPCC 2006 Vol. 2 Ch. 2', co2KgPerUnit: 2.676492 },
          calculatedEnergyGj: 49.8456, calculatedCo2Kg: 3693.559, calculatedCh4Kg: 0.149537, calculatedN2oKg: 0.029905,
          calculatedTco2eAr6: 3.705761, calculatedTco2eAr2: 3.705970, calculatedWttTco2e: 0.84042,
          qualityFlags: ['OUTLIER_GT_2_5X'],
          submittedById: userMap.PLANT_MANAGER, submittedAt: new Date()
        },
        {
          organizationId: org.id, periodId: aprPeriodId, sourceId: sourceMap['MSEDCL-HT-407'], factorId: factorMap.IN_GRID_FY25_26,
          status: 'APPROVED', dataBasis: 'ACTUAL_METERED', dataQualityTier: 1,
          rawQuantity: 18400, rawUnit: 'kWh', normalizedQuantity: 18400, normalizedUnit: 'kWh', costInr: 169280,
          grossGridImportKwh: 18400, onsiteSolarSelfConsumedKwh: 3200, solarExportedKwh: 640,
          invoiceNumber: 'MSEDCL-APR-26',
          pinnedFactorSnapshot: { code: 'IN_GRID_FY25_26', authority: 'India CEA CO2 Baseline Database v22.0', co2KgPerUnit: 0.675 },
          calculatedEnergyGj: 66.24, calculatedCo2Kg: 12420, calculatedTco2eAr6: 12.42, calculatedTco2eAr2: 13.3768,
          submittedById: userMap.PLANT_MANAGER, submittedAt: new Date(), reviewedById: userMap.SUSTAINABILITY_LEAD, reviewedAt: new Date()
        },
        {
          organizationId: org.id, periodId: aprPeriodId, sourceId: sourceMap['HPCL-FLT-802'], factorId: factorMap.FUEL_PETROL_E20,
          status: 'DRAFT', dataBasis: 'ACTUAL_METERED', dataQualityTier: 1,
          rawQuantity: 980, rawUnit: 'litres', normalizedQuantity: 980, normalizedUnit: 'litres', costInr: 102900,
          invoiceNumber: 'HPCL-FLEET-04',
          pinnedFactorSnapshot: { code: 'FUEL_PETROL_E20', authority: 'IPCC 2006 Vol. 2 Ch. 3', co2KgPerUnit: 1.817434, biogenicCo2KgPerUnit: 0.301600 },
          calculatedEnergyGj: 29.89, calculatedCo2Kg: 1781.085, calculatedBiogenicCo2Kg: 295.568, calculatedCh4Kg: 0.8477, calculatedN2oKg: 0.08232,
          calculatedTco2eAr6: 1.826446, calculatedTco2eAr2: 1.824406, calculatedWttTco2e: 0.4704,
          submittedById: userMap.PLANT_MANAGER
        }
      ]
    });

    await prisma.waterLog.create({
      data: {
        organizationId: org.id, facilityId: facility.id, periodId: aprPeriodId,
        withdrawalSource: 'THIRD_PARTY', withdrawalKl: 1800, dischargeDestination: 'THIRD_PARTY',
        treatmentLevel: 'ETP Tertiary', dischargeKl: 380, recycledKl: 432, consumptionKl: 1420,
        costInr: 54000, status: 'APPROVED', submittedById: userMap.PLANT_MANAGER, reviewedById: userMap.SUSTAINABILITY_LEAD
      }
    });

    await prisma.wasteLog.create({
      data: {
        organizationId: org.id, facilityId: facility.id, periodId: aprPeriodId,
        wasteCategory: 'OTHER_NON_HAZARDOUS', treatmentRoute: 'RECYCLED', isOnsite: false,
        quantityMt: 12.03, costInr: 14500, manifestRef: 'MPCB-F10-2026-041', linkedScope3Tco2e: 0.26,
        status: 'APPROVED', submittedById: userMap.PLANT_MANAGER, reviewedById: userMap.SUSTAINABILITY_LEAD
      }
    });
  }

  // 11. SBTi SME Target (-42% Scope 1+2 by FY2029-30) + 5 MACC Reduction Actions
  const existingTarget = await prisma.target.findFirst({ where: { organizationId: org.id } });
  if (!existingTarget) {
    const target = await prisma.target.create({
      data: {
        organizationId: org.id,
        name: 'SBTi SME Near-Term Scope 1+2 (−42% by 2030)',
        targetType: 'ABSOLUTE',
        scopeCoverage: 'SCOPE_1_AND_2_LOCATION',
        framework: 'SBTI_SME_ROUTE',
        baseYear: 'FY2025-26',
        targetYear: 'FY2029-30',
        baseValue: 1000,
        originalBaseValue: 1000,
        targetReductionPct: 42,
        targetValue: 580,
        status: 'ON_TRACK',
        ownerId: userMap.SUSTAINABILITY_LEAD,
        approvedById: userMap.EXECUTIVE_APPROVER,
        approvedAt: new Date()
      }
    });

    await prisma.reductionAction.createMany({
      data: [
        { organizationId: org.id, targetId: target.id, facilityId: facility.id, sourceId: sourceMap['TMX-BLR-102'], domain: 'FUEL', lever: 'ENERGY_EFFICIENCY', title: 'Boiler air-fuel ratio tuning', status: 'IN_PROGRESS', expectedSavingTco2e: 80, secondaryScopeShiftTco2e: 0, biogenicShiftTco2e: 0, netExpectedSavingTco2e: 80, capexInr: 0, annualOpexDeltaInr: -144000, lifetimeYears: 5, paybackYears: 0, macInrPerTco2e: -1800, endDate: new Date('2026-09-30') },
        { organizationId: org.id, targetId: target.id, facilityId: facility.id, sourceId: sourceMap['MSEDCL-HT-407'], domain: 'ELECTRICITY_THERMAL', lever: 'ENERGY_EFFICIENCY', title: 'Air-compressor VFD & leak arrest', status: 'PLANNED', expectedSavingTco2e: 60, secondaryScopeShiftTco2e: 0, biogenicShiftTco2e: 0, netExpectedSavingTco2e: 60, capexInr: 180000, annualOpexDeltaInr: -108000, lifetimeYears: 5, paybackYears: 1.67, macInrPerTco2e: -1200, endDate: new Date('2026-12-31') },
        { organizationId: org.id, targetId: target.id, facilityId: facility.id, sourceId: sourceMap['MSEDCL-HT-407'], domain: 'ELECTRICITY_THERMAL', lever: 'ONSITE_SOLAR', title: '150 kWp rooftop solar array', status: 'PLANNED', expectedSavingTco2e: 140, secondaryScopeShiftTco2e: 0, biogenicShiftTco2e: 0, netExpectedSavingTco2e: 140, capexInr: 6300000, annualOpexDeltaInr: -1365000, lifetimeYears: 10, paybackYears: 4.62, macInrPerTco2e: -5250, endDate: new Date('2027-06-30') },
        { organizationId: org.id, targetId: target.id, facilityId: facility.id, sourceId: sourceMap['TMX-BLR-102'], domain: 'FUEL', lever: 'FUEL_SWITCH', title: 'Boiler #2 FO to biomass pellets', status: 'PLANNED', expectedSavingTco2e: 110, secondaryScopeShiftTco2e: 0, biogenicShiftTco2e: 96, netExpectedSavingTco2e: 110, capexInr: 1200000, annualOpexDeltaInr: -168500, lifetimeYears: 5, paybackYears: 7.12, macInrPerTco2e: 650, endDate: new Date('2027-12-31') },
        { organizationId: org.id, targetId: target.id, facilityId: facility.id, sourceId: sourceMap['MSEDCL-HT-407'], domain: 'ELECTRICITY_THERMAL', lever: 'PPA_OPEN_ACCESS', title: 'DISCOM green tariff (100% RE)', status: 'PLANNED', expectedSavingTco2e: 70, secondaryScopeShiftTco2e: 0, biogenicShiftTco2e: 0, netExpectedSavingTco2e: 70, capexInr: 0, annualOpexDeltaInr: 105000, lifetimeYears: 5, paybackYears: null, macInrPerTco2e: 1500, endDate: new Date('2028-03-31') }
      ]
    });
  }

  console.log('Seed completed cleanly!');
  console.log('Demo logins (password: Tropos@2026):');
  console.log('  Sustainability Lead : lead@bharatgears.in');
  console.log('  Plant Manager       : plant@bharatgears.in');
  console.log('  Finance Manager     : finance@bharatgears.in');
  console.log('  Executive Approver  : exec@bharatgears.in');
  console.log('  Internal Auditor    : auditor@bharatgears.in');
  console.log('  External Verifier   : verifier@acva-india.in');
  console.log('  Org Admin           : admin@bharatgears.in');
  console.log('  Platform Admin      : platform.admin@tropos.in');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
