import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyView from '@fastify/view';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import path from 'path';
import ejs from 'ejs';

import { authRoutes } from './modules/auth/auth.routes';
import { companyRoutes } from './modules/companies/company.routes';
import { userRoutes } from './modules/users/user.routes';
import { proposalRoutes } from './modules/proposals/proposal.routes';

dotenv.config();

const app = Fastify({ logger: true });

// Plugins Globais
app.register(cors, { origin: '*' });

app.register(jwt, {
  secret: process.env.JWT_SECRET || 'simproposta_super_secret_jwt_key_2026',
});

app.register(fastifyView, {
  engine: { ejs },
  root: path.join(__dirname, 'views'),
});

// Health check
app.get('/api/health', async () => {
  return { status: 'ok', app: 'SimProposta Modular API', timestamp: new Date().toISOString() };
});

// 🧩 Registro de Módulos da Aplicação
app.register(authRoutes);
app.register(companyRoutes);
app.register(userRoutes);
app.register(proposalRoutes);

const PORT = Number(process.env.PORT) || 3333;

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 SimProposta Modular API rodando em http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
