import { ReportDto, UpdateReportDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Report } from '../in-memory/entities';
export declare class ReportsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): Report[];
    find(id: string): Report;
    create(dto: ReportDto): Report;
    update(id: string, dto: UpdateReportDto): Report;
    approve(id: number, approvedBy: string): Report;
    requestRevision(id: number, comment: string, requestedBy: string): Report;
    remove(id: string): Report;
}
