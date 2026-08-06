import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../../shared/prisma';
import { supabase } from '../../shared/supabase';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login — Login Unificado Supabase Auth + JWT Fastify + Prisma
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return reply.status(400).send({ error: 'E-mail e senha são obrigatórios.' });
    }

    try {
      // 1. Busca o perfil do usuário no banco PostgreSQL (Prisma)
      let user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });

      // 2. Tenta autenticação via Supabase Auth
      try {
        const { data: supabaseAuth, error: supabaseError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!supabaseError && supabaseAuth?.user) {
          if (!user) {
            // Se o usuário existe no Supabase Auth mas ainda não no Prisma relacional
            const defaultCompany = await prisma.company.findFirst();
            const hashedPassword = await bcrypt.hash(password, 10);
            user = await prisma.user.create({
              data: {
                id: supabaseAuth.user.id,
                name: supabaseAuth.user.user_metadata?.name || email.split('@')[0],
                email,
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                companyId: defaultCompany?.id,
              },
              include: { company: true },
            });
          }
        }
      } catch (_) {
        console.warn('⚠️ Supabase Auth offline ou não configurado. Prosseguindo com validação relacional.');
      }

      // 3. Fallback / Validação de Senha via Hash Bcrypt se não validou no Supabase
      if (!user) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
      }

      // 4. Gera SEMPRE um JWT Token unificado da aplicação com userId, role e companyId
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
      return reply.status(401).send({ error: 'E-mail ou senha incorretos.' });
    }
  });

  // GET /api/auth/me — Validação de Sessão
  app.get('/api/auth/me', async (req, reply) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return reply.status(401).send({ error: 'Não autorizado' });

      const token = authHeader.replace('Bearer ', '');
      let userId: string | null = null;

      try {
        const decoded = app.jwt.decode<{ userId?: string; sub?: string }>(token);
        userId = decoded?.userId || decoded?.sub || null;
      } catch (_) {}

      if (!userId) {
        try {
          const verified = app.jwt.verify<{ userId: string }>(token);
          userId = verified.userId;
        } catch (_) {}
      }

      if (!userId) return reply.status(401).send({ error: 'Token inválido' });

      const user = await prisma.user.findUnique({
        where: { id: userId },
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
