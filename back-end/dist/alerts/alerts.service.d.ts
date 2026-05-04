import { AlertDto, UpdateAlertDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Alert } from '../in-memory/entities';
export declare class AlertsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): Alert[];
    find(id: string): Alert;
    create(dto: AlertDto): Alert;
    update(id: string, dto: UpdateAlertDto): Alert;
    respond(id: string, response: string): Alert;
    remove(id: string): Alert;
}
