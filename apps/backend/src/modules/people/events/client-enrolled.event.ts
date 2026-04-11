import { BaseEvent } from '../../../common/events';

export interface ClientEnrolledPayload {
  clientId: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
}

/**
 * Emitted when a new client is created for the first time.
 * Comms BC subscribes to send a welcome message.
 */
export class ClientEnrolledEvent extends BaseEvent<ClientEnrolledPayload> {
  readonly eventName = 'people.client.enrolled';

  constructor(tenantId: string, payload: ClientEnrolledPayload) {
    super({ source: 'people', version: 1, tenantId, payload });
  }
}
