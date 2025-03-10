import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PermissionXUserEntity } from './permission-x-user.entity';

@Entity('permissions')
export class PermissionsEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  label: string;

  @Column({ length: 120 })
  module: string;

  @Column({ length: 120 })
  name: string;
  
  @OneToMany(() => PermissionXUserEntity, (permissionUser) => permissionUser.permission)
  permission: PermissionXUserEntity[];
}
