import { z } from 'zod';

const ClientCertificateSchema = z.object({
  origins: z.array(z.string()),
  certificate: z.string().refine((cert) => cert.startsWith('-----BEGIN CERTIFICATE-----'), {
    message: 'Invalid certificate format',
  }),
  privateKey: z
    .string()
    .refine(
      (key) => key.startsWith('-----BEGIN PRIVATE KEY-----') || key.startsWith('-----BEGIN RSA PRIVATE KEY-----'),
      { message: 'Invalid private key format' },
    ),
});

export const UserSchema = z.object({
  name: z.string().min(1),
  password: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;

export const SourceControlUserSchema = UserSchema.extend({
  id: z.number().int().positive().optional(),
  email: z.string().optional(),
  loginName: z.string().optional(),
  lowerName: z.string().optional(),
  fullName: z.string().optional(),
  clientCertificate: ClientCertificateSchema.optional(),
});

export type SourceControlUser = z.infer<typeof SourceControlUserSchema>;
