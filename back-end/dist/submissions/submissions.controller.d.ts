import { SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
import { SubmissionsService } from './submissions.service';
export declare class SubmissionsController {
    private readonly submissionsService;
    constructor(submissionsService: SubmissionsService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission>;
    create(dto: SubmissionDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission>;
    update(id: string, dto: UpdateSubmissionDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission>;
    replace(id: string, dto: UpdateSubmissionDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Submission>;
}
