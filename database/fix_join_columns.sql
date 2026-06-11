ALTER TABLE user_roles RENAME COLUMN "usersId" TO user_id;
ALTER TABLE user_roles RENAME COLUMN "rolesId" TO role_id;
ALTER TABLE role_permissions RENAME COLUMN "rolesId" TO role_id;
ALTER TABLE role_permissions RENAME COLUMN "permissionsId" TO permission_id;
