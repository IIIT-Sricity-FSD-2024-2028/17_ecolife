import { DepartmentDto, UpdateDepartmentDto } from '../common/base.dto';
import { DepartmentsService } from './departments.service';
export declare class DepartmentsController {
    private readonly departmentsService;
    constructor(departmentsService: DepartmentsService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department>;
    create(dto: DepartmentDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department>;
    update(id: string, dto: UpdateDepartmentDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department>;
    replace(id: string, dto: UpdateDepartmentDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Department>;
}
