import { OrganizationDto, UpdateOrganizationDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Organization } from '../in-memory/entities';
export declare class OrganizationsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): Organization[];
    find(id: string): Organization;
    create(dto: OrganizationDto): Organization;
    update(id: string, dto: UpdateOrganizationDto): Organization;
    remove(id: string): Organization;
}
