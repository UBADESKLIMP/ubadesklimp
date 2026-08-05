import { z } from 'zod';
import type { ProductVariation, ProductFragrance } from '@/types/product';

// Validação de autenticação
export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const signUpSchema = authSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Validação de pedido
export const orderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo'),
  notes: z
    .string()
    .trim()
    .max(500, 'Observações muito longas')
    .optional(),
});

// Validação de CPF (formato básico)
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// Validação de CNPJ (formato básico)
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

// Validação de telefone (formato brasileiro)
const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;

// Validação de perfil PF
export const profilePFSchema = z.object({
  person_type: z.literal('pf'),
  name: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo')
    .optional(),
  cpf: z
    .string()
    .trim()
    .regex(cpfRegex, 'CPF inválido (formato: 000.000.000-00)')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Telefone inválido (formato: (00) 00000-0000)')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  delivery_address: z
    .string()
    .trim()
    .max(500, 'Endereço muito longo')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Observações muito longas')
    .optional(),
});

// Validação de perfil PJ
export const profilePJSchema = z.object({
  person_type: z.literal('pj'),
  company_name: z
    .string()
    .trim()
    .min(1, 'Razão social é obrigatória')
    .max(200, 'Razão social muito longa')
    .optional(),
  trade_name: z
    .string()
    .trim()
    .max(200, 'Nome fantasia muito longo')
    .optional(),
  cnpj: z
    .string()
    .trim()
    .regex(cnpjRegex, 'CNPJ inválido (formato: 00.000.000/0000-00)')
    .optional()
    .or(z.literal('')),
  state_registration: z
    .string()
    .trim()
    .max(50, 'Inscrição estadual muito longa')
    .optional(),
  contact_phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Telefone inválido (formato: (00) 00000-0000)')
    .optional()
    .or(z.literal('')),
  billing_email: z
    .string()
    .trim()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  delivery_address: z
    .string()
    .trim()
    .max(500, 'Endereço muito longo')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Observações muito longas')
    .optional(),
});

export const profileSchema = z.discriminatedUnion('person_type', [
  profilePFSchema,
  profilePJSchema,
]);

// Validação de item do carrinho / pedido — espelha exatamente as regras que
// isValidCartItem já aplicava em CartContext.tsx antes desta unificação,
// incluindo a tolerância a price como string (carrinhos antigos salvos no
// localStorage antes do preço virar number).
const isPlausibleVariation = (value: unknown): value is ProductVariation =>
  typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).literage === 'string';

const isPlausibleFragrance = (value: unknown): value is ProductFragrance =>
  typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).name === 'string';

export const cartItemSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  quantity: z.number().finite().min(1),
  price: z.union([z.number().finite().min(0), z.string().trim().min(1)]),
  productId: z.string().optional(),
  image_url: z.string().optional(),
  variation: z.custom<ProductVariation>(isPlausibleVariation, { message: 'variation deve ser um objeto com literage' }).optional(),
  fragrance: z.custom<ProductFragrance>(isPlausibleFragrance, { message: 'fragrance deve ser um objeto com name' }).optional(),
});

export type AuthInput = z.infer<typeof authSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
