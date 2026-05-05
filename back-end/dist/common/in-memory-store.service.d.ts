import { Entity } from './crud.types';
import { Alert, Report, RorizonDb, Submission, User } from '../in-memory/entities';
export declare class InMemoryStoreService {
    private state;
    snapshot(): RorizonDb;
    replace(snapshot: Partial<RorizonDb>): RorizonDb;
    list<T extends Entity>(key: keyof RorizonDb): T[];
    find<T extends Entity>(key: keyof RorizonDb, id: string | number): T;
    create<T extends Entity>(key: keyof RorizonDb, payload: Omit<T, 'id'> & Partial<Entity>, prefix: string): T;
    update<T extends Entity>(key: keyof RorizonDb, id: string | number, payload: Partial<T>): T;
    remove<T extends Entity>(key: keyof RorizonDb, id: string | number): T;
    authenticate(email: string, password: string): User;
    lockSubmission(payload: Partial<Submission>): Submission;
    approveReport(id: number, approvedBy: string): Report;
    requestReportRevision(id: number, comment: string, requestedBy: string): Report;
    respondToAlert(id: string, response: string): Alert;
    log(action: string, status?: string, statusType?: string, actor?: string): void;
    private normalize;
    private assertUnique;
    private recalculateOrganization;
    private upsertTracker;
    private createBreachAlert;
    private parseAmount;
    private latestSubmissionForDepartment;
    private periodKey;
}
