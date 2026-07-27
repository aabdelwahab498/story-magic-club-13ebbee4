import { Controller, Post, Body, Req, UseGuards, Param, HttpException, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { AuthGuard } from '../../auth/auth.guard.js';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @UseGuards(AuthGuard)
  async createCheckout(@Req() req: any, @Body('planId') planId: string) {
    if (!planId) {
      throw new HttpException('planId is required', HttpStatus.BAD_REQUEST);
    }
    const userId = req.user.sub;
    try {
      const result = await this.billingService.createCheckout(userId, planId);
      return result;
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('webhook/:provider')
  async handleWebhook(@Param('provider') provider: string, @Body() payload: any) {
    const success = await this.billingService.handleWebhook(provider, payload);
    if (!success) {
      // Return 200 anyway to prevent provider retries if it's an unhandled but valid event,
      // or 400 if it's strictly invalid. For this sprint, we'll return 200.
      return { status: 'ignored' };
    }
    return { status: 'success' };
  }
}
