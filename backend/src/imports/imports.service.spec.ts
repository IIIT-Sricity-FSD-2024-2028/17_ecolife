import { ImportsService } from './imports.service';
import { DbService } from '../database/db.service';
import { createEmptyStore } from '../database/types';

describe('ImportsService preview and retry safety', () => {
  const user = { sub: 'contributor-1', email: 'contributor@example.test', role: 'CONTRIBUTOR' as const, organizationId: 'org-1', departmentId: 'department-1', isOwner: false };
  const file = (contents: string) => ({ originalname: 'usage.csv', buffer: Buffer.from(contents) }) as Express.Multer.File;
  const csv = 'resourceTypeName,quantity,unit,periodStart,periodEnd,notes\nElectricity,10,kWh,2026-01-01,2026-01-31,January\nUnknown,2,kWh,2026-01-01,2026-01-31,Bad';

  it('previews rows without mutation and prevents a retry from creating duplicates', () => {
    const store = createEmptyStore();
    let sequence = 0;
    const db = { store, persist: jest.fn(), id: jest.fn(() => `id-${++sequence}`), now: jest.fn(() => '2026-10-14T00:00:00.000Z') } as unknown as DbService;
    store.resourceTypes.push({ id: 'type-1', name: 'Electricity', category: 'ELECTRICITY', description: null, evidenceThreshold: null, units: [{ unit: 'kWh', isDefault: true }], isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    const resources = { findOneType: (id: string) => store.resourceTypes.find((type) => type.id === id)!, isUnitCompatible: (id: string, unit: string) => id === 'type-1' && unit === 'kWh' };
    const service = new ImportsService(db, { log: jest.fn() } as never, resources as never);

    const preview = service.previewCsv(user, file(csv));
    expect(preview.summary).toEqual({ valid: 1, invalid: 1, duplicates: 0, conflicts: 0 });
    expect(store.resourceRecords).toHaveLength(0);

    const first = service.importCsv(user, file(csv));
    expect(first.batch.successRows).toBe(1);
    expect(first.batch.errorRows).toBe(1);
    expect(store.resourceRecords).toHaveLength(1);

    const retry = service.importCsv(user, file(csv));
    expect(retry.batch.successRows).toBe(0);
    expect(retry.batch.errorsJson).toEqual(expect.arrayContaining([expect.objectContaining({ classification: 'duplicate' })]));
    expect(store.resourceRecords).toHaveLength(1);
  });

  it('classifies a non-import record for the same resource and period as a conflict', () => {
    const store = createEmptyStore();
    const db = { store, persist: jest.fn(), id: jest.fn(() => 'id'), now: jest.fn(() => '2026-10-14T00:00:00.000Z') } as unknown as DbService;
    store.resourceTypes.push({ id: 'type-1', name: 'Electricity', category: 'ELECTRICITY', description: null, evidenceThreshold: null, units: [{ unit: 'kWh', isDefault: true }], isActive: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    store.resourceRecords.push({ id: 'manual-1', organizationId: 'org-1', departmentId: 'department-1', locationId: null, resourceTypeId: 'type-1', quantity: 3, unit: 'kWh', cost: null, periodStart: '2026-01-01', periodEnd: '2026-01-31', notes: null, status: 'DRAFT', evidenceRequirement: 'NOT_REQUIRED', createdById: user.sub, submittedAt: null, lockedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' });
    const resources = { isUnitCompatible: () => true, findOneType: () => store.resourceTypes[0] };
    const service = new ImportsService(db, { log: jest.fn() } as never, resources as never);

    const preview = service.previewCsv(user, file('resourceTypeName,quantity,unit,periodStart,periodEnd\nElectricity,10,kWh,2026-01-01,2026-01-31'));
    expect(preview.summary).toEqual({ valid: 0, invalid: 0, duplicates: 0, conflicts: 1 });
    expect(store.resourceRecords).toHaveLength(1);
  });
});
