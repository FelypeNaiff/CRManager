'use server';
/**
 * @fileOverview An AI customer service assistant that suggests quick, personalized responses
 * and can identify if a response can be sent automatically based on chat context,
 * customer information, and product details.
 *
 * - aiCustomerServiceAssistant - A function that handles the AI assistant's response generation.
 * - AICustomerServiceAssistantInput - The input type for the aiCustomerServiceAssistant function.
 * - AICustomerServiceAssistantOutput - The return type for the aiCustomerServiceAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICustomerServiceAssistantInputSchema = z.object({
  chatHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ).describe('The historical chat messages between the customer and the assistant.'),
  customerContext: z.string().optional().describe('Summarized information about the customer, if available (e.g., VIP status, recent purchases, contact info).'),
  productContext: z.string().optional().describe('Relevant information about the product in question, if available (e.g., name, ID, price, stock, description).'),
  currentQuery: z.string().describe("The customer's latest message or query."),
});
export type AICustomerServiceAssistantInput = z.infer<typeof AICustomerServiceAssistantInputSchema>;

const AICustomerServiceAssistantOutputSchema = z.object({
  suggestedResponse: z.string().describe('A quick and personalized suggested response for the customer.'),
  automaticReplyCandidate: z.boolean().describe('True if this response is simple enough to be sent automatically without human review, otherwise false.'),
});
export type AICustomerServiceAssistantOutput = z.infer<typeof AICustomerServiceAssistantOutputSchema>;

export async function aiCustomerServiceAssistant(input: AICustomerServiceAssistantInput): Promise<AICustomerServiceAssistantOutput> {
  return aiCustomerServiceAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiCustomerServiceAssistantPrompt',
  input: {schema: AICustomerServiceAssistantInputSchema},
  output: {schema: AICustomerServiceAssistantOutputSchema},
  prompt: `You are a helpful and efficient customer service assistant for a retail store called CRManager.\nYour goal is to provide quick, personalized, and accurate responses to customer queries.\nYou will be given the chat history, relevant customer context, relevant product context, and the customer's latest query.\n\nBased on this information, suggest a response. If the query is simple and straightforward, you can also indicate if the response is a candidate for automatic sending.\n\nHere is the available information:\n\nChat History:\n{{#each chatHistory}}\n  {{#if (eq this.role "user")}}Customer: {{/if}}\n  {{#if (eq this.role "assistant")}}Assistant: {{/if}}{{{this.content}}}\n{{/each}}\n\n{{#if customerContext}}\nCustomer Context: {{{customerContext}}}\n{{/if}}\n\n{{#if productContext}}\nProduct Context: {{{productContext}}}\n{{/if}}\n\nCustomer's Latest Query:\n{{{currentQuery}}}\n\nProvide your response in JSON format, with two fields: 'suggestedResponse' (string) and 'automaticReplyCandidate' (boolean).\nExample: {"suggestedResponse": "Hello! How can I help you today?", "automaticReplyCandidate": true}\n`,
});

const aiCustomerServiceAssistantFlow = ai.defineFlow(
  {
    name: 'aiCustomerServiceAssistantFlow',
    inputSchema: AICustomerServiceAssistantInputSchema,
    outputSchema: AICustomerServiceAssistantOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
