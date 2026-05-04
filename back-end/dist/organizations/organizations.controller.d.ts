import { OrganizationDto, UpdateOrganizationDto } from '../common/base.dto';
import { OrganizationsService } from './organizations.service';
export declare class OrganizationsController {
    private readonly organizationsService;
    constructor(organizationsService: OrganizationsService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization>;
    create(dto: OrganizationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization>;
    update(id: string, dto: UpdateOrganizationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization>;
    replace(id: string, dto: UpdateOrganizationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Organization>;
}
