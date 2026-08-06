import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyView from '@fastify/view';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import path from 'path';
import ejs from 'ejs';
import bcrypt from 'bcryptjs';
import { prisma } from './shared/prisma';

import { authRoutes } from './modules/auth/auth.routes';
import { companyRoutes } from './modules/companies/company.routes';
import { userRoutes } from './modules/users/user.routes';
import { proposalRoutes } from './modules/proposals/proposal.routes';

dotenv.config();

const app = Fastify({ logger: true });

// Configuração de Cabeçalhos de Segurança & Liberação de CSP para YouTube/Vimeo
app.addHook('onRequest', async (req, reply) => {
  reply.header(
    'Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;"
  );
});

// Auto-seed para garantir que o banco em produção (Render/Supabase) sempre tenha os admins iniciais
async function autoSeedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('🌱 Inicializando banco de dados com auto-seed inicial...');
      
      const company = await prisma.company.create({
        data: {
          name: 'Agência Soluções Digitais',
          cnpj: '12.345.678/0001-90',
          primaryColor: '#066B63',
          planStatus: 'ACTIVE',
        },
      });

      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          name: 'Super Admin SimAprova',
          email: 'admin@simproposta.com',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          companyId: company.id,
        },
      });

      await prisma.user.create({
        data: {
          name: 'Admin SimAprova',
          email: 'admin@simaprova.com.br',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          companyId: company.id,
        },
      });

      console.log('✅ Auto-seed concluído com sucesso! Usuários admin@simproposta.com e admin@simaprova.com.br criados com a senha: admin123');
    }
  } catch (err) {
    console.warn('⚠️ Auto-seed executado ou sincronizado.');
  }
}

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
  return { status: 'ok', app: 'SimAprova Modular API', timestamp: new Date().toISOString() };
});

// 🧩 Registro de Módulos da Aplicação
app.register(authRoutes);
app.register(companyRoutes);
app.register(userRoutes);
app.register(proposalRoutes);

const PORT = Number(process.env.PORT) || 3333;

const start = async () => {
  try {
    await autoSeedDatabase();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 SimAprova Modular API rodando em http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
