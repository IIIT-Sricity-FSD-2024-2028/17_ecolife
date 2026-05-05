import { DepartmentDto, UpdateDepartmentDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Department } from '../in-memory/entities';
export declare class DepartmentsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): Department[];
    find(id: string): Department;
    create(dto: DepartmentDto): Department;
    update(id: string, dto: UpdateDepartmentDto): Department;
    remove(id: string): Department;
}
