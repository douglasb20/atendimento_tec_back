import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DataSource } from "typeorm";
import { UsersEntity } from "users/entities/users.entity";

@Injectable()
export class TesteService{

  constructor(private dataSource: DataSource){}

  async log() {
    console.log(await this.dataSource.manager.find(UsersEntity)); 
  }
}