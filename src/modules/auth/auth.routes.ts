import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';
import { supabase } from '../../shared/supabase';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — Login via Supabase Auth com Fallback Resiliente para Prisma PostgreSQL
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      // 1. Tenta autenticação nativa via Supabase Auth se disponível
      try {
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
      } catch (supabaseErr) {
        console.warn('⚠️ Supabase Auth offline ou não configurado para este usuário. Usando banco relacional.');
      }

      // 2. Validação no Banco de Dados PostgreSQL (Prisma)
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
    } catch (err: any) {
      console.error('❌ Erro inesperado no login:', err);
      return reply.status(401).send({ error: err.message || 'Credenciais inválidas.' });
    }
  });

  // GET /api/auth/me — Validação de Sessão
  app.get('/api/auth/me', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');

      // Tenta revalidar via Supabase Auth
      try {
        const { data: supabaseUser } = await supabase.auth.getUser(token);
        if (supabaseUser?.user?.email) {
          const user = await prisma.user.findUnique({
            where: { email: supabaseUser.user.email },
            include: { company: true },
          });

          if (user) {
            return {
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                company: user.company,
              },
            };
          }
        }
      } catch (_) {}

      // Fallback para validação JWT local
      const decoded = app.jwt.verify<{ userId: string }>(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { company: true },
      });

      if (!user) return reply.status(401).send({ error: 'Usuário não encontrado' });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          company: user.company,
        },
      };
    } catch (err) {
      return reply.status(401).send({ error: 'Sessão expirada' });
    }
  });
}
