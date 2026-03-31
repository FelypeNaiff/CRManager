export type TriggerType = 'MESSAGE' | 'LEAD' | 'CAMPAIGN';

export interface FunnelStep {
  id: string;
  label: string;
  message: string;
  nextStepId?: string;
}

export class WhatsAppEngineService {
  private funnels = new Map<string, FunnelStep[]>();

  saveFunnel(lojaId: string, steps: FunnelStep[]) {
    this.funnels.set(lojaId, steps);
    return steps;
  }

  processTrigger(lojaId: string, trigger: TriggerType, payload: Record<string, unknown>) {
    const steps = this.funnels.get(lojaId) ?? [];
    return {
      trigger,
      stepsExecuted: steps.length,
      payload,
      messages: steps.map((step) => step.message),
    };
  }
}
