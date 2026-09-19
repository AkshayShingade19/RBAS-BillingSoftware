import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { SearchController } from './search.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [SearchController],
})
export class SearchModule {}