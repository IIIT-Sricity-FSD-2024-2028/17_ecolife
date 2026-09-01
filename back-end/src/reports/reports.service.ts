import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportDto, ResubmitReportDto, UpdateReportDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Report } from '../in-memory/entities';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly store: InMemoryStoreService,
    private readonly revenueService: RevenueService,
  ) {}

  list() {
    return this.store.list<Report>('reports');
  }

  find(id: string) {
    return this.store.find<Report>('reports', id);
  }

  create(dto: ReportDto) {
    if (dto.organizationId) {
      this.revenueService.checkLimit(dto.organizationId, 'reports');
    }
    return this.store.createExecutiveReport(dto as Report);
  }

  update(id: string, dto: UpdateReportDto) {
    const existing = this.store.find<Report>('reports', id);
    if (existing && existing.status === 'Approved') {
      throw new BadRequestException('Approved executive reports cannot be modified.');
    }
    if (existing && dto.status && dto.status !== existing.status) {
      throw new BadRequestException('Report status cannot be changed directly via update. Use explicit workflow endpoints (/approve, /revision, /resubmit).');
    }
    return this.store.update<Report>('reports', id, dto as Report);
  }

  approve(id: string | number, approvedBy: string) {
    return this.store.approveReport(id, approvedBy || 'COO');
  }

  requestRevision(id: string | number, comment: string, requestedBy: string) {
    return this.store.requestReportRevision(id, comment, requestedBy || 'COO');
  }

  resubmit(id: string | number, dto: ResubmitReportDto) {
    return this.store.resubmitReport(id, dto);
  }

  remove(id: string) {
    return this.store.remove<Report>('reports', id);
  }
}
