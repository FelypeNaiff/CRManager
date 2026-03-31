'use server';
/**
 * @fileOverview A Genkit flow for generating marketing campaign message content.
 *
 * - generateMarketingCampaignContent - A function that handles the marketing content generation process.
 * - MarketingCampaignContentGeneratorInput - The input type for the generateMarketingCampaignContent function.
 * - MarketingCampaignContentGeneratorOutput - The return type for the generateMarketingCampaignContent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MarketingCampaignContentGeneratorInputSchema = z.object({
  targetAudience: z.string().describe('The target audience for the marketing campaign (e.g., "mães de primeira viagem", "clientes inativos", "aniversariantes do mês").'),
  campaignObjective: z.string().describe('The objective of the marketing campaign (e.g., "promover nova coleção", "reativar clientes", "parabenizar aniversariantes e oferecer desconto").'),
});
export type MarketingCampaignContentGeneratorInput = z.infer<typeof MarketingCampaignContentGeneratorInputSchema>;

const MarketingCampaignContentGeneratorOutputSchema = z.object({
  generatedContent: z.string().describe('The generated marketing message content, optimized for the target audience and campaign objective.'),
});
export type MarketingCampaignContentGeneratorOutput = z.infer<typeof MarketingCampaignContentGeneratorOutputSchema>;

export async function generateMarketingCampaignContent(input: MarketingCampaignContentGeneratorInput): Promise<MarketingCampaignContentGeneratorOutput> {
  return marketingCampaignContentGeneratorFlow(input);
}

const marketingCampaignContentGeneratorPrompt = ai.definePrompt({
  name: 'marketingCampaignContentGeneratorPrompt',
  input: { schema: MarketingCampaignContentGeneratorInputSchema },
  output: { schema: MarketingCampaignContentGeneratorOutputSchema },
  prompt: `Você é um especialista em marketing digital e redação persuasiva, focado no varejo de moda infantil.
Sua tarefa é gerar conteúdo de mensagem para uma campanha de marketing, adaptado ao público-alvo e ao objetivo da campanha fornecidos.
O conteúdo deve ser criativo, engajador e com um tom adequado para o segmento de moda infantil, se aplicável, ou para um varejo genérico se o público-alvo não for específico de crianças.

Público-alvo: {{{targetAudience}}}
Objetivo da Campanha: {{{campaignObjective}}}`,
});

const marketingCampaignContentGeneratorFlow = ai.defineFlow(
  {
    name: 'marketingCampaignContentGeneratorFlow',
    inputSchema: MarketingCampaignContentGeneratorInputSchema,
    outputSchema: MarketingCampaignContentGeneratorOutputSchema,
  },
  async (input) => {
    const { output } = await marketingCampaignContentGeneratorPrompt(input);
    return output!;
  }
);
