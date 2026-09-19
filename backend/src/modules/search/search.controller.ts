import { Controller, Get, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Client } from '../clients/schemas/client.schema';
import { Product } from '../products/schemas/product.schema';
import { Invoice } from '../invoices/schemas/invoice.schema';
import { Quote } from '../quotes/schemas/quote.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<Quote>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
  ) {}

  @Get()
  @RequirePermissions('client.read', 'product.read', 'invoice.read', 'quote.read', 'payment.read')
  @ApiOperation({ summary: 'Global search across clients, products, invoices, quotes, payments' })
  async search(@Query('q') q = '', @Query('limit') limit = '5') {
    const term = q.trim();
    const n = Math.min(10, Math.max(1, Number(limit) || 5));
    if (!term) return { clients: [], products: [], invoices: [], quotes: [], payments: [] };

    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const [clients, products, invoices, quotes, payments] = await Promise.all([
      this.clientModel.find({ $or: [{ name: rx }, { email: rx }] }).limit(n).lean().exec(),
      this.productModel.find({ $or: [{ name: rx }, { sku: rx }] }).limit(n).lean().exec(),
      this.invoiceModel.find({ $or: [{ invoiceNumber: rx }, { clientName: rx }] }).limit(n).lean().exec(),
      this.quoteModel.find({ $or: [{ quoteNumber: rx }, { clientName: rx }] }).limit(n).lean().exec(),
      this.paymentModel.find({ $or: [{ paymentNumber: rx }, { clientName: rx }] }).limit(n).lean().exec(),
    ]);

    return {
      clients: clients.map((c) => ({ id: String(c._id), name: c.name, email: c.email, type: 'client' })),
      products: products.map((p) => ({ id: String(p._id), name: p.name, sku: p.sku, type: 'product' })),
      invoices: invoices.map((i) => ({ id: String(i._id), number: i.invoiceNumber, clientName: i.clientName, status: i.status, type: 'invoice' })),
      quotes: quotes.map((q) => ({ id: String(q._id), number: q.quoteNumber, clientName: q.clientName, status: q.status, type: 'quote' })),
      payments: payments.map((p) => ({ id: String(p._id), number: p.paymentNumber, clientName: p.clientName, type: 'payment' })),
    };
  }
}