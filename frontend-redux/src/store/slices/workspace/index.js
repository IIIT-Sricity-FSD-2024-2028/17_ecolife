// Slices owned by this area. Add yours here, in this folder only.
import entities from './entitiesSlice';
import boundaryExclusions from './boundaryExclusionsSlice';
import factors from './factorsSlice';
import team from './teamSlice';
import org from './orgSlice';
import sessions from './sessionsSlice';
import emailOutbox from './emailOutboxSlice';
import accessCertifications from './accessCertificationsSlice';
import facilities from './facilitiesSlice';
import sources from './sourcesSlice';
export default { 'entities': entities, 'boundary-exclusions': boundaryExclusions, 'factors': factors, 'team': team, 'org': org, 'sessions': sessions, 'email-outbox': emailOutbox, 'access-certifications': accessCertifications, 'facilities': facilities, 'sources': sources };
