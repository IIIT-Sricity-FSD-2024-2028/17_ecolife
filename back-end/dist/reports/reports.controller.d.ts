import { ApproveReportDto, ReportDto, RevisionDto, UpdateReportDto } from '../common/base.dto';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private readonly reportsService;
    constructor(reportsService: ReportsService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    create(dto: ReportDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    update(id: string, dto: UpdateReportDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    replace(id: string, dto: UpdateReportDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    approve(id: number, body: ApproveReportDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    revision(id: number, dto: RevisionDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Report>;
}
