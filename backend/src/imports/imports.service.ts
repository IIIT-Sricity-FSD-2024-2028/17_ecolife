import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { isAfter, isBefore, isValid } from 'date-fns';
import { DbService } from '../database/db.service';
import { AuditLogService } from '../database/audit-log.service';
import { ResourcesService } from '../resources/resources.service';
import { AuthenticatedOrgUser } from '../auth/decorators/current-user.decorator';

export interface RowError {
  row: number;
  errors: string[];
}

const EXPECTED_COLUMNS = ['resourceTypeName', 'quantity', 'unit', 'periodStart', 'periodEnd'];

@Injectable()
export class ImportsService {
  constructor(
    private readonly db: DbService,
    private readonly auditLog: AuditLogService,
    private readonly resourcesService: ResourcesService,
  ) {}

  importCsv(user: AuthenticatedOrgUser, file: Express.Multer.File) {
    if (!user.departmentId) {
      throw new BadRequestException('Your account is not assigned to a department yet.');
    }

    let records: Record<string, string>[];
    try {
      records = parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      throw new BadRequestException('Could not parse this file as CSV.');
    }
    if (records.length === 0) {
      throw new BadRequestException('The CSV file contains no data rows.');
    }

    const missingColumns = EXPECTED_COLUMNS.filter((col) => !(col in records[0]));
    if (missingColumns.length > 0) {
      throw new BadRequestException(`CSV is missing required columns: ${missingColumns.join(', ')}.`);
    }

    const typesByName = new Map(this.db.store.resourceTypes.map((t) => [t.name.toLowerCase(), t]));
    const rowErrors: RowError[] = [];
    const validRows: {
      resourceTypeId: string;
      quantity: number;
      unit: string;
      cost: number | null;
      periodStart: string;
      periodEnd: string;
      notes: string | null;
    }[] = [];

    records.forEach((row, i) => {
      const rowNum = i + 2;
      const errors: string[] = [];
      const resourceType = typesByName.get((row.resourceTypeName || '').toLowerCase());

      if (!resourceType) errors.push(`Unknown resource type: "${row.resourceTypeName}"`);

      const quantity = Number(row.quantity);
      if (!row.quantity || isNaN(quantity) || quantity <= 0) {
        errors.push(`Invalid quantity: "${row.quantity}"`);
      }

      if (resourceType && row.unit && !this.resourcesService.isUnitCompatible(resourceType.id, row.unit)) {
        errors.push(`Unit "${row.unit}" is not valid for resource type "${row.resourceTypeName}"`);
      } else if (!row.unit) {
        errors.push('Unit is required');
      }

      let cost: number | null = null;
      if (row.cost) {
        cost = Number(row.cost);
        if (isNaN(cost) || cost < 0) {
          errors.push(`Invalid cost: "${row.cost}"`);
          cost = null;
        }
      }

      const periodStart = new Date(row.periodStart);
      const periodEnd = new Date(row.periodEnd);
      if (!row.periodStart || !isValid(periodStart)) errors.push(`Invalid periodStart: "${row.periodStart}"`);
      if (!row.periodEnd || !isValid(periodEnd)) errors.push(`Invalid periodEnd: "${row.periodEnd}"`);
      if (isValid(periodStart) && isValid(periodEnd) && isBefore(periodEnd, periodStart)) {
        errors.push('periodEnd cannot be before periodStart');
      }
      if (isValid(periodStart) && isAfter(periodStart, new Date())) {
        errors.push('Cannot log usage for a future period');
      }

      if (errors.length > 0) {
        rowErrors.push({ row: rowNum, errors });
      } else {
        validRows.push({
          resourceTypeId: resourceType!.id,
          quantity,
          unit: row.unit,
          cost,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          notes: row.notes || null,
        });
      }
    });

    const createdIds: string[] = [];
    for (const row of validRows) {
      const resourceType = this.resourcesService.findOneType(row.resourceTypeId);
      const evidenceRequirement =
        resourceType.evidenceThreshold !== null && row.quantity > resourceType.evidenceThreshold
          ? 'REQUIRED'
          : 'NOT_REQUIRED';

      const now = this.db.now();
      const record = {
        id: this.db.id(),
        organizationId: user.organizationId,
        departmentId: user.departmentId,
        locationId: null,
        resourceTypeId: row.resourceTypeId,
        quantity: row.quantity,
        unit: row.unit,
        cost: row.cost,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        notes: row.notes,
        status: 'DRAFT' as const,
        evidenceRequirement: evidenceRequirement as 'REQUIRED' | 'NOT_REQUIRED',
        createdById: user.sub,
        submittedAt: null,
        lockedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.db.store.resourceRecords.push(record);
      createdIds.push(record.id);
    }

    const batch = {
      id: this.db.id(),
      organizationId: user.organizationId,
      initiatedById: user.sub,
      fileName: file.originalname,
      totalRows: records.length,
      successRows: validRows.length,
      errorRows: rowErrors.length,
      errorsJson: rowErrors.length > 0 ? rowErrors : null,
      status: 'completed',
      createdAt: this.db.now(),
      completedAt: this.db.now(),
    };
    this.db.store.importBatches.push(batch);
    this.db.persist();

    this.auditLog.log({
      organizationId: user.organizationId,
      orgUserId: user.sub,
      action: 'import.csv_processed',
      entityType: 'import_batch',
      entityId: batch.id,
      metadata: { total: records.length, success: validRows.length, errors: rowErrors.length },
    });

    return { batch, createdRecordIds: createdIds };
  }

  findAll(user: AuthenticatedOrgUser) {
    return this.db.store.importBatches
      .filter((b) => b.organizationId === user.organizationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  findOne(user: AuthenticatedOrgUser, id: string) {
    const batch = this.db.store.importBatches.find((b) => b.id === id && b.organizationId === user.organizationId);
    if (!batch) throw new NotFoundException('Import batch not found.');
    return batch;
  }
}
