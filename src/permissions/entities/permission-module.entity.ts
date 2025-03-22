import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { PermissionsEntity } from "./permission.entity";


@Entity('permission_module')
export class PermissionModuleEntity { 

  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 60 })
  nome: string;

  @OneToMany(() => PermissionsEntity, (permission) => permission.permissionModule)
  permission: PermissionsEntity
}