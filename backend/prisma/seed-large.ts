import 'dotenv/config';
import crypto from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_DATABASE_URL || process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL }) });

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

async function main() {
  console.log('Seeding large realistic multi-facility dataset for Tropos stress testing...');

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_platform_admin', 'true', true)`;

    const org = await tx.organization.findFirstOrThrow({
      include: { plan: true }
    });
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

    // Upgrade org preset to ENTERPRISE_BRSR so all modules are active for testing
    await tx.organization.update({
      where: { id: org.id },
      data: {
        preset: 'ENTERPRISE_BRSR',
        cctsObligated: true,
        enabledModules: [
          'FUELS', 'ELECTRICITY', 'WATER', 'WASTE', 'REFRIGERANTS',
          'AIR', 'MATERIALS', 'VALUE_CHAIN', 'GREEN_ECONOMY', 'TARGETS', 'ASSURANCE'
        ]
      }
    });

    const users = await tx.user.findMany({ where: { organizationId: org.id }, include: { roles: true } });
    const byRole = (role: string) => users.find((u) => u.roles.some((r) => r.role === role)) ?? users[0];
    const lead = byRole('SUSTAINABILITY_LEAD');
    const plant = byRole('PLANT_MANAGER');
    const finance = byRole('FINANCE_MANAGER');
    const exec = byRole('EXECUTIVE_APPROVER');
    const auditor = byRole('INTERNAL_AUDITOR');
    const verifier = byRole('EXTERNAL_VERIFIER');

    // 1. Entities & 4 Facilities
    let rootEntity = await tx.entity.findFirst({ where: { organizationId: org.id } });
    if (!rootEntity) {
      rootEntity = await tx.entity.create({
        data: {
          organizationId: org.id,
          name: org.name,
          cin: 'L28910MH2012PLC234567',
          ownershipPct: 100,
          hasOperationalControl: true,
          hasFinancialControl: true,
          effectiveFrom: new Date('2024-04-01T00:00:00Z'),
          approvalStatus: 'APPROVED',
          approvedById: exec.id,
          approvedAt: new Date()
        }
      });
    }

    let subEntity = await tx.entity.findFirst({ where: { organizationId: org.id, name: 'Bharat Precision Castings Subsidiary Pvt Ltd' } });
    if (!subEntity) {
      subEntity = await tx.entity.create({
        data: {
          organizationId: org.id,
          parentEntityId: rootEntity.id,
          name: 'Bharat Precision Castings Subsidiary Pvt Ltd',
          cin: 'U27100GJ2018PTC104522',
          ownershipPct: 100,
          hasOperationalControl: true,
          hasFinancialControl: true,
          effectiveFrom: new Date('2024-04-01T00:00:00Z'),
          approvalStatus: 'APPROVED',
          approvedById: exec.id,
          approvedAt: new Date()
        }
      });
    }

    const facDefs = [
      { entityId: rootEntity.id, name: 'Pune Chakan Plant 1', city: 'Pune', state: 'Maharashtra', type: 'MANUFACTURING_PLANT' as const, solar: 450, stress: true },
      { entityId: rootEntity.id, name: 'Chennai Oragadam Machining Unit', city: 'Chennai', state: 'Tamil Nadu', type: 'MANUFACTURING_PLANT' as const, solar: 320, stress: true },
      { entityId: subEntity.id, name: 'Ahmedabad Sanand Foundry', city: 'Ahmedabad', state: 'Gujarat', type: 'MANUFACTURING_PLANT' as const, solar: 600, stress: true },
      { entityId: rootEntity.id, name: 'Bengaluru Engineering Hub', city: 'Bengaluru', state: 'Karnataka', type: 'OFFICE' as const, solar: 85, stress: false }
    ];

    const facilities = [];
    for (const fd of facDefs) {
      const existing = await tx.facility.findFirst({ where: { organizationId: org.id, name: fd.name } });
      if (existing) {
        facilities.push(existing);
      } else {
        facilities.push(
          await tx.facility.create({
            data: {
              organizationId: org.id,
              entityId: fd.entityId,
              name: fd.name,
              facilityType: fd.type,
              city: fd.city,
              state: fd.state,
              rooftopSolarKwp: fd.solar,
              isWaterStressArea: fd.stress,
              spcbWaterLimitKl: fd.stress ? 2500 : 800,
              effectiveFrom: new Date('2024-04-01T00:00:00Z'),
              approvalStatus: 'APPROVED',
              approvedById: exec.id
            }
          })
        );
      }
    }

    // 2. Full 12 Monthly Reporting Periods (created/temporarily set OPEN so PostgreSQL lock trigger permits seeding, then locked at the end!)
    const months = [
      { m: 4, y: 2025, label: 'Apr 2025', targetStatus: 'SIGNED_OFF' as const },
      { m: 5, y: 2025, label: 'May 2025', targetStatus: 'SIGNED_OFF' as const },
      { m: 6, y: 2025, label: 'Jun 2025', targetStatus: 'SIGNED_OFF' as const },
      { m: 7, y: 2025, label: 'Jul 2025', targetStatus: 'CLOSED' as const },
      { m: 8, y: 2025, label: 'Aug 2025', targetStatus: 'CLOSED' as const },
      { m: 9, y: 2025, label: 'Sep 2025', targetStatus: 'CLOSED' as const },
      { m: 10, y: 2025, label: 'Oct 2025', targetStatus: 'REOPENED' as const },
      { m: 11, y: 2025, label: 'Nov 2025', targetStatus: 'OPEN' as const },
      { m: 12, y: 2025, label: 'Dec 2025', targetStatus: 'OPEN' as const },
      { m: 1, y: 2026, label: 'Jan 2026', targetStatus: 'OPEN' as const },
      { m: 2, y: 2026, label: 'Feb 2026', targetStatus: 'OPEN' as const },
      { m: 3, y: 2026, label: 'Mar 2026', targetStatus: 'OPEN' as const }
    ];

    const periods = [];
    for (const mp of months) {
      const existing = await tx.reportingPeriod.findFirst({
        where: { organizationId: org.id, financialYear: 'FY2025-26', month: mp.m }
      });
      if (existing) {
        // Temporarily mark REOPENED if already CLOSED/SIGNED_OFF so seed inserts respect DB lock trigger
        if (existing.status === 'CLOSED' || existing.status === 'SIGNED_OFF') {
          await tx.reportingPeriod.update({ where: { id: existing.id }, data: { status: 'REOPENED' } });
        }
        periods.push(existing);
      } else {
        periods.push(
          await tx.reportingPeriod.create({
            data: {
              organizationId: org.id,
              financialYear: 'FY2025-26',
              month: mp.m,
              label: mp.label,
              startDate: new Date(Date.UTC(mp.y, mp.m - 1, 1)),
              endDate: new Date(Date.UTC(mp.y, mp.m, 0)),
              status: 'OPEN'
            }
          })
        );
      }
    }

    const factors = await tx.emissionFactor.findMany({ where: { OR: [{ organizationId: null }, { organizationId: org.id }] } });
    const fHsd = factors.find((f) => f.code.includes('HSD')) ?? factors[0];
    const fGrid = factors.find((f) => f.code.includes('CEA-V22') || f.domain === 'ELECTRICITY_THERMAL') ?? factors[0];
    const fNg = factors.find((f) => f.code.includes('NG') || f.code.includes('GAS')) ?? fHsd;

    // 3. 12 Resource Sources across the 4 facilities
    const sources = [];
    for (const fac of facilities) {
      const defs = [
        { name: `${fac.city} HT Utility Grid Meter`, domain: 'ELECTRICITY_THERMAL' as const, scope: 'SCOPE_2' as const, unit: 'kWh', factor: fGrid, meter: `MTR-${fac.city.slice(0, 3).toUpperCase()}-HT01` },
        { name: `${fac.city} DG Set Backup (HSD)`, domain: 'FUEL' as const, scope: 'SCOPE_1' as const, unit: 'L', factor: fHsd, meter: `DG-${fac.city.slice(0, 3).toUpperCase()}-01` },
        { name: `${fac.city} Process Furnace (PNG/NG)`, domain: 'FUEL' as const, scope: 'SCOPE_1' as const, unit: fNg.canonicalUnit, factor: fNg, meter: `FUR-${fac.city.slice(0, 3).toUpperCase()}-02` }
      ];
      for (const d of defs) {
        const ex = await tx.resourceSource.findFirst({ where: { organizationId: org.id, facilityId: fac.id, name: d.name } });
        if (ex) sources.push(ex);
        else {
          sources.push(
            await tx.resourceSource.create({
              data: {
                organizationId: org.id,
                facilityId: fac.id,
                name: d.name,
                domain: d.domain,
                scope: d.scope,
                canonicalUnit: d.unit,
                defaultFactorId: d.factor.id,
                meterSerialNo: d.meter,
                ownerId: plant.id,
                effectiveFrom: new Date('2024-04-01T00:00:00Z')
              }
            })
          );
        }
      }
    }

    // 4. 144 Resource Entries across all 12 periods & 12 sources with realistic variance, costs & QA anomaly flags
    let entryIdx = 0;
    for (let pIdx = 0; pIdx < periods.length; pIdx++) {
      const p = periods[pIdx];
      const targetSt = months[pIdx].targetStatus;
      let pS1 = 0;
      let pS2 = 0;
      let pGj = 0;

      for (let sIdx = 0; sIdx < sources.length; sIdx++) {
        const src = sources[sIdx];
        entryIdx++;
        const isGrid = src.domain === 'ELECTRICITY_THERMAL';
        const baseQty = isGrid ? 38000 + (sIdx * 4200) + ((pIdx % 4) * 2800) : 1400 + (sIdx * 260) + ((pIdx % 3) * 180);
        const isSpike = entryIdx % 13 === 0;
        const qty = isSpike ? Math.round(baseQty * 1.52) : baseQty;
        const unitCost = isGrid ? 8.9 : 92.5;
        const costInr = Math.round(qty * unitCost);
        const factorCo2 = isGrid ? 0.675 : 2.68;
        const tco2e = Number(((qty * factorCo2) / 1000).toFixed(4));
        const energyGj = Number((isGrid ? qty * 0.0036 : qty * 0.03612).toFixed(3));

        if (src.scope === 'SCOPE_1') pS1 += tco2e;
        if (src.scope === 'SCOPE_2') pS2 += tco2e;
        pGj += energyGj;

        const status =
          targetSt === 'CLOSED' || targetSt === 'SIGNED_OFF'
            ? 'APPROVED'
            : pIdx === 7
              ? 'SUBMITTED'
              : entryIdx % 7 === 0
                ? 'REJECTED'
                : 'DRAFT';

        const flags: string[] = [];
        if (isSpike) flags.push('ANOMALY_HIGH_SPIKE_+52PCT');
        if (entryIdx % 19 === 0) flags.push('UNIT_COST_OUTLIER');
        if (entryIdx % 23 === 0) flags.push('ESTIMATED_PROXY_NEEDS_TRUE_UP');

        await tx.resourceEntry.create({
          data: {
            organizationId: org.id,
            periodId: p.id,
            sourceId: src.id,
            factorId: src.defaultFactorId,
            status,
            dataBasis: flags.includes('ESTIMATED_PROXY_NEEDS_TRUE_UP') ? 'ESTIMATED_PROXY' : 'ACTUAL_METERED',
            rawQuantity: qty,
            rawUnit: src.canonicalUnit,
            normalizedQuantity: qty,
            normalizedUnit: src.canonicalUnit,
            costInr,
            invoiceNumber: `INV-${p.label.replace(/\s+/g, '').toUpperCase()}-${String(entryIdx).padStart(4, '0')}`,
            calculatedEnergyGj: energyGj,
            calculatedCo2Kg: Number((tco2e * 1000).toFixed(2)),
            calculatedBiogenicCo2Kg: 0,
            calculatedCh4Kg: Number((tco2e * 0.001).toFixed(5)),
            calculatedN2oKg: Number((tco2e * 0.0002).toFixed(5)),
            calculatedTco2eAr6: tco2e,
            calculatedTco2eAr2: Number((tco2e * 1.04).toFixed(4)),
            qualityFlags: flags,
            pinnedFactorSnapshot: { code: isGrid ? 'CEA-V22-INDIA-GRID-FY26' : 'IPCC-2006-HSD-STATIONARY', co2KgPerUnit: factorCo2 },
            submittedById: plant.id,
            reviewedById: status === 'APPROVED' || status === 'REJECTED' ? lead.id : null,
            reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : null
          }
        });
      }

      if (targetSt === 'CLOSED' || targetSt === 'SIGNED_OFF') {
        const snapExists = await tx.periodSnapshot.findFirst({ where: { organizationId: org.id, periodId: p.id } });
        if (!snapExists) {
          await tx.periodSnapshot.create({
            data: {
              organizationId: org.id,
              periodId: p.id,
              version: 1,
              isRestatement: false,
              scope1Ar6Tco2e: Number(pS1.toFixed(3)),
              scope2LocationAr6Tco2e: Number(pS2.toFixed(3)),
              scope2MarketAr6Tco2e: Number((pS2 * 0.78).toFixed(3)),
              scope3Ar6Tco2e: Number(((pS1 + pS2) * 0.65).toFixed(3)),
              biogenicCo2Tco2e: 14.2,
              cctsScope1And2Ar2Tco2e: Number(((pS1 + pS2) * 1.05).toFixed(3)),
              totalEnergyGj: Number(pGj.toFixed(2)),
              renewableEnergyGj: Number((pGj * 0.22).toFixed(2)),
              waterWithdrawalKl: 2450,
              waterConsumptionKl: 1680,
              waterDischargeKl: 770,
              wasteGeneratedMt: 42.5,
              wasteRecoveredMt: 36.2,
              wasteDisposedMt: 6.3,
              isSelfReviewedOnly: false,
              createdById: lead.id,
              snapshotPayload: { seeded: true, entriesPerPeriod: sources.length }
            }
          });
        }
      }
    }

    // 5. Water (28), Waste (28), Air (24), Materials (20) — inserted while periods are still OPEN/REOPENED
    const waterSources = ['GROUNDWATER', 'SURFACE', 'THIRD_PARTY', 'SEAWATER_DESALINATED', 'OTHERS'] as const;
    const wasteCats = ['PLASTIC', 'E_WASTE', 'BATTERY', 'CONSTRUCTION_DEMOLITION', 'OTHER_HAZARDOUS', 'OTHER_NON_HAZARDOUS'] as const;
    const wasteRoutes = ['RECYCLED', 'REUSED', 'OTHER_RECOVERY', 'INCINERATED_WITH_ENERGY', 'LANDFILLED'] as const;
    const airPolls = ['NOX', 'SOX', 'PM', 'PM10', 'PM2_5', 'VOC'] as const;
    const matOrigins = ['RECYCLED', 'VIRGIN', 'REUSED'] as const;

    for (let i = 0; i < 28; i++) {
      const fac = facilities[i % facilities.length];
      const per = periods[i % periods.length];
      const wKl = 320 + (i * 35);
      const dKl = Math.round(wKl * 0.32);
      await tx.waterLog.create({
        data: {
          organizationId: org.id,
          facilityId: fac.id,
          periodId: per.id,
          withdrawalSource: waterSources[i % waterSources.length],
          withdrawalKl: wKl,
          dischargeKl: dKl,
          recycledKl: Math.round(wKl * 0.25),
          consumptionKl: wKl - dKl,
          costInr: wKl * 42,
          status: i < 18 ? 'APPROVED' : 'DRAFT',
          submittedById: plant.id
        }
      });

      await tx.wasteLog.create({
        data: {
          organizationId: org.id,
          facilityId: fac.id,
          periodId: per.id,
          wasteCategory: wasteCats[i % wasteCats.length],
          treatmentRoute: wasteRoutes[i % wasteRoutes.length],
          quantityMt: Number((1.4 + (i % 9) * 0.85).toFixed(2)),
          manifestRef: `FORM10-MH-${202500 + i}`,
          isOnsite: i % 4 === 0,
          status: i < 18 ? 'APPROVED' : 'DRAFT',
          submittedById: plant.id
        }
      });

      if (i < 24) {
        await tx.airEmissionLog.create({
          data: {
            organizationId: org.id,
            facilityId: fac.id,
            periodId: per.id,
            stackId: `STACK-${fac.city.slice(0, 3).toUpperCase()}-0${(i % 3) + 1}`,
            pollutant: airPolls[i % airPolls.length],
            quantityKg: Number((12.5 + (i % 7) * 4.3).toFixed(2)),
            spcbLimitNote: 'Within MPCB / SPCB Consent to Operate limit',
            status: 'APPROVED',
            submittedById: plant.id
          }
        });
      }

      if (i < 20) {
        await tx.materialLog.create({
          data: {
            organizationId: org.id,
            facilityId: fac.id,
            periodId: per.id,
            materialName: ['Alloy Steel Billets', 'Recycled Aluminium Ingots', 'HDPE Export Crates', 'Forged Carbon Steel'][i % 4],
            isPackagingEpr: i % 4 === 2,
            origin: matOrigins[i % matOrigins.length],
            quantityMt: Number((45 + (i % 6) * 18.5).toFixed(1)),
            linkedScope3Tco2e: Number((62 + i * 3.4).toFixed(2)),
            status: 'APPROVED',
            submittedById: plant.id
          }
        });
      }
    }

    // 6. Targets + 8 MACC Projects
    const target = await tx.target.create({
      data: {
        organizationId: org.id,
        name: 'FY2030 SBTi SME Absolute Scope 1+2 (−45%)',
        targetType: 'ABSOLUTE',
        scopeCoverage: 'SCOPE_1_AND_2_LOCATION',
        framework: 'SBTI_SME_ROUTE',
        baseYear: 'FY2024-25',
        targetYear: 'FY2029-30',
        baseValue: 4850,
        originalBaseValue: 4850,
        targetReductionPct: 45,
        targetValue: 2667.5,
        status: 'ON_TRACK',
        ownerId: lead.id
      }
    });

    const maccProjects = [
      { title: '500 kWp Rooftop Solar (Pune)', lever: 'ONSITE_SOLAR' as const, save: 495, capex: 18500000, opex: -6200000, mac: -8788, pb: 3.0, status: 'IN_PROGRESS' as const },
      { title: 'VFD Retrofits on Air Compressors', lever: 'ENERGY_EFFICIENCY' as const, save: 165, capex: 2400000, opex: -1450000, mac: -7333, pb: 1.7, status: 'COMPLETED' as const },
      { title: 'Open Access Wind-Solar Hybrid PPA', lever: 'PPA_OPEN_ACCESS' as const, save: 820, capex: 1500000, opex: -3800000, mac: -4451, pb: 0.4, status: 'IN_PROGRESS' as const },
      { title: 'Waste Heat Recovery on Heat-Treat Kiln', lever: 'PROCESS_OPTIMIZATION' as const, save: 240, capex: 6800000, opex: -1800000, mac: -4667, pb: 3.8, status: 'PLANNED' as const },
      { title: 'HSD Boiler Switch to Biomass Briquettes', lever: 'FUEL_SWITCH' as const, save: 310, capex: 5200000, opex: -950000, mac: -1387, pb: 5.5, status: 'PLANNED' as const },
      { title: 'EV Forklifts & Intra-Plant Logistics', lever: 'FLEET_ELECTRIFICATION' as const, save: 85, capex: 4600000, opex: -320000, mac: 1647, pb: 14.4, status: 'PLANNED' as const },
      { title: 'Low-GWP R-32 Chiller Replacement', lever: 'REFRIGERANT_SWAP' as const, save: 110, capex: 7200000, opex: -120000, mac: 5455, pb: 60.0, status: 'DELAYED' as const },
      { title: 'Green Steel Supplier Engagement Program', lever: 'SUPPLIER_ENGAGEMENT' as const, save: 420, capex: 1200000, opex: 2400000, mac: 6000, pb: null, status: 'PLANNED' as const }
    ];
    for (const mp of maccProjects) {
      await tx.reductionAction.create({
        data: {
          organizationId: org.id,
          targetId: target.id,
          facilityId: facilities[0].id,
          domain: 'FUEL',
          lever: mp.lever,
          title: mp.title,
          ownerId: lead.id,
          status: mp.status,
          delayReason: mp.status === 'DELAYED' ? 'Awaiting OEM R-32 compressor delivery slot.' : null,
          expectedSavingTco2e: mp.save,
          netExpectedSavingTco2e: mp.save,
          capexInr: mp.capex,
          annualOpexDeltaInr: mp.opex,
          lifetimeYears: 10,
          paybackYears: mp.pb,
          macInrPerTco2e: mp.mac,
          endDate: new Date('2028-03-31T00:00:00Z')
        }
      });
    }

    // 7. Suppliers, PCF Requests, BRSR Financials, Scope 2 Instruments, Green Credits
    const supNames = [
      ['Kalyani Specialty Steels Ltd', 'esg@kalyanisteels.in', 'Alloy Steel'],
      ['Hindalco Extrusions India', 'sustainability@hindalco-demo.in', 'Aluminium'],
      ['Mahindra Logistics Green', 'carbon@mlogistics-demo.in', 'Freight & Logistics'],
      ['Supreme Industrial Packaging', 'compliance@supreme-demo.in', 'EPR Packaging'],
      ['Jindal Stainless Forgings', 'pcf@jindal-demo.in', 'Stainless Steel'],
      ['Castrol Industrial Lubricants', 'env@castrol-demo.in', 'Chemicals & Oils'],
      ['Tata Steel Downstream', 'brsr@tatasteel-demo.in', 'Flat Steel'],
      ['Kirloskar Foundry Works', 'ops@kirloskar-demo.in', 'Iron Castings']
    ];
    for (let i = 0; i < supNames.length; i++) {
      const [name, email, category] = supNames[i];
      const sup = await tx.supplier.create({
        data: { organizationId: org.id, name, contactEmail: email, category, isTop2PctPartner: i < 4, tradeSharePct: Number((14.5 - i * 1.4).toFixed(1)) }
      });
      if (i < 4) {
        await tx.supplierPcfRequest.create({
          data: {
            organizationId: org.id,
            supplierId: sup.id,
            productDescription: `${category} — Primary Cradle-to-Gate PCF`,
            tokenHash: sha256(`demo-supplier-token-${i}-${Date.now()}`),
            expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            status: i < 2 ? 'SUBMITTED' : 'SENT',
            otpVerifiedAt: i < 2 ? new Date() : null,
            submittedFactorVal: i < 2 ? Number((1.85 + i * 0.42).toFixed(3)) : null,
            submittedUnit: i < 2 ? 'kg' : null,
            methodologyNote: i < 2 ? 'ISO 14067 cradle-to-gate verified by third-party ACVA.' : null,
            requestedById: lead.id
          }
        });
      }
    }

    for (const fy of [
      { fy: 'FY2023-24', rev: 1420000000, ppp: 20.22, yr: 2023 },
      { fy: 'FY2024-25', rev: 1685000000, ppp: 20.48, yr: 2024 },
      { fy: 'FY2025-26', rev: 1940000000, ppp: 20.66, yr: 2025 }
    ]) {
      await tx.financialYearMetrics.upsert({
        where: { organizationId_financialYear: { organizationId: org.id, financialYear: fy.fy } },
        create: { organizationId: org.id, financialYear: fy.fy, revenueInr: fy.rev, imfPppFactor: fy.ppp, pppReferenceYear: fy.yr, pppAdjustedRevenueUsd: Number((fy.rev / fy.ppp).toFixed(2)), certifiedById: finance.id },
        update: {}
      });
    }

    for (const inst of [
      { type: 'I-REC', prov: 'Tata Power Renewable Energy', ref: 'IREC-IN-2025-88412', mwh: 1200, rem: 840 },
      { type: 'Open Access Solar PPA', prov: 'CleanMax Enviro Energy', ref: 'PPA-MH-CHAKAN-09', mwh: 2400, rem: 1920 },
      { type: 'MSEDCL Green Tariff', prov: 'MSEDCL Maharashtra', ref: 'GT-2025-PUNE-441', mwh: 650, rem: 410 }
    ]) {
      await tx.scope2Instrument.create({
        data: {
          organizationId: org.id,
          facilityId: facilities[0].id,
          instrumentType: inst.type,
          providerName: inst.prov,
          certificateRef: inst.ref,
          validFrom: new Date('2025-04-01T00:00:00Z'),
          validTo: new Date('2026-03-31T00:00:00Z'),
          totalMwh: inst.mwh,
          remainingMwh: inst.rem,
          factorKgCo2ePerKwh: 0,
          qualityCriteria: { ghgProtocolScope2QualityVerified: true }
        }
      });
    }

    for (const gc of [
      { cls: 'BEE_CCTS_ICC' as const, reg: 'BEE India CCTS Registry', proj: 'CCTS-MH-2025-01', ser: 'ICC-2025-0001-0250', qty: 250, st: 'ISSUED' as const },
      { cls: 'VOLUNTARY_CARBON_CREDIT' as const, reg: 'Verra VCS', proj: 'VCS-1892-IND-SOLAR', ser: 'VCS-2024-8821-8970', qty: 150, st: 'RETIRED' as const },
      { cls: 'MOEFCC_GREEN_CREDIT' as const, reg: 'MoEFCC ICFRE Green Credit', proj: 'GCP-MH-SAHYADRI-44', ser: 'GCP-2025-0101-0180', qty: 80, st: 'PROCURED' as const }
    ]) {
      await tx.greenEconomyCredit.create({
        data: {
          organizationId: org.id,
          entityId: rootEntity.id,
          instrumentClass: gc.cls,
          registryName: gc.reg,
          projectId: gc.proj,
          serialRange: gc.ser,
          vintageYear: 2025,
          quantity: gc.qty,
          status: gc.st,
          canopyDensityPct: gc.cls === 'MOEFCC_GREEN_CREDIT' ? 52 : null,
          restorationYears: gc.cls === 'MOEFCC_GREEN_CREDIT' ? 6 : null,
          createdById: lead.id
        }
      });
    }

    // 8. Governance, Internal Audit, External Assurance, GST Invoices & Notifications
    await tx.boundaryExclusion.createMany({
      data: [
        { organizationId: org.id, financialYear: 'FY2025-26', scope: 'SCOPE_3', scope3Category: 7, excludedItemName: 'Contract Staff Bicycle Commute', justification: 'Immaterial (< 0.1% of total inventory); zero fossil fuel combustion.', estimatedMaterialityPct: 0.08, status: 'APPROVED', requestedById: lead.id, approvedById: exec.id, approvedAt: new Date() },
        { organizationId: org.id, financialYear: 'FY2025-26', scope: 'SCOPE_1', excludedItemName: 'Handheld Propane Soldering Torches', justification: 'Annual LPG canister usage < 45 kg (< 0.02% materiality threshold).', estimatedMaterialityPct: 0.02, status: 'PENDING', requestedById: lead.id }
      ]
    });

    await tx.inventoryManagementPlan.create({
      data: {
        organizationId: org.id,
        financialYear: 'FY2025-26',
        version: 1,
        consolidationNarrative: 'Operational Control across 3 manufacturing plants and 1 corporate hub in India.',
        methodologyNarrative: 'GHG Protocol Corporate Standard, IPCC 2006 Vol. 2 NCV basis, India CEA v22.0 (0.675 kg CO2/kWh).',
        qaQcProcedures: 'Automated Z-score outlier screening, SHA-256 invoice locking, Maker-Checker sign-off, and quarterly COSO ICSR internal audits.',
        exclusionPolicy: 'Single source cap < 1%, cumulative organizational exclusions capped < 5%.',
        status: 'APPROVED',
        authoredById: lead.id,
        approvedById: exec.id,
        approvedAt: new Date()
      }
    });

    await tx.recalculationRequest.create({
      data: {
        organizationId: org.id,
        triggerType: 'STRUCTURAL_ACQUISITION',
        affectedPeriodIds: [periods[0].id, periods[1].id],
        estimatedImpactPct: 6.4,
        cumulativeImpactPct: 6.4,
        reason: 'Acquisition of Ahmedabad Sanand Foundry exceeded the 5% base-year significance threshold.',
        status: 'PENDING',
        requestedById: lead.id
      }
    });

    await tx.internalAuditFinding.createMany({
      data: [
        { organizationId: org.id, periodId: periods[6].id, controlDomain: 'Scope 2 kWh vs kVAh Billing Controls', status: 'PASS', summary: 'All 12 HT electricity bills verified to use active kWh; zero kVAh entries detected.', auditorId: auditor.id },
        { organizationId: org.id, periodId: periods[6].id, controlDomain: 'DG Set Tank Stock Reconciliation', status: 'DEFICIENCY', summary: 'Pune Plant DG-01 showed a 4.2% variance between tank dip-stick closing stock and invoiced diesel litres.', remediation: 'Install digital flow meter on DG-01 day tank by Q4.', auditorId: auditor.id },
        { organizationId: org.id, periodId: periods[5].id, controlDomain: 'Evidence Vault SHA-256 Completeness', status: 'REMEDIATION_REQUIRED', summary: 'Two Form 10 hazardous waste manifests pending signed transporter copy upload.', auditorId: auditor.id }
      ]
    });

    const eng = await tx.assuranceEngagement.create({
      data: {
        organizationId: org.id,
        verifierUserId: verifier.id,
        verifierFirmName: 'ACVA India Assurance LLP',
        acvaAccreditationNo: 'BEE-ACVA-2025-019',
        engagementType: 'ASSURANCE',
        assuranceLevel: 'REASONABLE',
        standard: 'ICAI_SSAE_3410',
        materialityThresholdPct: 5.0,
        status: 'IN_PROGRESS',
        periodModifiedAlert: true,
        createdById: lead.id
      }
    });

    await tx.assuranceEngagementPeriod.createMany({
      data: periods.slice(0, 6).map((p) => ({ organizationId: org.id, engagementId: eng.id, periodId: p.id }))
    });

    await tx.verificationFinding.createMany({
      data: [
        { organizationId: org.id, engagementId: eng.id, periodId: periods[2].id, severity: 'CLARIFICATION', status: 'OPEN', questionText: 'Please provide NABL calibration certificate for Pune Chakan HT sub-meter MTR-PUN-HT01.', raisedById: verifier.id },
        { organizationId: org.id, engagementId: eng.id, periodId: periods[4].id, severity: 'NONCONFORMITY', status: 'RESPONDED', questionText: 'Confirm why Oct 2025 period was reopened after initial closure.', responseText: 'Reopened solely to record MSEDCL credit note #CN-4412; variance < 0.8%.', raisedById: verifier.id, respondedById: lead.id, respondedAt: new Date() }
      ]
    });

    for (let i = 1; i <= 4; i++) {
      await tx.invoice.create({
        data: {
          organizationId: org.id,
          invoiceNumber: `TRP-2025-00${10 + i}-${Date.now().toString().slice(-3)}`,
          sacCode: '998314',
          subtotalInr: 24999,
          cgstInr: 2249.91,
          sgstInr: 2249.91,
          igstInr: 0,
          totalInr: 29498.82,
          status: 'PAID'
        }
      });
    }

    await tx.notification.createMany({
      data: [
        { organizationId: org.id, userId: lead.id, category: 'APPROVAL', title: '12 Entries Submitted for Review', body: 'Nov 2025 plant entries are ready in Approvals & Period Close.' },
        { organizationId: org.id, userId: lead.id, category: 'SUPPLIER_PCF', title: '2 Supplier PCFs Submitted', body: 'Kalyani Specialty Steels & Hindalco submitted Email-OTP verified PCFs.' },
        { organizationId: org.id, userId: plant.id, category: 'QA_ANOMALY', title: 'Automated Z-Score Anomaly Detected', body: 'High spike (+52%) flagged on fuel/energy ledger — please verify invoice.' }
      ]
    });

    // 9. Lock historical periods to their final SIGNED_OFF / CLOSED / REOPENED statuses AFTER all inserts complete!
    for (let i = 0; i < periods.length; i++) {
      const targetSt = months[i].targetStatus;
      if (targetSt !== 'OPEN') {
        await tx.reportingPeriod.update({
          where: { id: periods[i].id },
          data: {
            status: targetSt,
            closedAt: targetSt === 'CLOSED' || targetSt === 'SIGNED_OFF' ? new Date() : null,
            closedById: targetSt === 'CLOSED' || targetSt === 'SIGNED_OFF' ? lead.id : null,
            signedOffAt: targetSt === 'SIGNED_OFF' ? new Date() : null,
            signedOffById: targetSt === 'SIGNED_OFF' ? exec.id : null,
            reopenCount: targetSt === 'REOPENED' ? 1 : 0,
            lastReopenNote: targetSt === 'REOPENED' ? 'Reopened for revised MSEDCL electricity credit note.' : null
          }
        });
      }
    }
  });

  console.log('Large stress-test dataset seeded successfully across all 9 actors & 55 models!');
}

main()
  .catch((e) => {
    console.error('Large seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());