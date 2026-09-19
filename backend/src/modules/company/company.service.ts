import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument, COMPANY_SINGLETON_ID } from './schemas/company.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

export type SequenceType = 'invoice' | 'quote' | 'payment';

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<Company>,
    private readonly auditService: AuditService,
  ) {}

  async ensure(): Promise<Company> {
    let company = await this.companyModel.findOne({ key: COMPANY_SINGLETON_ID }).exec();
    if (!company) {
      company = await this.companyModel.create({ key: COMPANY_SINGLETON_ID });
    }
    return company;
  }

  async get(): Promise<Company> {
    const company = await this.ensure();
    return (company as CompanyDocument).toObject();
  }

  async nextNumber(type: SequenceType): Promise<string> {
    const company = await this.ensure();
    const fieldMap = {
      invoice: { prefix: 'invoicePrefix', seq: 'invoiceNextNumber' },
      quote: { prefix: 'quotePrefix', seq: 'quoteNextNumber' },
      payment: { prefix: 'paymentPrefix', seq: 'paymentNextNumber' },
    } as const;
    const f = fieldMap[type];

    const updated = await this.companyModel
      .findOneAndUpdate(
        { key: COMPANY_SINGLETON_ID },
        { $inc: { [f.seq]: 1 } },
        { new: true },
      )
      .exec();

    const prefix = String((updated as unknown as Record<string, unknown>)[f.prefix] ?? '');
    const seq = Number((updated as unknown as Record<string, unknown>)[f.seq]) - 1;
    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }

  async update(patch: Record<string, unknown>, actor: JwtUser) {
    const allowed = new Set([
      'name', 'legalName', 'email', 'phone', 'website', 'address', 'currency',
      'invoicePrefix', 'quotePrefix', 'paymentPrefix', 'taxLabel',
      'defaultPaymentTermsDays', 'footerNote', 'logoUrl',
    ]);
    const clean: Record<string, unknown> = {};
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (allowed.has(k)) {
        clean[k] = v;
        changed = true;
      }
    }
    if (!changed) throw new NotFoundException('Nothing to update');

    await this.companyModel
      .findOneAndUpdate({ key: COMPANY_SINGLETON_ID }, { $set: clean }, { new: true })
      .exec();

    await this.auditService.record({
      action: 'company.update',
      entityType: 'Company',
      description: `Updated company settings`,
      metadata: { fields: Object.keys(clean) },
      actor,
    });

    return this.get();
  }
}