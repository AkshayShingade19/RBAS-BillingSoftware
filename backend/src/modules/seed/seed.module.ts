import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { Company, CompanySchema } from '../company/schemas/company.schema';
import { SystemConfig, SystemConfigSchema } from '../system/schemas/system-config.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Tax, TaxSchema } from '../taxes/schemas/tax.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { AppNotification, AppNotificationSchema } from '../notifications/schemas/notification.schema';
import { SeedService } from './seed.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Company.name, schema: CompanySchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: User.name, schema: UserSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Tax.name, schema: TaxSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: AppNotification.name, schema: AppNotificationSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}