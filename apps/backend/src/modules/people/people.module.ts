import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { CreateClientHandler } from './clients/create-client.handler';
import { UpdateClientHandler } from './clients/update-client.handler';
import { ListClientsHandler } from './clients/list-clients.handler';
import { GetClientHandler } from './clients/get-client.handler';

const handlers = [CreateClientHandler, UpdateClientHandler, ListClientsHandler, GetClientHandler];

@Module({
  imports: [DatabaseModule],
  providers: [...handlers],
  exports: [...handlers],
})
export class PeopleModule {}
