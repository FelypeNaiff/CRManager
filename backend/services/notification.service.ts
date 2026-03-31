import { Server } from 'socket.io';

export class NotificationService {
  constructor(private io: Server) {}

  sendToLoja(lojaId: string, event: string, data: unknown) {
    this.io.to(lojaId).emit(event, data);
  }
}
