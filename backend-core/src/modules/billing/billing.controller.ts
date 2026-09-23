import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Param,
  Headers,
} from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { Public } from '../../auth/public.decorator.js';
import { CheckoutDto } from './dto/checkout.dto.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Get('config')
  async getConfig() {
    return this.billingService.getConfig();
  }

  @Post('checkout')
  async createCheckout(@Req() req: any, @Body() dto: CheckoutDto) {
    const userId = req.user?.sub || req.user?.id;
    return this.billingService.createCheckout(userId, dto.planId);
  }

  @Public()
  @Post('webhook/:provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Req() req: any,
    @Headers() headers: Record<string, any>,
    @Body() payload: any,
  ) {
    const rawBody = req.rawBody || req.body || '';
    return this.billingService.handleWebhook(
      provider,
      rawBody,
      headers,
      payload,
    );
  }
}
