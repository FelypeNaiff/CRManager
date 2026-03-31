import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { NotificationService } from './services/notification.service';
import { MarketingAIService } from './services/marketing-ai.service';
import { WhatsAppEngineService } from './services/whatsapp-engine.service';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const notificationService = new NotificationService(io);
const marketingAI = new MarketingAIService();
const whatsappEngine = new WhatsAppEngineService();

app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

app.post('/webhooks/whatsapp', (req, res) => {
  const { lojaId, trigger, payload } = req.body;
  const result = whatsappEngine.processTrigger(lojaId, trigger, payload);
  notificationService.sendToLoja(lojaId, 'whatsapp:processed', result);
  return res.status(202).json(result);
});

app.post('/api/marketing/ai/generate', (req, res) => {
  const { brief, segment } = req.body;
  return res.json(marketingAI.generateCampaign(brief, segment));
});

app.post('/api/marketing/ai/segment', (req, res) => {
  return res.json({ segments: marketingAI.autoSegment(req.body.customers ?? []) });
});

io.on('connection', (socket) => {
  socket.on('join:loja', (lojaId: string) => socket.join(lojaId));
});

app.use(errorHandler);

httpServer.listen(env.port, () => {
  console.log(`CRManager API rodando na porta ${env.port}`);
});
