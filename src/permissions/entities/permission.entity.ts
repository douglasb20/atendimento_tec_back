import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PermissionXUser } from './permission-x-user.entity';
import { PermissionModule } from './permission-module.entity';

@Entity('permissions')
export class Permissions {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  label: string;

  @Column({ type: 'int' })
  permission_module_id: number;

  @Column({ length: 120 })
  name: string;

  @OneToMany(() => PermissionXUser, (permissionUser) => permissionUser.permission)
  permission: PermissionXUser[];

  @OneToOne(() => PermissionModule, (permissionModule) => permissionModule.permission)
  @JoinColumn({ name: 'permission_module_id' })
  permissionModule: PermissionModule;
}
