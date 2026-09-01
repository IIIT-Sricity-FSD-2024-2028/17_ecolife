import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { Entity } from './crud.types';
import { Alert, Department, EmissionFactor, FactorVersion, ImpactCalculation, ImpactResult, ImportBatch, ImportError, Plan, ResourceRecord, ResourceType, Department as RorizonDepartment, Report, RorizonDb, Subscription, Submission, Unit, User } from '../in-memory/entities';
import { seedDb } from '../in-memory/seed';

@Injectable()
export class InMemoryStoreService {
  private readonly dbFilePath = join(process.cwd(), 'data', 'rorizon-db.json');
  private state: RorizonDb = this.loadInitialState();

  private loadInitialState(): RorizonDb {
    try {
      if (existsSync(this.dbFilePath)) {
        const raw = readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return this.normalize(parsed);
        }
      }
    } catch (error) {
      console.warn('[InMemoryStoreService] Could not read disk DB, using seed state:', error);
    }
    const seeded = this.normalize(seedDb());
    this.saveStateToDisk(seeded);
    return seeded;
  }

  private saveStateToDisk(stateToSave?: RorizonDb): void {
    try {
      const data = stateToSave || this.state;
      if (!data) return;
      const dir = dirname(this.dbFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.dbFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.warn('[InMemoryStoreService] Failed to persist state to disk:', error);
    }
  }


  snapshot(role?: string, userId?: string): RorizonDb {
    const snapshot = structuredClone(this.state);
    if (role !== 'Super User' && role !== 'COO') {
      snapshot.users = snapshot.users.map((user) =>
        String(user.id) === String(userId || '')
          ? user
          : { ...user, password: '' },
      );
    }
    return snapshot;
  }

  replace(snapshot: Partial<RorizonDb>): RorizonDb {
    if (Array.isArray(snapshot.users)) {
      snapshot.users = snapshot.users.map((incomingUser) => {
        const existingUser = this.state.users.find(
          (u) => String(u.id) === String(incomingUser.id) || u.email?.toLowerCase() === incomingUser.email?.toLowerCase(),
        );
        const password = incomingUser.password?.trim() ? incomingUser.password : (existingUser?.password || 'Default@123');
        return { ...incomingUser, password };
      });
    }
    this.state = this.normalize({ ...this.state, ...snapshot });
    this.log('Runtime Snapshot Sync', 'Success', 'green', 'System');
    return this.snapshot();
  }

  list<T extends Entity>(key: keyof RorizonDb): T[] {
    return structuredClone(this.state[key] as T[]);
  }

  find<T extends Entity>(key: keyof RorizonDb, id: string | number): T {
    const entity = (this.state[key] as T[]).find((item) => String(item.id) === String(id));
    if (!entity) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    return structuredClone(entity);
  }

  create<T extends Entity>(key: keyof RorizonDb, payload: Omit<T, 'id'> & Partial<Entity>, prefix: string): T {
    const collection = this.state[key] as T[];
    const id = payload.id ?? `${prefix}-${randomUUID().slice(0, 8)}`;
    if (collection.some((item) => String(item.id) === String(id))) {
      throw new BadRequestException(`${String(key)} record ${id} already exists.`);
    }
    this.assertUnique(key, payload as Partial<Entity>, id);
    const entity = { ...payload, id } as T;
    collection.unshift(entity);
    this.normalize(this.state);
    this.log(`${String(key)} Created`, 'Success', 'green');
    return structuredClone(entity);
  }

  update<T extends Entity>(key: keyof RorizonDb, id: string | number, payload: Partial<T>): T {
    if (key === 'auditLogs') throw new BadRequestException('Audit logs are immutable and cannot be updated.');
    const collection = this.state[key] as T[];
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index < 0) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    this.assertUnique(key, payload as Partial<Entity>, id);

    let patch = { ...payload };
    if (key === 'users') {
      const existingUser = collection[index] as unknown as User;
      const incomingPassword = (payload as unknown as User).password;
      if (!incomingPassword || !String(incomingPassword).trim()) {
        delete (patch as any).password; // Preserve existing password if update payload lacks a new password
      }
    }

    if (key === 'resourceRecords') {
      const existingRecord = collection[index] as unknown as ResourceRecord;
      const proposedRecord: ResourceRecord = { ...existingRecord, ...(patch as Partial<ResourceRecord>) };

      if ((patch as any).quantity !== undefined || (patch as any).quantity === null) {
        if (!Number.isFinite(Number(proposedRecord.quantity)) || Number(proposedRecord.quantity) <= 0) {
          throw new BadRequestException('quantity must be greater than zero.');
        }
      }

      const resType = this.requireResourceType(proposedRecord.resourceTypeId);
      const unit = this.requireUnit(proposedRecord.unitId);
      if (!this.isCompatible(resType.id, unit.id)) {
        throw new BadRequestException(`${unit.name} is not a valid unit for ${resType.name}.`);
      }

      if (proposedRecord.submissionId) {
        const sub = this.state.submissions.find((s) => s.id === proposedRecord.submissionId);
        if (!sub) throw new NotFoundException(`Submission ${proposedRecord.submissionId} not found.`);
        if (proposedRecord.period && proposedRecord.period !== sub.period) {
          throw new BadRequestException(`Resource record period (${proposedRecord.period}) does not match submission period (${sub.period}).`);
        }
        if (proposedRecord.organizationId && proposedRecord.organizationId !== sub.organizationId) {
          throw new BadRequestException('Resource record organization does not match submission organization.');
        }
        if (proposedRecord.departmentId && proposedRecord.departmentId !== sub.departmentId) {
          throw new BadRequestException('Resource record department does not match submission department.');
        }
      }

      if (proposedRecord.evidenceId) {
        const ev = this.state.evidences.find((e) => e.id === proposedRecord.evidenceId);
        if (!ev) throw new NotFoundException(`Evidence ${proposedRecord.evidenceId} not found.`);
        if (ev.submissionId && proposedRecord.submissionId && ev.submissionId !== proposedRecord.submissionId) {
          throw new BadRequestException('Evidence submission does not match resource record submission.');
        }
      }

      // PREPARE CALCULATION & RESOLVE FACTOR WITHOUT MUTATING STORE STATE FIRST
      const preparedCalc = this.prepareImpactResult(proposedRecord, this.state);
      if (!preparedCalc) {
        throw new BadRequestException('No active emission factor found for the selected resource type, unit, and period.');
      }

      // ALL VALIDATIONS & PREPARATIONS SUCCEEDED -> COMMIT ALL STATE ATOMICALLY
      collection[index] = proposedRecord as unknown as T;

      const version = this.state.factorVersions.find((v) => v.id === preparedCalc.factor.versionId);
      if (version) version.locked = true;

      this.state.impactCalculations = this.state.impactCalculations.filter((item) => item.resourceRecordId !== proposedRecord.id);
      this.state.impactResults = this.state.impactResults.filter((item) => item.resourceRecordId !== proposedRecord.id);

      this.state.impactCalculations.unshift(preparedCalc.calculation);
      this.state.impactResults.unshift(preparedCalc.result);

      if (proposedRecord.submissionId) {
        this.syncSubmissionTotals(proposedRecord.submissionId);
      }
      this.normalize(this.state);
      this.log('resourceRecords Updated', 'Success', 'green');
      return structuredClone(collection[index]);
    }

    collection[index] = { ...collection[index], ...patch };
    if (key === 'users') {
      const updatedUser = collection[index] as unknown as User;
      if (updatedUser.role === 'COO' && (patch as any).status) {
        const org = this.state.organizations.find((o) => String(o.cooUserId) === String(updatedUser.id) || o.id === updatedUser.organizationId);
        if (org) {
          org.accountStatus = (patch as any).status;
          org.status = (patch as any).status === 'Inactive' ? 'Inactive' : 'Active';
          org.statusType = (patch as any).status === 'Inactive' ? 'amber' : 'green';
          this.state.users.forEach((u) => {
            if (u.organizationId === org.id && u.role !== 'Super User') {
              u.status = (patch as any).status;
            }
          });
        }
      }
    }

    this.normalize(this.state);
    this.log(`${String(key)} Updated`, 'Success', 'green');
    return structuredClone(collection[index]);

  }

  remove<T extends Entity>(key: keyof RorizonDb, id: string | number): T {
    if (key === 'auditLogs') throw new BadRequestException('Audit logs are immutable and cannot be deleted.');
    const collection = this.state[key] as T[];
    const index = collection.findIndex((item) => String(item.id) === String(id));
    if (index < 0) throw new NotFoundException(`${String(key)} record ${id} not found.`);
    const [entity] = collection.splice(index, 1);
    this.normalize(this.state);
    this.log(`${String(key)} Deleted`, 'Success', 'green');
    return structuredClone(entity);
  }

  authenticate(email: string, password: string): User {
    const user = this.state.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      this.log(`Failed login attempt for ${email}`, 'Blocked', 'red', 'Anonymous');
      throw new BadRequestException('Invalid email or password.');
    }
    if (user.status !== 'Active') throw new BadRequestException('Account is not active.');

    if (user.organizationId && user.role !== 'Super User') {
      const org = this.state.organizations.find((o) => o.id === user.organizationId);
      if (org && (org.accountStatus === 'Inactive' || org.status === 'Inactive')) {
        this.log(`Login blocked for ${email}: Organization is inactive`, 'Blocked', 'amber', `${user.name} (${user.role})`);
        throw new BadRequestException('Your organization account is inactive. Login is restricted.');
      }
    }
    if (this.state.globalSettings?.flagMain && user.role !== 'Super User') {
      this.log(`Maintenance-mode login blocked for ${email}`, 'Blocked', 'amber', `${user.name} (${user.role})`);
      throw new BadRequestException('Maintenance mode is active. Only Super User accounts can sign in right now.');
    }
    user.lastLogin = new Date().toISOString();
    this.log('Successful login', 'Success', 'green', `${user.name} (${user.role})`);
    return structuredClone(user);
  }


  lockSubmission(payload: Partial<Submission>): Submission {
    if (!payload.departmentId || !payload.organizationId) throw new BadRequestException('departmentId and organizationId are required.');
    if (!payload.resources?.length && !payload.resourceRecordIds?.length) throw new BadRequestException('At least one resource or resourceRecordId is required.');
    const department = this.state.departments.find((entry) => entry.id === payload.departmentId);
    if (!department) throw new NotFoundException('Department not found.');
    if (department.orgId !== payload.organizationId) {
      throw new BadRequestException('Department does not belong to the selected organization.');
    }
    const period = payload.period || new Date().toISOString().slice(0, 7);
    const existingSubmission = this.state.submissions.find((entry) =>
      entry.departmentId === payload.departmentId &&
      entry.organizationId === payload.organizationId &&
      entry.period === period
    );

    const submissionId = payload.id || existingSubmission?.id || `sub-${randomUUID().slice(0, 8)}`;

    const existingRecords = (payload.resourceRecordIds || []).map((id) => {
      const record = this.state.resourceRecords.find((entry) => entry.id === id);
      if (!record) throw new NotFoundException(`Resource record ${id} not found.`);
      if (record.organizationId !== payload.organizationId || record.departmentId !== payload.departmentId) {
        throw new BadRequestException(`Resource record ${id} does not belong to the submission organization and department.`);
      }
      if (record.status !== 'Ready') throw new BadRequestException(`Resource record ${id} is not ready for submission.`);
      return record;
    });
    const recordResources = existingRecords.map((record) => {
      const resourceType = this.requireResourceType(record.resourceTypeId);
      const unit = this.requireUnit(record.unitId);
      return {
        type: resourceType.name,
        unit: unit.name,
        qty: record.quantity,
        resourceTypeId: resourceType.id,
        unitId: unit.id,
        evidenceId: record.evidenceId,
      };
    });
    const preparedResources = payload.resources?.length
      ? payload.resources.map((item) => this.prepareResourceLine(item))
      : recordResources;
    const totalConsumption = preparedResources.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const threshold = this.parseAmount(department.threshold || department.target);
    const breach = threshold > 0 && totalConsumption > threshold;
    if (breach && !payload.validation?.deviationReason) {
      throw new BadRequestException('Deviation reason is required when threshold is breached.');
    }

    const submission: Submission = {
      id: submissionId,
      organizationId: payload.organizationId,
      departmentId: payload.departmentId,
      departmentName: department.name,
      managerName: payload.managerName || department.manager,
      managerUserId: payload.managerUserId ?? department.managerUserId,
      period,
      status: payload.status || 'Submitted',
      score: payload.score || 'Evaluating',
      submittedAt: payload.submittedAt || new Date().toISOString(),
      resources: preparedResources,
      totalConsumption,
      totalCO2: 0,
      validation: {
        state: breach ? 'threshold_breach' : payload.validation?.state || 'valid',
        anomalyScore: payload.validation?.anomalyScore || 0,
        deviationReason: payload.validation?.deviationReason || '',
      },
      locked: true,
      dataReadinessStatus: 'Ready',
      calculationStatus: 'Pending',
      resourceRecordIds: existingRecords.map((record) => record.id),
    };

    const existingSubIdx = this.state.submissions.findIndex((s) => s.id === submission.id);
    if (existingSubIdx >= 0) {
      this.state.submissions[existingSubIdx] = submission;
    } else {
      this.state.submissions.unshift(submission);
    }

    if (existingRecords.length) {
      existingRecords.forEach((record) => {
        record.submissionId = submission.id;
        const result = this.calculateRecord(record);
        if (result) submission.impactResultIds?.push(result.id);
      });
      this.syncSubmissionTotals(submission.id);
    } else {
      this.createRecordsAndResultsForSubmission(submission);
    }

    const existingMgrIdx = this.state.managerSubmissions.findIndex((s) => s.id === submission.id);
    const mgrSubEntry = {
      id: submission.id,
      period: submission.period,
      status: submission.status,
      score: submission.score,
      submittedAt: submission.submittedAt,
      resources: submission.resources,
      totalConsumption: submission.totalConsumption,
      totalCO2: submission.totalCO2,
    };
    if (existingMgrIdx >= 0) {
      this.state.managerSubmissions[existingMgrIdx] = mgrSubEntry;
    } else {
      this.state.managerSubmissions.unshift(mgrSubEntry);
    }
    department.current = `${submission.totalConsumption.toLocaleString()} Units`;
    department.co2 = submission.totalCO2.toLocaleString();
    department.status = breach ? 'Exceeded' : 'Within Target';
    department.statusType = breach ? 'red' : 'green';
    this.upsertTracker(department, submission);
    if (breach) this.createBreachAlert(department, submission, threshold);
    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Analyst',
      title: 'New Locked Submission',
      body: `${department.name} submitted ${submission.period} resource data.`,
      timestamp: 'Just now',
      read: false,
      details: `Submission ${submission.id} is ready for analyst review.`,
    });
    this.recalculateOrganization(department.orgId);
    this.log(`Locked Submission: ${department.name} ${submission.period}`, breach ? 'Warning' : 'Success', breach ? 'amber' : 'green', `${submission.managerName} (Manager)`);
    return structuredClone(submission);
  }

  createResourceRecord(payload: Partial<ResourceRecord>): ResourceRecord {
    const department = this.validateDepartment(payload.organizationId, payload.departmentId);
    const resourceType = this.requireResourceType(payload.resourceTypeId);
    const unit = this.requireUnit(payload.unitId);
    if (!this.isCompatible(resourceType.id, unit.id)) {
      throw new BadRequestException(`${unit.name} is not a valid unit for ${resourceType.name}.`);
    }
    if (!Number.isFinite(Number(payload.quantity)) || Number(payload.quantity) <= 0) {
      throw new BadRequestException('quantity must be greater than zero.');
    }
    if (!payload.period?.trim()) throw new BadRequestException('period is required.');
    if (!payload.activityDate?.trim()) throw new BadRequestException('activityDate is required.');

    const record: ResourceRecord = {
      id: payload.id || `rec-${randomUUID().slice(0, 8)}`,
      submissionId: payload.submissionId,
      organizationId: department.orgId,
      departmentId: department.id,
      resourceTypeId: resourceType.id,
      unitId: unit.id,
      quantity: Number(payload.quantity),
      activityDate: payload.activityDate,
      period: payload.period,
      entryMode: payload.entryMode || 'Manual',
      evidenceId: payload.evidenceId,
      status: payload.status || 'Ready',
      validationErrors: [],
      createdAt: payload.createdAt || new Date().toISOString(),
    };
    const preparedCalc = this.prepareImpactResult(record, this.state);
    if (!preparedCalc) {
      throw new BadRequestException('No active emission factor found for the selected resource type, unit, and period.');
    }

    if (this.state.resourceRecords.some((item) => item.id === record.id)) {
      throw new BadRequestException(`resourceRecords record ${record.id} already exists.`);
    }

    this.state.resourceRecords.unshift(record);

    const version = this.state.factorVersions.find((v) => v.id === preparedCalc.factor.versionId);
    if (version) version.locked = true;

    this.state.impactCalculations.unshift(preparedCalc.calculation);
    this.state.impactResults.unshift(preparedCalc.result);

    if (record.submissionId) this.syncSubmissionTotals(record.submissionId);
    this.log(`Resource Record Calculated: ${resourceType.name}`, 'Success', 'green');
    return structuredClone(record);
  }

  createImportBatch(payload: Partial<ImportBatch> & { rows?: any[] }): ImportBatch {
    const department = this.validateDepartment(payload.organizationId, payload.departmentId);
    if (!payload.fileName?.trim()) throw new BadRequestException('fileName is required.');
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const batch: ImportBatch = {
      id: payload.id || `imp-${randomUUID().slice(0, 8)}`,
      organizationId: department.orgId,
      departmentId: department.id,
      fileName: payload.fileName,
      status: 'Pending',
      createdAt: payload.createdAt || new Date().toISOString(),
      rowCount: rows.length,
      createdRecordIds: [],
    };
    if (this.state.importBatches.some((item) => item.id === batch.id)) {
      throw new BadRequestException(`importBatches record ${batch.id} already exists.`);
    }
    this.state.importBatches.unshift(batch);
    this.state.importErrors = this.state.importErrors.filter((error) => error.batchId !== batch.id);

    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      try {
        const resourceType = row.resourceTypeId
          ? this.requireResourceType(row.resourceTypeId)
          : this.state.resourceTypes.find((entry) => entry.name.toLowerCase() === String(row.resourceType || '').trim().toLowerCase());
        if (!resourceType) throw new BadRequestException('Unknown resource type.');
        const unit = row.unitId
          ? this.requireUnit(row.unitId)
          : this.state.units.find((entry) => entry.name.toLowerCase() === String(row.unit || '').trim().toLowerCase() || entry.code.toLowerCase() === String(row.unit || '').trim().toLowerCase());
        if (!unit) throw new BadRequestException('Unknown unit.');
        if (!this.isCompatible(resourceType.id, unit.id)) throw new BadRequestException(`${unit.name} is not compatible with ${resourceType.name}.`);
        if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0) throw new BadRequestException('Quantity must be greater than zero.');
        if (!this.isValidDate(row.activityDate)) throw new BadRequestException('Activity date is missing or invalid.');
        if (!String(row.period || '').trim()) throw new BadRequestException('Period is required.');
        const record = this.createResourceRecord({
          organizationId: department.orgId,
          departmentId: department.id,
          resourceTypeId: resourceType.id,
          unitId: unit.id,
          quantity: Number(row.quantity),
          activityDate: row.activityDate,
          period: row.period,
          entryMode: 'Import',
          status: 'Ready',
        });
        batch.createdRecordIds.push(record.id);
      } catch (error) {
        this.state.importErrors.unshift({
          id: `impe-${randomUUID().slice(0, 8)}`,
          batchId: batch.id,
          rowNumber,
          field: 'row',
          message: error instanceof Error ? error.message : 'Row failed validation.',
        });
      }
    });

    batch.status = batch.createdRecordIds.length
      ? (batch.createdRecordIds.length === rows.length ? 'Processed' : 'Processed')
      : 'Failed';
    this.log(`Import Batch Processed: ${batch.fileName}`, batch.status === 'Failed' ? 'Warning' : 'Success', batch.status === 'Failed' ? 'amber' : 'green');
    return structuredClone(batch);
  }

  recalculateRecord(id: string): ImpactResult {
    const record = this.state.resourceRecords.find((entry) => entry.id === id);
    if (!record) throw new NotFoundException('Resource record not found.');
    const result = this.calculateRecord(record);
    if (!result) throw new BadRequestException('No active emission factor is available for this resource record.');
    if (record.submissionId) this.syncSubmissionTotals(record.submissionId);
    return structuredClone(result);
  }

  removeFactorVersion(id: string): FactorVersion {
    if (this.state.impactResults.some((result) => result.factorVersionId === id)) {
      return this.update<FactorVersion>('factorVersions', id, { status: 'Archived', locked: true } as Partial<FactorVersion>);
    }
    return this.remove<FactorVersion>('factorVersions', id);
  }

  removeResourceCategory(id: string) {
    if (this.state.resourceTypes.some((type) => type.categoryId === id)) {
      return this.update('resourceCategories', id, { active: false } as any);
    }
    return this.remove('resourceCategories', id);
  }

  removeUnit(id: string) {
    const isReferenced = this.state.resourceTypes.some((type) => type.defaultUnitId === id) ||
      this.state.resourceUnitCompatibilities.some((link) => link.unitId === id) ||
      this.state.resourceRecords.some((record) => record.unitId === id) ||
      this.state.impactResults.some((result) => result.unitId === id) ||
      this.state.emissionFactors.some((factor) => factor.unitId === id);
    if (isReferenced) return this.update('units', id, { active: false } as any);
    return this.remove('units', id);
  }

  removeResourceType(id: string) {
    const isReferenced = this.state.resourceRecords.some((record) => record.resourceTypeId === id) ||
      this.state.impactResults.some((result) => result.resourceTypeId === id) ||
      this.state.emissionFactors.some((factor) => factor.resourceTypeId === id);
    if (isReferenced) return this.update('resourceTypes', id, { active: false } as any);
    this.state.resourceUnitCompatibilities = this.state.resourceUnitCompatibilities.filter((link) => link.resourceTypeId !== id);
    return this.remove('resourceTypes', id);
  }

  removeCompatibility(id: string) {
    const compatibility = this.state.resourceUnitCompatibilities.find((entry) => entry.id === id);
    if (!compatibility) throw new NotFoundException('Compatibility not found.');
    const isReferenced = this.state.resourceRecords.some((record) =>
      record.resourceTypeId === compatibility.resourceTypeId && record.unitId === compatibility.unitId
    );
    if (isReferenced) return this.update('resourceUnitCompatibilities', id, { active: false } as any);
    return this.remove('resourceUnitCompatibilities', id);
  }

  removeFactorSource(id: string) {
    const isReferenced = this.state.factorVersions.some((version) => version.sourceId === id) ||
      this.state.emissionFactors.some((factor) => factor.sourceId === id) ||
      this.state.impactResults.some((result) => result.factorSourceId === id);
    if (isReferenced) return this.update('factorSources', id, { active: false } as any);
    return this.remove('factorSources', id);
  }

  removeEmissionFactor(id: string) {
    if (this.state.impactResults.some((result) => result.factorId === id)) {
      return this.update('emissionFactors', id, { active: false } as any);
    }
    return this.remove('emissionFactors', id);
  }

  removeResourceRecord(id: string) {
    const record = this.state.resourceRecords.find((r) => String(r.id) === String(id));
    if (!record) throw new NotFoundException(`Resource record ${id} not found.`);

    if (record.submissionId) {
      const sub = this.state.submissions.find((s) => s.id === record.submissionId);
      if (sub && sub.status === 'Approved') {
        // Historical approved submission: preserve historical information per immutability rules
        return this.update('resourceRecords', id, { status: 'Rejected', validationErrors: ['Archived because calculated impact results reference this record.'] } as any);
      }
    }

    // Editable / current submission resource record: clean up calculations and update submission totals
    const index = this.state.resourceRecords.findIndex((r) => String(r.id) === String(id));
    const [deleted] = this.state.resourceRecords.splice(index, 1);

    this.state.impactCalculations = this.state.impactCalculations.filter((c) => c.resourceRecordId !== deleted.id);
    this.state.impactResults = this.state.impactResults.filter((r) => r.resourceRecordId !== deleted.id);

    if (deleted.submissionId) {
      this.syncSubmissionTotals(deleted.submissionId);
    }

    this.log(`Resource Record Deleted: ${deleted.id}`, 'Success', 'green');
    return structuredClone(deleted);
  }

  updateFactorVersion(id: string, payload: Partial<FactorVersion>): FactorVersion {
    const existing = this.state.factorVersions.find((version) => version.id === id);
    if (!existing) throw new NotFoundException('Factor version not found.');
    if (existing.locked && this.state.impactResults.some((result) => result.factorVersionId === id)) {
      const blocked = ['sourceId', 'effectiveFrom', 'effectiveTo', 'name'].some((field) => field in payload);
      if (blocked) throw new BadRequestException('Locked factor version metadata cannot be changed after calculations exist.');
    }
    return this.update<FactorVersion>('factorVersions', id, payload);
  }

  approveSubmission(id: string, approvedBy = 'Analyst'): Submission {
    const submission = this.state.submissions.find((entry) => String(entry.id) === String(id));
    if (!submission) throw new NotFoundException('Submission not found.');
    if (submission.status === 'Approved') throw new BadRequestException('Submission is already approved.');
    if (submission.status === 'Correction Required') throw new BadRequestException('Submission requires correction before it can be approved.');
    if (submission.calculationStatus !== 'Calculated') {
      throw new BadRequestException('Cannot approve submission with calculation errors or uncalculated resource records.');
    }
    submission.status = 'Approved';
    submission.locked = true;
    (submission as any).approvedBy = approvedBy;
    (submission as any).approvedAt = new Date().toISOString();

    const mgrIdx = this.state.managerSubmissions.findIndex((s) => s.id === submission.id);
    if (mgrIdx >= 0) this.state.managerSubmissions[mgrIdx].status = 'Approved';

    const department = this.state.departments.find((d) => d.id === submission.departmentId);
    if (department) department.status = 'Approved';

    this.log(`Submission Approved: ${submission.departmentName} ${submission.period}`, 'Success', 'green', approvedBy);
    return structuredClone(submission);
  }

  requestSubmissionCorrection(id: string, comment: string, requestedBy = 'Analyst'): Submission {
    if (!comment?.trim()) throw new BadRequestException('Correction comment is required.');
    const submission = this.state.submissions.find((entry) => String(entry.id) === String(id));
    if (!submission) throw new NotFoundException('Submission not found.');
    submission.status = 'Correction Required';
    submission.locked = false;
    submission.correctionNotes = comment;
    submission.analystNotes = comment;

    const mgrIdx = this.state.managerSubmissions.findIndex((s) => s.id === submission.id);
    if (mgrIdx >= 0) this.state.managerSubmissions[mgrIdx].status = 'Correction Required';

    const department = this.state.departments.find((d) => d.id === submission.departmentId);
    if (department) department.status = 'Correction Required';

    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Manager',
      organizationId: submission.organizationId,
      departmentId: submission.departmentId,
      title: 'Submission Correction Required',
      body: `Analyst requested correction for ${submission.departmentName} (${submission.period}): ${comment}`,
      timestamp: 'Just now',
      read: false,
      details: comment,
    });

    this.log(`Submission Correction Requested: ${submission.departmentName} ${submission.period}`, 'Warning', 'amber', requestedBy);
    return structuredClone(submission);
  }

  resubmitSubmission(id: string, notes?: string): Submission {
    const submission = this.state.submissions.find((entry) => String(entry.id) === String(id));
    if (!submission) throw new NotFoundException('Submission not found.');
    if (submission.status === 'Approved') throw new BadRequestException('Approved submissions cannot be resubmitted.');
    if (submission.status !== 'Correction Required') throw new BadRequestException('Only submissions in Correction Required status can be resubmitted.');

    this.createRecordsAndResultsForSubmission(submission);
    submission.status = 'Submitted';
    submission.locked = true;
    submission.correctionNotes = '';
    if (notes) submission.analystNotes = notes;
    submission.submittedAt = new Date().toISOString();

    const mgrIdx = this.state.managerSubmissions.findIndex((s) => s.id === submission.id);
    if (mgrIdx >= 0) this.state.managerSubmissions[mgrIdx].status = 'Submitted';

    const department = this.state.departments.find((d) => d.id === submission.departmentId);
    if (department) department.status = 'Submitted';

    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Analyst',
      organizationId: submission.organizationId,
      departmentId: submission.departmentId,
      title: 'Submission Resubmitted by Manager',
      body: `${submission.departmentName} resubmitted data for ${submission.period}.`,
      timestamp: 'Just now',
      read: false,
      details: `Resubmitted on ${submission.submittedAt}.`,
    });

    this.log(`Submission Resubmitted: ${submission.departmentName} ${submission.period}`, 'Success', 'green', `${submission.managerName} (Manager)`);
    return structuredClone(submission);
  }

  createExecutiveReport(dto: Partial<Report>): Report {
    if (!dto.organizationId || !dto.period) {
      throw new BadRequestException('organizationId and period are required to create a report.');
    }
    const org = this.state.organizations.find((o) => o.id === dto.organizationId);
    if (!org) throw new NotFoundException(`Organization ${dto.organizationId} not found.`);

    const sourceIds = Array.isArray(dto.sourceSubmissionIds) ? dto.sourceSubmissionIds : [];
    const sourceSubmissions: Submission[] = [];

    if (sourceIds.length) {
      for (const sid of sourceIds) {
        const sub = this.state.submissions.find((s) => String(s.id) === String(sid));
        if (!sub) throw new BadRequestException(`Source submission ${sid} not found.`);
        if (sub.organizationId !== dto.organizationId) throw new BadRequestException(`Source submission ${sid} does not belong to organization ${org.name}.`);
        if (sub.period !== dto.period) throw new BadRequestException(`Source submission ${sid} period (${sub.period}) does not match report period (${dto.period}).`);
        if (sub.status !== 'Approved' && sub.calculationStatus !== 'Calculated') {
          throw new BadRequestException(`Source submission ${sid} is neither Approved nor Calculated.`);
        }
        sourceSubmissions.push(sub);
      }
    } else {
      const approvedOrgsSubs = this.state.submissions.filter(
        (s) => s.organizationId === dto.organizationId && s.period === dto.period && (s.status === 'Approved' || s.calculationStatus === 'Calculated')
      );
      if (!approvedOrgsSubs.length) {
        throw new BadRequestException(`No Approved or Calculated submissions found for organization ${org.name} in period ${dto.period} to generate a report. Please verify department submissions in Submissions Status first.`);
      }
      sourceSubmissions.push(...approvedOrgsSubs);
    }

    const totalConsumption = sourceSubmissions.reduce((acc, s) => acc + Number(s.totalConsumption || 0), 0);
    const totalCO2 = sourceSubmissions.reduce((acc, s) => acc + Number(s.totalCO2 || 0), 0);

    const existingReport = this.state.reports.find(
      (r) => r.organizationId === dto.organizationId && r.period === dto.period
    );

    if (existingReport) {
      // Upsert existing draft/revision/approved report with latest aggregated department submissions
      existingReport.title = dto.title || existingReport.title || `Executive Emissions Report — ${dto.period}`;
      existingReport.status = 'Under COO Review';
      existingReport.statusClass = 'blue';
      existingReport.analystName = dto.analystName || existingReport.analystName || 'Analyst';
      existingReport.submittedBy = dto.submittedBy || dto.analystName || 'Analyst';
      existingReport.submittedAt = new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      existingReport.sourceSubmissionIds = sourceSubmissions.map((s) => s.id);
      existingReport.content = {
        intro: `Executive Sustainability Report for ${org.name} covering period ${dto.period}. Total active department submissions analyzed: ${sourceSubmissions.length}.`,
        consumption: `Aggregate consumption across departments: ${totalConsumption.toLocaleString()} Units.`,
        emissions: `Total calculated greenhouse gas emissions: ${totalCO2.toLocaleString()} kg CO2e.`,
        comparisons: 'Performance is benchmarked against organizational sustainability targets.',
        conclusions: 'Audit compliance achieved with 100% backend emission factor provenance.',
        ...(existingReport.content || {}),
        ...(dto.content || {})
      };

      this.state.notifications.unshift({
        id: Date.now(),
        role: 'COO',
        organizationId: org.id,
        title: 'Executive Report Updated',
        body: `${existingReport.title} was updated with latest consolidated department data for COO review.`,
        details: `${existingReport.title} updated for period ${dto.period} with ${sourceSubmissions.length} department submission(s).`,
        timestamp: 'Just now',
        read: false
      });
      return structuredClone(existingReport);
    }

    const reportId = dto.id || `rpt-${randomUUID().slice(0, 8)}`;
    const report: Report = {
      id: reportId,
      title: dto.title || `Executive Emissions Report — ${dto.period}`,
      period: dto.period,
      organizationId: dto.organizationId,
      status: 'Under COO Review',
      statusClass: 'blue',
      analystName: dto.analystName || 'Analyst',
      analystUserId: dto.analystUserId || null,
      submittedBy: dto.submittedBy || dto.analystName || 'Analyst',
      submittedAt: new Date().toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      sourceSubmissionIds: sourceSubmissions.map((s) => s.id),
      date: new Date().toISOString().split('T')[0],
      signature: { signedBy: dto.analystName || 'Analyst', signedAt: new Date().toISOString() },
      revision: { required: false, comment: '', requestedBy: '', requestedAt: '' },
      content: {
        intro: `Executive Sustainability Report for ${org.name} covering period ${dto.period}. Total active department submissions analyzed: ${sourceSubmissions.length}.`,
        consumption: `Aggregate consumption across departments: ${totalConsumption.toLocaleString()} Units.`,
        emissions: `Total calculated greenhouse gas emissions: ${totalCO2.toLocaleString()} kg CO2e.`,
        comparisons: 'Performance is benchmarked against organizational sustainability targets.',
        conclusions: 'Audit compliance achieved with 100% backend emission factor provenance.',
        ...(dto.content || {}),
      },
    };

    this.state.reports.unshift(report);
    this.state.notifications.unshift({
      id: Date.now(),
      role: 'COO',
      organizationId: org.id,
      title: 'New Report Pending Executive Approval',
      body: `${report.title} was submitted by Analyst for COO review.`,
      timestamp: 'Just now',
      read: false,
      details: `Report ID: ${report.id}`,
    });

    this.log(`Executive Report Created: ${report.title}`, 'Success', 'green', report.analystName || 'Analyst');
    return structuredClone(report);
  }

  approveReport(id: number | string, approvedBy: string): Report {
    const report = this.state.reports.find((entry) => String(entry.id) === String(id));
    if (!report) throw new NotFoundException('Report not found.');
    if (report.status !== 'Under COO Review') {
      throw new BadRequestException(`Report in status '${report.status}' cannot be approved. Only reports in 'Under COO Review' can be approved.`);
    }
    report.status = 'Approved';
    report.statusClass = 'green';
    report.decisionDate = new Date().toISOString().split('T')[0];
    report.approvedBy = approvedBy || 'COO';
    report.approvedAt = new Date().toISOString();
    report.revision = { required: false, comment: '', requestedBy: '', requestedAt: '' };
    if (!Array.isArray(this.state.notifications)) this.state.notifications = [];
    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Analyst',
      organizationId: report.organizationId,
      title: 'Report Approved by COO',
      body: `${report.title} was approved by ${approvedBy || 'COO'}.`,
      timestamp: 'Just now',
      read: false,
      details: `Approved on ${report.approvedAt}.`,
    });
    this.log(`Report Approved: ${report.title}`, 'Success', 'green', approvedBy || 'COO');
    return structuredClone(report);
  }

  requestReportRevision(id: number | string, comment: string, requestedBy: string): Report {
    if (!comment?.trim()) throw new BadRequestException('Revision comment is required.');
    const report = this.state.reports.find((entry) => String(entry.id) === String(id));
    if (!report) throw new NotFoundException('Report not found.');
    if (report.status !== 'Under COO Review') {
      throw new BadRequestException(`Report in status '${report.status}' cannot be requested for revision. Only reports in 'Under COO Review' can be requested for revision.`);
    }
    report.status = 'Revision Required';
    report.statusClass = 'red';
    report.decisionDate = new Date().toISOString().split('T')[0];
    report.revision = { required: true, comment, requestedBy: requestedBy || 'COO', requestedAt: new Date().toISOString() };
    if (!Array.isArray(this.state.notifications)) this.state.notifications = [];
    this.state.notifications.unshift({
      id: Date.now(),
      role: 'Analyst',
      organizationId: report.organizationId,
      title: 'Report Revision Requested by COO',
      body: `${report.title} was returned for revision: ${comment}`,
      timestamp: 'Just now',
      read: false,
      details: comment,
    });
    this.log(`Report Revision Requested: ${report.title}`, 'Warning', 'amber', requestedBy || 'COO');
    return structuredClone(report);
  }

  resubmitReport(id: string | number, dto: any): Report {
    const report = this.state.reports.find((entry) => String(entry.id) === String(id));
    if (!report) throw new NotFoundException('Report not found.');
    if (report.status === 'Approved') throw new BadRequestException('Approved reports cannot be modified.');
    if (report.status !== 'Revision Required') throw new BadRequestException('Only reports in Revision Required status can be resubmitted.');

    if (dto.organizationId && dto.organizationId !== report.organizationId) {
      throw new BadRequestException('Report organizationId cannot be modified upon resubmission.');
    }
    if (dto.period && dto.period !== report.period) {
      throw new BadRequestException('Report period cannot be modified upon resubmission.');
    }

    if (dto.title) report.title = dto.title;
    if (dto.content) report.content = { ...report.content, ...dto.content };
    report.status = 'Under COO Review';
    report.statusClass = 'blue';
    report.submittedAt = new Date().toISOString();
    report.revision = { required: false, comment: '', requestedBy: '', requestedAt: '' };

    this.state.notifications.unshift({
      id: Date.now(),
      role: 'COO',
      organizationId: report.organizationId,
      title: 'Revised Report Resubmitted by Analyst',
      body: `${report.title} was revised and resubmitted for COO approval.`,
      timestamp: 'Just now',
      read: false,
      details: `Resubmitted on ${report.submittedAt}.`,
    });

    this.log(`Report Resubmitted: ${report.title}`, 'Success', 'green', report.analystName || 'Analyst');
    return structuredClone(report);
  }

  respondToAlert(id: string, response: string): Alert {
    if (!response?.trim()) throw new BadRequestException('Alert response is required.');
    const alert = this.state.alerts.find((entry) => entry.id === id);
    if (!alert) throw new NotFoundException('Alert not found.');
    alert.response = response;
    alert.status = 'Resolved';
    alert.updatedAt = new Date().toISOString();
    this.log(`Alert Resolved: ${alert.departmentName}`, 'Success', 'green');
    return structuredClone(alert);
  }

  log(action: string, status = 'Success', statusType = 'green', actor = 'System') {
    const now = new Date().toISOString();
    this.state.auditLogs.unshift({ id: Date.now(), timestamp: now, actor, action, status, statusType, ip: '127.0.0.1' });
    if (this.state.auditLogs.length > 200) this.state.auditLogs.length = 200;
  }

  private normalize(state: RorizonDb): RorizonDb {
    state.globalSettings = state.globalSettings || {
      lockout: '5',
      session: '240',
      otpExp: '15',
      maxUsers: '100',
      flagMain: false,
      flagEmail: true,
      flag2fa: false,
    };
    state.users = Array.isArray(state.users) ? state.users : [];
    state.organizations = Array.isArray(state.organizations) ? state.organizations : [];
    state.departments = Array.isArray(state.departments) ? state.departments : [];
    state.submissions = Array.isArray(state.submissions) ? state.submissions : [];
    state.resourceCategories = Array.isArray(state.resourceCategories) ? state.resourceCategories : [];
    state.units = Array.isArray(state.units) ? state.units : [];
    state.resourceTypes = Array.isArray(state.resourceTypes) ? state.resourceTypes : [];
    state.resourceUnitCompatibilities = Array.isArray(state.resourceUnitCompatibilities) ? state.resourceUnitCompatibilities : [];
    state.factorSources = Array.isArray(state.factorSources) ? state.factorSources : [];
    state.factorVersions = Array.isArray(state.factorVersions) ? state.factorVersions : [];
    state.emissionFactors = Array.isArray(state.emissionFactors) ? state.emissionFactors : [];
    state.evidences = Array.isArray(state.evidences) ? state.evidences : [];
    state.importBatches = Array.isArray(state.importBatches) ? state.importBatches : [];
    state.importErrors = Array.isArray(state.importErrors) ? state.importErrors : [];
    state.resourceRecords = Array.isArray(state.resourceRecords) ? state.resourceRecords : [];
    state.impactCalculations = Array.isArray(state.impactCalculations) ? state.impactCalculations : [];
    state.impactResults = Array.isArray(state.impactResults) ? state.impactResults : [];
    state.reports = Array.isArray(state.reports) ? state.reports : [];
    state.alerts = Array.isArray(state.alerts) ? state.alerts : [];
    state.notifications = Array.isArray(state.notifications) ? state.notifications : [];
    state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    state.plans = Array.isArray(state.plans) ? state.plans : [];
    state.addons = Array.isArray(state.addons) ? state.addons : [];
    state.subscriptions = Array.isArray(state.subscriptions) ? state.subscriptions : [];

    state.users.forEach((user) => {
      if (!user.password || !String(user.password).trim()) {
        const seedUser = seedDb().users.find((u) => String(u.id) === String(user.id) || u.email?.toLowerCase() === user.email?.toLowerCase());
        user.password = seedUser?.password || 'Default@123';
      }
      if (user.role === 'Manager') {
        const department = user.departmentId
          ? state.departments.find((dept) => dept.id === user.departmentId && dept.orgId === user.organizationId)
          : null;
        if (department) {
          user.departmentId = department.id;
          user.department = department.name;
          department.managerUserId = user.id;
          department.manager = user.name;
        } else {
          user.department = 'Unassigned';
          user.departmentId = '';
        }
        state.departments.forEach((d) => {
          if (String(d.managerUserId) === String(user.id) && (d.id !== user.departmentId || d.orgId !== user.organizationId)) {
            d.managerUserId = null;
            d.manager = 'Unassigned';
          }
        });
      } else {
        state.departments.forEach((d) => {
          if (String(d.managerUserId) === String(user.id)) {
            d.managerUserId = null;
            d.manager = 'Unassigned';
          }
        });
      }
      if (user.role === 'Analyst' && Array.isArray(user.assignedDepartmentIds) && user.assignedDepartmentIds.length) {
        const assignedDepartment = state.departments.find((dept) => user.assignedDepartmentIds.includes(dept.id));
        if (assignedDepartment) user.organizationId = assignedDepartment.orgId;
      }
    });

    state.departments.forEach((dept) => {
      const org = state.organizations.find((entry) => entry.id === dept.orgId);
      dept.orgName = org?.name || dept.orgName || '';
      if (dept.managerUserId) {
        const mgr = state.users.find((u) => String(u.id) === String(dept.managerUserId) && u.role === 'Manager' && u.organizationId === dept.orgId);
        if (mgr) {
          dept.manager = mgr.name;
        } else {
          dept.managerUserId = null;
          dept.manager = 'Unassigned';
        }
      } else {
        dept.manager = 'Unassigned';
      }
      const latestSubmission = this.latestSubmissionForDepartment(state, dept.id);
      if (latestSubmission) {
        const target = this.parseAmount(dept.target);
        const threshold = this.parseAmount(dept.threshold || dept.target);
        dept.current = `${Number(latestSubmission.totalConsumption || 0).toLocaleString()} Units`;
        dept.co2 = Number(latestSubmission.totalCO2 || 0).toLocaleString();
        if (threshold > 0 && Number(latestSubmission.totalConsumption || 0) > threshold) {
          dept.status = 'Exceeded';
          dept.statusType = 'red';
        } else if (target > 0 && Number(latestSubmission.totalConsumption || 0) > target) {
          dept.status = 'Approaching';
          dept.statusType = 'amber';
        } else {
          dept.status = 'Within Target';
          dept.statusType = 'green';
        }
      }
    });

    state.organizations.forEach((org) => {
      org.departmentIds = state.departments.filter((dept) => dept.orgId === org.id).map((dept) => dept.id);
      let sub = state.subscriptions.find((s) => s.organizationId === org.id);
      if (!sub) {
        sub = {
          id: `sub-${org.id}`,
          organizationId: org.id,
          planId: 'plan-pro',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          addonIds: [],
          startDate: new Date().toISOString().slice(0, 10),
          renewalDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.subscriptions.push(sub);
      }
      const coo = state.users.find((entry) => String(entry.id) === String(org.cooUserId) || (entry.role === 'COO' && entry.organizationId === org.id));
      if (coo) {
        org.cooUserId = coo.id;
        org.cooName = coo.name;
        org.cooEmail = coo.email;
        coo.organizationId = org.id;
        if (coo.status === 'Inactive') {
          org.accountStatus = 'Inactive';
          org.status = 'Inactive';
          org.statusType = 'amber';
        }
      }
      this.recalculateOrganization(org.id, state);
      if (org.accountStatus === 'Inactive' || org.status === 'Inactive') {
        state.users.forEach((u) => {
          if (u.organizationId === org.id && u.role !== 'Super User') {
            u.status = 'Inactive';
          }
        });
      }
    });

    state.submissions.forEach((submission) => {
      const department = state.departments.find((dept) => dept.id === submission.departmentId);
      if (!department) return;
      const manager = state.users.find((entry) => entry.id === department.managerUserId);
      submission.organizationId = department.orgId;
      submission.departmentName = department.name;
      submission.managerUserId = department.managerUserId;
      submission.managerName = manager?.name || department.manager || submission.managerName;
      submission.resources = (submission.resources || []).map((item) => this.prepareResourceLine(item, state));
      if (!submission.resourceRecordIds?.length) this.createRecordsAndResultsForSubmission(submission, state);
      this.syncSubmissionTotals(submission.id, state);
    });
    state.reports.forEach((report) => {
      if (report.status === 'Pending Review') {
        report.status = 'Under COO Review';
        report.statusClass = 'blue';
      }
      if (!report.organizationId) {
        const source = state.submissions.find((submission) => report.sourceSubmissionIds?.includes(submission.id));
        if (source) report.organizationId = source.organizationId;
      }
    });
    state.alerts.forEach((alert) => {
      const department = state.departments.find((dept) => dept.id === alert.departmentId);
      if (!department) return;
      alert.organizationId = department.orgId;
      alert.departmentName = department.name;
    });
    state.submissionTracker = state.departments.map((department) => {
      const latestSubmission = this.latestSubmissionForDepartment(state, department.id);
      return {
        id: department.id,
        orgId: department.orgId,
        name: department.name,
        manager: department.manager || 'Unassigned',
        status: latestSubmission ? 'submitted' : 'pending',
        consumption: latestSubmission ? `${Number(latestSubmission.totalConsumption || 0).toLocaleString()} Units` : '--',
        submittedAt: latestSubmission?.submittedAt || '--',
      };
    });
    state.managerSubmissions = state.submissions.map((sub) => ({
      id: sub.id,
      period: sub.period,
      status: sub.status,
      score: sub.score,
      submittedAt: sub.submittedAt,
      resources: sub.resources,
      totalConsumption: sub.totalConsumption,
      totalCO2: sub.totalCO2,
    }));
    if (state === this.state) {
      this.saveStateToDisk();
    }
    return state;
  }

  private assertUnique(key: keyof RorizonDb, payload: Partial<Entity>, currentId?: string | number) {
    if (key === 'users' && 'email' in payload && payload.email) {
      const duplicateUser = this.state.users.find((user) =>
        String(user.id) !== String(currentId ?? '') &&
        user.email.toLowerCase() === String(payload.email).toLowerCase()
      );
      if (duplicateUser) throw new BadRequestException('A user with this email already exists.');
    }

    if (key === 'organizations' && 'name' in payload && payload.name) {
      const duplicateOrganization = this.state.organizations.find((organization) =>
        String(organization.id) !== String(currentId ?? '') &&
        organization.name.toLowerCase() === String(payload.name).toLowerCase()
      );
      if (duplicateOrganization) throw new BadRequestException('An organization with this name already exists.');
    }

    if (key === 'resourceTypes') {
      const rt = payload as Partial<ResourceType>;
      if ('name' in rt) {
        if (!rt.name || !String(rt.name).trim()) throw new BadRequestException('Resource type name cannot be empty.');
        const duplicate = this.state.resourceTypes.find((item) =>
          String(item.id) !== String(currentId ?? '') &&
          item.name.toLowerCase() === String(rt.name).trim().toLowerCase()
        );
        if (duplicate) throw new BadRequestException('A resource type with this name already exists.');
      }
      if (rt.categoryId) {
        const cat = this.state.resourceCategories.find((c) => c.id === rt.categoryId);
        if (!cat || !cat.active) throw new BadRequestException('Resource category is invalid or inactive.');
      }
    }

    if (key === 'units') {
      const unit = payload as Partial<Unit>;
      if ('name' in unit) {
        if (!unit.name || !String(unit.name).trim()) throw new BadRequestException('Unit name cannot be empty.');
      }
      if ('code' in unit) {
        if (!unit.code || !String(unit.code).trim()) throw new BadRequestException('Unit code/symbol cannot be empty.');
      }
      if (unit.name || unit.code) {
        const duplicate = this.state.units.find((item) =>
          String(item.id) !== String(currentId ?? '') &&
          ((unit.name && item.name.toLowerCase() === String(unit.name).trim().toLowerCase()) ||
           (unit.code && item.code.toLowerCase() === String(unit.code).trim().toLowerCase()))
        );
        if (duplicate) throw new BadRequestException('A unit with this name or code already exists.');
      }
    }

    if (key === 'emissionFactors') {
      const factor = payload as Partial<EmissionFactor>;
      if (factor.factor !== undefined && factor.factor !== null) {
        if (!Number.isFinite(Number(factor.factor)) || Number(factor.factor) < 0) {
          throw new BadRequestException('Emission factor value must be a valid non-negative number.');
        }
      }
      if (factor.resourceTypeId) {
        const rt = this.state.resourceTypes.find((r) => r.id === factor.resourceTypeId);
        if (!rt || !rt.active) throw new BadRequestException('Resource type is invalid or inactive.');
      }
      if (factor.unitId) {
        const u = this.state.units.find((unit) => unit.id === factor.unitId);
        if (!u || !u.active) throw new BadRequestException('Unit is invalid or inactive.');
      }
      if (factor.resourceTypeId && factor.unitId && !this.isCompatible(factor.resourceTypeId, factor.unitId)) {
        throw new BadRequestException('Unit is not compatible with resource type.');
      }
      if (factor.versionId) {
        const v = this.state.factorVersions.find((ver) => ver.id === factor.versionId);
        if (!v || v.status !== 'Active') throw new BadRequestException('Factor version is invalid or inactive.');
      }
      if (factor.sourceId) {
        const s = this.state.factorSources.find((src) => src.id === factor.sourceId);
        if (!s || s.active === false) throw new BadRequestException('Factor source is invalid or inactive.');
      }
      if (factor.validFrom && factor.validTo && new Date(factor.validFrom).getTime() > new Date(factor.validTo).getTime()) {
        throw new BadRequestException('validFrom date cannot be after validTo date.');
      }
      if (factor.resourceTypeId && factor.unitId && factor.versionId) {
        const duplicateFactor = this.state.emissionFactors.find((entry) =>
          String(entry.id) !== String(currentId ?? '') &&
          entry.resourceTypeId === factor.resourceTypeId &&
          entry.unitId === factor.unitId &&
          entry.versionId === factor.versionId &&
          entry.geography === (factor.geography || entry.geography)
        );
        if (duplicateFactor) throw new BadRequestException('An emission factor already exists for this resource, unit, version, and geography.');
      }
    }
  }

  private createRecordsAndResultsForSubmission(submission: Submission, state = this.state) {
    const activeCount = (submission.resources || []).length;
    const validIds = Array.from({ length: activeCount }, (_, i) => `${submission.id}-rec-${i + 1}`);

    // Remove any stale resource records and associated calculations for this submission beyond activeCount
    const staleRecords = state.resourceRecords.filter(
      (r) => r.submissionId === submission.id && !validIds.includes(r.id)
    );
    staleRecords.forEach((stale) => {
      state.resourceRecords = state.resourceRecords.filter((r) => r.id !== stale.id);
      state.impactCalculations = state.impactCalculations.filter((c) => c.resourceRecordId !== stale.id);
      state.impactResults = state.impactResults.filter((res) => res.resourceRecordId !== stale.id);
    });

    const recordIds: string[] = [];
    const resultIds: string[] = [];
    (submission.resources || []).forEach((line, index) => {
      const prepared = this.prepareResourceLine(line, state);
      const recordId = `${submission.id}-rec-${index + 1}`;
      let record = state.resourceRecords.find((entry) => entry.id === recordId);
      if (!record) {
        record = {
          id: recordId,
          submissionId: submission.id,
          organizationId: submission.organizationId,
          departmentId: submission.departmentId,
          resourceTypeId: prepared.resourceTypeId!,
          unitId: prepared.unitId!,
          quantity: Number(prepared.qty),
          activityDate: this.periodToDate(submission.period),
          period: submission.period,
          entryMode: prepared.evidenceId ? 'Evidence' : 'Manual',
          evidenceId: prepared.evidenceId,
          status: 'Ready',
          validationErrors: [],
          createdAt: new Date().toISOString(),
        };
        state.resourceRecords.unshift(record);
      } else {
        record.resourceTypeId = prepared.resourceTypeId!;
        record.unitId = prepared.unitId!;
        record.quantity = Number(prepared.qty);
        record.activityDate = this.periodToDate(submission.period);
        record.period = submission.period;
        record.evidenceId = prepared.evidenceId;
        record.status = 'Ready';
      }
      recordIds.push(record.id);
      const result = this.calculateRecord(record, state);
      if (result) resultIds.push(result.id);
    });
    submission.resourceRecordIds = recordIds;
    submission.impactResultIds = resultIds;
    submission.calculationStatus = recordIds.length > 0 && resultIds.length === recordIds.length ? 'Calculated' : 'Error';
    this.syncSubmissionTotals(submission.id, state);
  }

  private prepareImpactResult(record: ResourceRecord, state = this.state): {
    factor: EmissionFactor;
    result: ImpactResult;
    calculation: ImpactCalculation;
  } | undefined {
    const factor = this.findActiveFactor(record, state);
    if (!factor) return undefined;

    const calculationId = `calc-${record.id}`;
    const calculatedAt = new Date().toISOString();
    const result: ImpactResult = {
      id: `ir-${record.id}`,
      calculationId,
      resourceRecordId: record.id,
      submissionId: record.submissionId,
      organizationId: record.organizationId,
      departmentId: record.departmentId,
      period: record.period,
      resourceTypeId: record.resourceTypeId,
      unitId: record.unitId,
      quantity: record.quantity,
      factorId: factor.id,
      factorVersionId: factor.versionId,
      factorSourceId: factor.sourceId,
      factor: factor.factor,
      co2e: Number((record.quantity * factor.factor).toFixed(4)),
      calculatedAt,
    };

    const calculation: ImpactCalculation = {
      id: calculationId,
      resourceRecordId: record.id,
      status: 'Calculated',
      message: 'Calculated with active factor version.',
      calculatedAt,
    };

    return { factor, result, calculation };
  }

  private calculateRecord(record: ResourceRecord, state = this.state): ImpactResult | undefined {
    const prepared = this.prepareImpactResult(record, state);
    const calculationId = `calc-${record.id}`;
    state.impactCalculations = state.impactCalculations.filter((item) => item.resourceRecordId !== record.id);
    state.impactResults = state.impactResults.filter((item) => item.resourceRecordId !== record.id);

    if (!prepared) {
      state.impactCalculations.unshift({
        id: calculationId,
        resourceRecordId: record.id,
        status: 'Error',
        message: 'No active emission factor found for resource, unit, and period.',
        calculatedAt: new Date().toISOString(),
      });
      return undefined;
    }

    const version = state.factorVersions.find((entry) => entry.id === prepared.factor.versionId);
    if (version) version.locked = true;

    state.impactCalculations.unshift(prepared.calculation);
    state.impactResults.unshift(prepared.result);
    return prepared.result;
  }

  private syncSubmissionTotals(submissionId: string, state = this.state) {
    const submission = state.submissions.find((entry) => entry.id === submissionId);
    if (!submission) return;
    const records = state.resourceRecords.filter((record) => record.submissionId === submissionId);
    const results = state.impactResults.filter((result) => result.submissionId === submissionId);
    submission.totalConsumption = records.reduce((sum, record) => sum + Number(record.quantity || 0), 0);
    submission.totalCO2 = Number(results.reduce((sum, result) => sum + Number(result.co2e || 0), 0).toFixed(4));
    submission.resourceRecordIds = records.map((record) => record.id);
    submission.impactResultIds = results.map((result) => result.id);
    submission.calculationStatus = records.length && records.length === results.length ? 'Calculated' : 'Error';
    submission.dataReadinessStatus = records.some((record) => record.validationErrors?.length) ? 'Needs Correction' : 'Ready';
  }

  private prepareResourceLine(line: any, state = this.state) {
    const resourceType = line.resourceTypeId
      ? this.requireResourceType(line.resourceTypeId, state)
      : state.resourceTypes.find((entry) => entry.name.toLowerCase() === String(line.type || '').toLowerCase());
    if (!resourceType) throw new BadRequestException(`Unknown resource type: ${line.type || line.resourceTypeId}.`);
    const unit = line.unitId
      ? this.requireUnit(line.unitId, state)
      : state.units.find((entry) => entry.name.toLowerCase() === String(line.unit || '').toLowerCase() || entry.code.toLowerCase() === String(line.unit || '').toLowerCase());
    if (!unit) throw new BadRequestException(`Unknown unit: ${line.unit || line.unitId}.`);
    if (!this.isCompatible(resourceType.id, unit.id, state)) throw new BadRequestException(`${unit.name} is not compatible with ${resourceType.name}.`);
    if (!Number.isFinite(Number(line.qty)) || Number(line.qty) <= 0) throw new BadRequestException('Resource quantity must be greater than zero.');
    return {
      type: resourceType.name,
      unit: unit.name,
      qty: Number(line.qty),
      resourceTypeId: resourceType.id,
      unitId: unit.id,
      evidenceId: line.evidenceId,
    };
  }

  private findActiveFactor(record: ResourceRecord, state = this.state) {
    const matching = state.emissionFactors.filter((factor) => {
      const version = state.factorVersions.find((entry) => entry.id === factor.versionId);
      return factor.active &&
        factor.resourceTypeId === record.resourceTypeId &&
        factor.unitId === record.unitId &&
        version?.status === 'Active' &&
        this.dateInRange(this.periodToDate(record.period), factor.validFrom, factor.validTo) &&
        this.dateInRange(this.periodToDate(record.period), version.effectiveFrom, version.effectiveTo);
    });
    if (matching.length > 1) throw new BadRequestException('Multiple active emission factors match this resource record.');
    return matching[0];
  }

  private validateDepartment(organizationId?: string, departmentId?: string): RorizonDepartment {
    if (!organizationId || !departmentId) throw new BadRequestException('organizationId and departmentId are required.');
    const department = this.state.departments.find((entry) => entry.id === departmentId);
    if (!department) throw new NotFoundException('Department not found.');
    if (department.orgId !== organizationId) throw new BadRequestException('Department does not belong to the selected organization.');
    return department;
  }

  private requireResourceType(id?: string, state = this.state): ResourceType {
    const resourceType = state.resourceTypes.find((entry) => entry.id === id);
    if (!resourceType || !resourceType.active) throw new BadRequestException('Resource type is invalid or inactive.');
    return resourceType;
  }

  private requireUnit(id?: string, state = this.state): Unit {
    const unit = state.units.find((entry) => entry.id === id);
    if (!unit || !unit.active) throw new BadRequestException('Unit is invalid or inactive.');
    return unit;
  }

  private isCompatible(resourceTypeId: string, unitId: string, state = this.state) {
    return state.resourceUnitCompatibilities.some((entry) => entry.resourceTypeId === resourceTypeId && entry.unitId === unitId && entry.active);
  }

  private dateInRange(value: string, from: string, to?: string) {
    const date = new Date(value).getTime();
    return date >= new Date(from).getTime() && (!to || date <= new Date(to).getTime());
  }

  private isValidDate(value: string) {
    return Boolean(value && !Number.isNaN(new Date(value).getTime()));
  }

  private periodToDate(period: string) {
    if (/^\d{4}-\d{2}$/.test(period)) return `${period}-01`;
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const parts = String(period || '').trim().toLowerCase().split(/[\s-]+/);
    if (parts.length === 2) {
      if (/^\d{4}$/.test(parts[0])) {
        const m = months[parts[1].slice(0, 3)] || (Number(parts[1]) ? String(parts[1]).padStart(2, '0') : '01');
        return `${parts[0]}-${m}-01`;
      }
      const y = /^\d{4}$/.test(parts[1]) ? parts[1] : '2026';
      const m = months[parts[0].slice(0, 3)] || (Number(parts[0]) ? String(parts[0]).padStart(2, '0') : '01');
      return `${y}-${m}-01`;
    }
    return new Date().toISOString().slice(0, 10);
  }

  private recalculateOrganization(orgId: string, state = this.state) {
    const org = state.organizations.find((entry) => entry.id === orgId);
    if (!org) return;
    const departments = state.departments.filter((dept) => dept.orgId === orgId);
    const target = departments.reduce((sum, dept) => sum + this.parseAmount(dept.target), 0);
    const threshold = departments.reduce((sum, dept) => sum + this.parseAmount(dept.threshold), 0);
    const current = departments.reduce((sum, dept) => sum + this.parseAmount(dept.current), 0);
    const co2 = departments.reduce((sum, dept) => sum + this.parseAmount(dept.co2), 0);
    org.target = `${target.toLocaleString()} Units`;
    org.threshold = `${threshold.toLocaleString()} Units`;
    org.current = `${current.toLocaleString()} Units`;
    org.co2 = co2.toLocaleString();
    const hasBreach = departments.some((dept) => dept.statusType === 'red');
    const overTarget = departments.some((dept) => dept.statusType === 'amber') || (target > 0 && current > target);
    if (org.accountStatus === 'Inactive' || org.status === 'Inactive') {
      org.accountStatus = 'Inactive';
      org.status = 'Inactive';
      org.statusType = 'amber';
    } else {
      org.status = hasBreach || overTarget ? 'Needs Attention' : 'Within Target';
      org.statusType = hasBreach || overTarget ? 'amber' : 'green';
    }
  }

  private upsertTracker(department: Department, submission: Submission) {
    let tracker = this.state.submissionTracker.find((item) => item.id === department.id);
    if (!tracker) {
      tracker = { id: department.id, orgId: department.orgId, name: department.name, manager: department.manager };
      this.state.submissionTracker.push(tracker);
    }
    Object.assign(tracker, {
      status: 'submitted',
      consumption: `${submission.totalConsumption.toLocaleString()} Units`,
      submittedAt: submission.submittedAt,
    });
  }

  private createBreachAlert(department: Department, submission: Submission, threshold: number) {
    this.state.alerts.unshift({
      id: `alt-${randomUUID().slice(0, 8)}`,
      type: 'Threshold Breach',
      severity: 'Critical',
      roleScope: ['Manager', 'COO'],
      organizationId: submission.organizationId,
      departmentId: department.id,
      departmentName: department.name,
      status: 'Open',
      message: `System detected consumption exceeding the monthly threshold by ${(submission.totalConsumption - threshold).toLocaleString()} units.`,
      deviationReason: submission.validation.deviationReason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  private parseAmount(value: string) {
    const match = String(value || '').replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  private latestSubmissionForDepartment(state: RorizonDb, departmentId: string): Submission | undefined {
    return state.submissions
      .filter((submission) => submission.departmentId === departmentId && submission.status === 'Approved')
      .sort((a, b) => this.periodKey(b.period) - this.periodKey(a.period))[0];
  }

  private periodKey(period: string) {
    const match = String(period || '').match(/(\d{1,2})\s+(\d{4})/);
    return match ? Number(match[2]) * 100 + Number(match[1]) : 0;
  }
}
