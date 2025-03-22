import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PermissionXUserEntity } from './permission-x-user.entity';
import { PermissionModuleEntity } from './permission-module.entity';

@Entity('permissions')
export class PermissionsEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  label: string;

  @Column({ type: 'int' })
  permission_module_id: number;

  @Column({ length: 120 })
  name: string;

  @OneToMany(() => PermissionXUserEntity, (permissionUser) => permissionUser.permission)
  permission: PermissionXUserEntity[];

  @OneToOne(() => PermissionModuleEntity, (permissionModule) => permissionModule.permission)
  @JoinColumn({ name: 'permission_module_id' })
  permissionModule: PermissionModuleEntity
}
