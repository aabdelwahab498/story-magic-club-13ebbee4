// Module
export { RbacModule } from './rbac.module.js';
export { RbacService } from './rbac.service.js';

// Enums
export { Role } from './enums/role.enum.js';
export { Permission } from './enums/permission.enum.js';

// Interfaces
export type { UserContext } from './interfaces/user-context.interface.js';

// Decorators
export { Roles, ROLES_KEY } from './decorators/roles.decorator.js';
export {
  Permissions,
  PERMISSIONS_KEY,
} from './decorators/permissions.decorator.js';
export { CurrentUser } from './decorators/current-user.decorator.js';

// Guards
export { RolesGuard } from './guards/roles.guard.js';
export { PermissionsGuard } from './guards/permissions.guard.js';
