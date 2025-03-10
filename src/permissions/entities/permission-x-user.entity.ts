import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UsersEntity } from 'users/entities/users.entity';
import { PermissionsEntity } from './permission.entity';

@Entity({
  name: 'permission_x_user',
  withoutRowid: true
})
export class PermissionXUserEntity {
  @PrimaryColumn({type: 'int' })
  user_id: number;
  
  @PrimaryColumn({type: 'int'})
  permission_id: number;

  @ManyToOne(() => UsersEntity, (user) => user.permissionUser)
  @JoinColumn({ name: 'user_id' })
  user: UsersEntity;

  @ManyToOne(() => PermissionsEntity, (permission) => permission.permission)
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionsEntity;
}
