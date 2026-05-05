import { SubmissionDto, UpdateSubmissionDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Submission } from '../in-memory/entities';
export declare class SubmissionsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): Submission[];
    find(id: string): Submission;
    create(dto: SubmissionDto): Submission;
    update(id: string, dto: UpdateSubmissionDto): Submission;
    remove(id: string): Submission;
}
