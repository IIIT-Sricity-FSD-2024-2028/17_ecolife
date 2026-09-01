import { Injectable } from '@nestjs/common';
import { EmissionFactorDto, FactorSourceDto, FactorVersionDto, UpdateEmissionFactorDto, UpdateFactorSourceDto, UpdateFactorVersionDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { EmissionFactor, EmissionFactorSource, FactorVersion } from '../in-memory/entities';

@Injectable()
export class FactorsService {
  constructor(private readonly store: InMemoryStoreService) {}

  listSources() { return this.store.list<EmissionFactorSource>('factorSources'); }
  createSource(dto: FactorSourceDto) { return this.store.create<EmissionFactorSource>('factorSources', { acquisitionMethod: 'Manual Upload', active: true, ...dto } as EmissionFactorSource, 'efs'); }
  updateSource(id: string, dto: UpdateFactorSourceDto) { return this.store.update<EmissionFactorSource>('factorSources', id, dto as EmissionFactorSource); }
  removeSource(id: string) { return this.store.removeFactorSource(id); }

  listVersions() { return this.store.list<FactorVersion>('factorVersions'); }
  createVersion(dto: FactorVersionDto) { return this.store.create<FactorVersion>('factorVersions', { status: 'Draft', locked: false, importedAt: new Date().toISOString(), ...dto } as FactorVersion, 'fv'); }
  updateVersion(id: string, dto: UpdateFactorVersionDto) { return this.store.updateFactorVersion(id, dto as FactorVersion); }
  removeVersion(id: string) { return this.store.removeFactorVersion(id); }

  listFactors() { return this.store.list<EmissionFactor>('emissionFactors'); }
  createFactor(dto: EmissionFactorDto) { return this.store.create<EmissionFactor>('emissionFactors', { geography: 'IN', active: true, ...dto } as EmissionFactor, 'ef'); }
  updateFactor(id: string, dto: UpdateEmissionFactorDto) { return this.store.update<EmissionFactor>('emissionFactors', id, dto as EmissionFactor); }
  removeFactor(id: string) { return this.store.removeEmissionFactor(id); }
}
