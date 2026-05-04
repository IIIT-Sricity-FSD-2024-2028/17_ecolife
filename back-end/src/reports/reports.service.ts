import { Injectable } from '@nestjs/common';
import { ReportDto, UpdateReportDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Report } from '../in-memory/entities';

@Injectable()
export class ReportsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<Report>('reports');
  }

  find(id: string) {
    return this.store.find<Report>('reports', id);
  }

  create(dto: ReportDto) {
    return this.store.create<Report>(
      'reports',
      { date: new Date().toLocaleDateString(), status: 'Pending Review', statusClass: 'amber', analystName: 'Analyst', analystUserId: null, signature: { signedBy: 'Analyst', signedAt: new Date().toISOString() }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: {}, ...dto } as Report,
      'rpt',
    );
  }

  update(id: string, dto: UpdateReportDto) {
    return this.store.update<Report>('reports', id, dto as Report);
  }

  approve(id: number, approvedBy: string) {
    return this.store.approveReport(id, approvedBy || 'COO');
  }

  requestRevision(id: number, comment: string, requestedBy: string) {
    return this.store.requestReportRevision(id, comment, requestedBy || 'COO');
  }

  remove(id: string) {
    return this.store.remove<Report>('reports', id);
  }
}
