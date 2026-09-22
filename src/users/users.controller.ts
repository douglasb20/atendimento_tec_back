import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { UsersService } from './users.service';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { SemPermissao } from 'permissions/sem-permissao.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PreferenciasTemaDto } from './dto/preferencias-tema.dto';
import { Users } from './entities/users.entity';
import { SignAvatarDto } from './dto/sign-avatar.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Auto-consulta: é daqui que a interface sabe o que pode mostrar. Exigir
  // permissão para o usuário ler as próprias permissões seria circular.
  @Get('/info')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async userInfo(@Req() req: Request) {
    const user: Users = req.user as Users;
    const userInfo = await this.usersService.userInfo(user.id);
    return userInfo;
  }

  /**
   * O cadastro de quem está logado, para a tela de Perfil.
   *
   * ⚠️ **Existe para `user:profile_view` não ser decorativa.** O Perfil
   * carregava por `GET /users/:id`, que exige `user:view` - a permissão de ver
   * *qualquer* usuário. Um atendente precisa do próprio cadastro sem enxergar
   * o dos colegas, e são coisas diferentes.
   *
   * O alvo sai do token, nunca do corpo ou da URL: não há como pedir o perfil
   * de outra pessoa por aqui.
   */
  @Get('/meu-perfil')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:profile_view')
  @HttpCode(HttpStatus.OK)
  async meuPerfil(@Req() req: Request) {
    const user = req.user as Users;

    return this.usersService.findOne(user.id);
  }

  /**
   * Salva o próprio cadastro: avatar, nome, senha.
   *
   * Sob `user:profile_update`, e não `user:update` - esta é "editar qualquer
   * usuário". As restrições de e-mail e grupo continuam valendo dentro do
   * service, pelas permissões `user:change_own_email` e `user:change_group`.
   */
  @Patch('/meu-perfil')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:profile_update')
  @HttpCode(HttpStatus.OK)
  async atualizaMeuPerfil(@Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
    const user = req.user as Users;

    return this.usersService.updateUser(user.id, updateUserDto, user);
  }

  /**
   * Preferência de tema de quem está logado.
   *
   * `@SemPermissao` pelo mesmo motivo do `/info`: é auto-consulta, e exigir
   * permissão para alguém escolher a própria cor de tela não faria sentido. O
   * id vem do token, então ninguém altera a preferência de outro.
   */
  @Patch('/preferencias-tema')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async atualizaPreferenciasTema(
    @Body() preferenciasTemaDto: PreferenciasTemaDto,
    @Req() req: Request,
  ) {
    const user: Users = req.user as Users;
    return this.usersService.atualizaPreferenciasTema(user.id, preferenciasTemaDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post('/sign-avatar')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:update')
  @HttpCode(HttpStatus.OK)
  async signAvatar(@Body() signAvatarDto: SignAvatarDto) {
    return this.usersService.signAvatar(signAvatarDto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:add')
  @HttpCode(HttpStatus.CREATED)
  async addUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.addUser(createUserDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:update')
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    // Quem está alterando, e não só quem é alterado: as permissões de e-mail e
    // grupo dependem de o alvo ser a própria pessoa.
    const solicitante = req.user as Users;

    return this.usersService.updateUser(Number(id), updateUserDto, solicitante);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('user:delete')
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(Number(id));
  }
}
