import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Users } from 'users/entities/users.entity';
import { Permissions } from './permission.entity';

@Entity({
  name: 'permission_x_user',
  withoutRowid: true,
})
export class PermissionXUser {
  @PrimaryColumn({ type: 'int' })
  user_id: number;

  @PrimaryColumn({ type: 'int' })
  permission_id: number;

  @ManyToOne(() => Users, (user) => user.permissionUser)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Permissions, (permission) => permission.permission)
  @JoinColumn({ name: 'permission_id' })
  permission: Permissions;
}
