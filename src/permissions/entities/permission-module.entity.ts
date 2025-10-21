import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Permissions } from "./permission.entity";


@Entity('permission_module')
export class PermissionModule { 

  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 60 })
  nome: string;

  @OneToMany(() => Permissions, (permission) => permission.permissionModule)
  permission: Permissions
}