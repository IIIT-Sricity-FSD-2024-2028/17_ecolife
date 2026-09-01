import { Injectable } from '@nestjs/common';
import { ResourceCategoryDto, ResourceTypeDto, ResourceUnitCompatibilityDto, UnitDto, UpdateResourceCategoryDto, UpdateResourceTypeDto, UpdateResourceUnitCompatibilityDto, UpdateUnitDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { ResourceCategory, ResourceType, ResourceUnitCompatibility, Unit } from '../in-memory/entities';

@Injectable()
export class ResourcesService {
  constructor(private readonly store: InMemoryStoreService) {}

  listCategories() { return this.store.list<ResourceCategory>('resourceCategories'); }
  createCategory(dto: ResourceCategoryDto) { return this.store.create<ResourceCategory>('resourceCategories', { description: '', active: true, ...dto } as ResourceCategory, 'cat'); }
  updateCategory(id: string, dto: UpdateResourceCategoryDto) { return this.store.update<ResourceCategory>('resourceCategories', id, dto as ResourceCategory); }
  removeCategory(id: string) { return this.store.removeResourceCategory(id); }

  listUnits() { return this.store.list<Unit>('units'); }
  createUnit(dto: UnitDto) { return this.store.create<Unit>('units', { active: true, ...dto } as Unit, 'unit'); }
  updateUnit(id: string, dto: UpdateUnitDto) { return this.store.update<Unit>('units', id, dto as Unit); }
  removeUnit(id: string) { return this.store.removeUnit(id); }

  listTypes() { return this.store.list<ResourceType>('resourceTypes'); }
  createType(dto: ResourceTypeDto) { return this.store.create<ResourceType>('resourceTypes', { description: '', active: true, ...dto } as ResourceType, 'rt'); }
  updateType(id: string, dto: UpdateResourceTypeDto) { return this.store.update<ResourceType>('resourceTypes', id, dto as ResourceType); }
  removeType(id: string) { return this.store.removeResourceType(id); }

  listCompatibilities() { return this.store.list<ResourceUnitCompatibility>('resourceUnitCompatibilities'); }
  createCompatibility(dto: ResourceUnitCompatibilityDto) { return this.store.create<ResourceUnitCompatibility>('resourceUnitCompatibilities', { active: true, ...dto } as ResourceUnitCompatibility, 'ruc'); }
  updateCompatibility(id: string, dto: UpdateResourceUnitCompatibilityDto) { return this.store.update<ResourceUnitCompatibility>('resourceUnitCompatibilities', id, dto as ResourceUnitCompatibility); }
  removeCompatibility(id: string) { return this.store.removeCompatibility(id); }
}
