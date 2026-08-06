import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';
import { supabase } from '../../shared/supabase';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — Login via Supabase Auth + Sincronização com Prisma
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      // 1. Tenta autenticação nativa via Supabase Auth se configurado
      const { data: supabaseAuth, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!supabaseError && supabaseAuth?.session) {
        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });

        return reply.status(200).send({
          token: supabaseAuth.session.access_token,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
              }
            : {
                id: supabaseAuth.user.id,
                name: supabaseAuth.user.user_metadata?.name || email.split('@')[0],
                email: supabaseAuth.user.email,
                role: 'SELLER',
                company: null,
              },
        });
      }

      // 2. Fallback de Desenvolvimento Local via Prisma
      const user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      const token = app.jwt.sign({
        userId: user.id,
        role: user.role,
        companyId: user.companyId,
      });

      return reply.status(200).send({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
        },
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Erro no servidor de autenticação.' });
    }
  });

  // GET /api/auth/me — Validação de Token (Supabase ou JWT)
  app.get('/api/auth/me', async (req, reply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ error: 'Token de autorização não fornecido.' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      // 1. Tenta validar pelo Supabase Auth
      const { data: supabaseUser, error: supabaseError } = await supabase.auth.getUser(token);
      if (!supabaseError && supabaseUser?.user) {
        const user = await prisma.user.findUnique({
          where: { email: supabaseUser.user.email! },
          include: { company: true },
        });

        return reply.status(200).send({
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
              }
            : {
                id: supabaseUser.user.id,
                name: supabaseUser.user.user_metadata?.name || supabaseUser.user.email,
                email: supabaseUser.user.email,
                role: 'SELLER',
                company: null,
              },
        });
      }

      // 2. Fallback via Fastify JWT
      await req.jwtVerify();
      const decoded = req.user as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { company: true },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Usuário não encontrado.' });
      }

      return reply.status(200).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
        },
      });
    } catch (err) {
      return reply.status(401).send({ error: 'Sessão expirada ou token inválido.' });
    }
  });
}
